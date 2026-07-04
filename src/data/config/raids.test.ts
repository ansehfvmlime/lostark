import { describe, expect, it } from "vitest";

import { RAID_REWARDS } from "./raids";
import { HONING_MATERIAL_CATALOG } from "./materialCategories";

describe("RAID_REWARDS", () => {
  it("모든 레이드에 gameVersion/verifiedAt/source/confidence 메타데이터가 있다", () => {
    for (const raid of RAID_REWARDS) {
      expect(raid.gameVersion).toBeTruthy();
      expect(raid.verifiedAt).toBeTruthy();
      expect(raid.source).toBeTruthy();
      expect(raid.confidence).toBeTruthy();
    }
  });

  it("카제로스 레이드 각 막은 드랍 재료(운명의 파괴석/수호석/돌파석)를 포함한다", () => {
    const kazerosRaids = RAID_REWARDS.filter(
      (raid) => raid.raidGroup === "카제로스 레이드"
    );
    expect(kazerosRaids.length).toBeGreaterThan(0);

    for (const raid of kazerosRaids) {
      const materialNames = raid.materials.map((m) => m.itemName);
      expect(materialNames).toContain("운명의 파괴석");
      expect(materialNames).toContain("운명의 수호석");
      expect(materialNames).toContain("운명의 돌파석");
    }
  });

  it("모든 드랍 재료 개수는 0보다 크다", () => {
    for (const raid of RAID_REWARDS) {
      for (const material of raid.materials) {
        expect(material.quantity).toBeGreaterThan(0);
      }
    }
  });

  it("거래 불가로 확인된 귀속 전용 재료(팔찌/파편/클리어 메달 등)는 목록에 없다", () => {
    const excludedNames = [
      "운명의 파편",
      "구원자의 팔찌",
      "찬란한 구원자의 팔찌",
      "고귀한 구원자의 팔찌",
      "위대한 비상의 돌",
      "운명의 돌",
      "카르마의 잔영",
      "낙뢰의 뿔",
      "업화의 쐐기돌",
      "클리어 메달",
      "순환 돌파석",
    ];

    const allMaterialNames = RAID_REWARDS.flatMap((raid) =>
      raid.materials.map((m) => m.itemName)
    );

    for (const excluded of excludedNames) {
      expect(allMaterialNames).not.toContain(excluded);
    }
  });

  it("드랍 재료는 모두 재료 카탈로그(HONING_MATERIAL_CATALOG)에 등록되어 있어 시세 조회가 가능하다", () => {
    const catalogNames = new Set(
      HONING_MATERIAL_CATALOG.map((entry) => entry.itemName)
    );
    const allMaterialNames = new Set(
      RAID_REWARDS.flatMap((raid) => raid.materials.map((m) => m.itemName))
    );

    for (const name of allMaterialNames) {
      expect(catalogNames.has(name)).toBe(true);
    }
  });

  it("같은 weeklyLockoutKey를 가진 레이드는 같은 raidGroup 안에서만 중복된다", () => {
    const keyToGroups = new Map<string, Set<string>>();
    for (const raid of RAID_REWARDS) {
      const groups = keyToGroups.get(raid.weeklyLockoutKey) ?? new Set<string>();
      groups.add(raid.raidGroup);
      keyToGroups.set(raid.weeklyLockoutKey, groups);
    }
    for (const groups of keyToGroups.values()) {
      expect(groups.size).toBe(1);
    }
  });
});
