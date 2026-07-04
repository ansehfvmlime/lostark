import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { EquipmentItem } from "@/lib/lostark/schemas";
import { parseBraceletCritRateContribution } from "./equipment";

const fixturePath = path.resolve(
  __dirname,
  "../../../../../tests/fixtures/character-equipment-example.json"
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
const REAL_EQUIPMENT = fixture.response as EquipmentItem[];

describe("parseBraceletCritRateContribution (실 fixture)", () => {
  it("팔찌 tooltip에서 치명타 적중률 3.4%를 파싱한다", () => {
    const contribution = parseBraceletCritRateContribution(REAL_EQUIPMENT);
    expect(contribution).not.toBeNull();
    expect(contribution?.applied).toBe(true);
    expect(contribution?.value).toBe(3.4);
    expect(contribution?.sourceName).toBe("찬란한 구원자의 팔찌");
    expect(contribution?.sourceType).toBe("BRACELET");
  });

  it("무기 아이템의 ItemPartBox(기본 효과/추가 효과)는 팔찌 효과로 오인하지 않는다", () => {
    // REAL_EQUIPMENT[0]은 무기 — 팔찌가 아예 없는 경우를 별도로 테스트한다.
    const weaponOnly = [REAL_EQUIPMENT[0]!];
    expect(parseBraceletCritRateContribution(weaponOnly)).toBeNull();
  });
});

describe("parseBraceletCritRateContribution (경계 케이스)", () => {
  it("장비 목록에 팔찌가 없으면 null을 반환한다", () => {
    expect(parseBraceletCritRateContribution([])).toBeNull();
    expect(parseBraceletCritRateContribution(null)).toBeNull();
  });

  it("팔찌는 있지만 치명타 적중률 옵션이 없으면 applied:false를 반환한다", () => {
    const bracelet: EquipmentItem = {
      Type: "팔찌",
      Name: "옵션 없는 팔찌",
      Grade: "고대",
      Tooltip: JSON.stringify({
        Element_005: {
          type: "ItemPartBox",
          value: {
            Element_000: "팔찌 효과",
            Element_001: "치명 +100<BR>특화 +100",
          },
        },
      }),
    };
    const contribution = parseBraceletCritRateContribution([bracelet]);
    expect(contribution?.applied).toBe(false);
    expect(contribution?.reason).toContain("감지되지 않았습니다");
  });

  it("팔찌 Tooltip이 JSON 파싱에 실패하면 applied:false를 반환한다", () => {
    const bracelet: EquipmentItem = {
      Type: "팔찌",
      Name: "깨진 팔찌",
      Grade: "고대",
      Tooltip: "깨진 JSON {",
    };
    const contribution = parseBraceletCritRateContribution([bracelet]);
    expect(contribution?.applied).toBe(false);
    expect(contribution?.reason).toContain("해석하지 못했습니다");
  });

  it('"팔찌 효과" 섹션이 없으면 applied:false를 반환한다', () => {
    const bracelet: EquipmentItem = {
      Type: "팔찌",
      Name: "이상한 팔찌",
      Grade: "고대",
      Tooltip: JSON.stringify({
        Element_005: {
          type: "ItemPartBox",
          value: { Element_000: "기본 효과", Element_001: "치명 +100" },
        },
      }),
    };
    const contribution = parseBraceletCritRateContribution([bracelet]);
    expect(contribution?.applied).toBe(false);
    expect(contribution?.reason).toContain("팔찌 효과");
  });
});
