import { describe, expect, it } from "vitest";

import { BASE_CRIT_DAMAGE_MULTIPLIER } from "@/data/config/combatConstants";
import type { CharacterStat } from "@/lib/lostark/schemas";
import characterFixture from "../../../../tests/fixtures/character-profile-example.json";
import {
  buildCritRateContribution,
  calculateCombatCritResult,
  calculateExpectedDamageMultiplier,
  combineCritRateContributions,
  findStat,
} from "./engine";

const NOW = "2026-07-04T00:00:00.000Z";

const CRIT_STAT: CharacterStat = {
  Type: "치명",
  Value: "732",
  Tooltip: [
    "<textformat><font> </font> 치명타 적중률이 <font color='#99ff99'>26.19%</font> 증가합니다.</textformat>",
  ],
};

describe("findStat", () => {
  it("Type이 일치하는 스탯을 찾는다", () => {
    expect(findStat([CRIT_STAT], "치명")).toBe(CRIT_STAT);
  });

  it("스탯 배열이 없으면 undefined를 반환한다", () => {
    expect(findStat(undefined, "치명")).toBeUndefined();
  });

  it("일치하는 스탯이 없으면 undefined를 반환한다", () => {
    expect(findStat([CRIT_STAT], "특화")).toBeUndefined();
  });
});

describe("buildCritRateContribution", () => {
  it("치명 스탯 tooltip에서 퍼센트를 파싱해 applied:true로 반환한다", () => {
    const contribution = buildCritRateContribution([CRIT_STAT]);
    expect(contribution.applied).toBe(true);
    expect(contribution.value).toBe(26.19);
    expect(contribution.stat).toBe("CRIT_RATE");
    expect(contribution.confidence).toBe("HIGH");
  });

  it('"치명" 스탯이 없으면 applied:false와 이유를 반환한다', () => {
    const contribution = buildCritRateContribution([]);
    expect(contribution.applied).toBe(false);
    expect(contribution.value).toBe(0);
    expect(contribution.reason).toContain("찾을 수 없습니다");
  });

  it("tooltip이 있어도 문구를 파싱하지 못하면 applied:false를 반환한다", () => {
    const brokenStat: CharacterStat = {
      Type: "치명",
      Value: "732",
      Tooltip: ["알 수 없는 형식의 텍스트입니다."],
    };
    const contribution = buildCritRateContribution([brokenStat]);
    expect(contribution.applied).toBe(false);
    expect(contribution.reason).toContain("파싱에 실패했습니다");
  });
});

describe("combineCritRateContributions (스태킹 → clamp)", () => {
  it("applied된 기여만 합산한다", () => {
    const total = combineCritRateContributions([
      {
        sourceType: "STAT",
        sourceName: "a",
        target: "GLOBAL",
        stat: "CRIT_RATE",
        value: 30,
        unit: "PERCENT",
        applied: true,
        reason: "",
        confidence: "HIGH",
      },
      {
        sourceType: "MANUAL",
        sourceName: "b",
        target: "GLOBAL",
        stat: "CRIT_RATE",
        value: 999,
        unit: "PERCENT",
        applied: false,
        reason: "미반영 테스트",
        confidence: "LOW",
      },
    ]);
    expect(total).toBe(30);
  });

  it("100%를 초과하면 100으로 clamp한다", () => {
    const total = combineCritRateContributions([
      {
        sourceType: "STAT",
        sourceName: "a",
        target: "GLOBAL",
        stat: "CRIT_RATE",
        value: 70,
        unit: "PERCENT",
        applied: true,
        reason: "",
        confidence: "HIGH",
      },
      {
        sourceType: "MANUAL",
        sourceName: "b",
        target: "GLOBAL",
        stat: "CRIT_RATE",
        value: 50,
        unit: "PERCENT",
        applied: true,
        reason: "",
        confidence: "HIGH",
      },
    ]);
    expect(total).toBe(100);
  });

  it("음수 합계는 0으로 clamp한다", () => {
    const total = combineCritRateContributions([
      {
        sourceType: "STAT",
        sourceName: "a",
        target: "GLOBAL",
        stat: "CRIT_RATE",
        value: -10,
        unit: "PERCENT",
        applied: true,
        reason: "",
        confidence: "HIGH",
      },
    ]);
    expect(total).toBe(0);
  });
});

describe("calculateExpectedDamageMultiplier", () => {
  it("치명타 확률 0%면 기대 배율은 1이다", () => {
    expect(calculateExpectedDamageMultiplier(0, 2)).toBeCloseTo(1, 10);
  });

  it("치명타 확률 100%면 기대 배율은 치명타 피해 배율과 같다", () => {
    expect(calculateExpectedDamageMultiplier(100, 2)).toBeCloseTo(2, 10);
  });

  it("치명타 확률 26.19%, 배율 2배면 기대 배율은 1.2619다", () => {
    expect(calculateExpectedDamageMultiplier(26.19, 2)).toBeCloseTo(1.2619, 10);
  });
});

describe("calculateCombatCritResult", () => {
  it("실 API 캐릭터 fixture(치명 스탯 732 → 26.19%)로 회귀 검증한다", () => {
    const stats = characterFixture.response.Stats as CharacterStat[];
    const result = calculateCombatCritResult(
      {
        characterName: characterFixture.response.CharacterName,
        className: characterFixture.response.CharacterClassName,
        stats,
      },
      NOW
    );

    expect(result.result.finalCritRatePercent).toBe(26.19);
    expect(result.result.accuracyLevel).toBe("BASIC");
    expect(result.result.critDamageMultiplier).toBe(
      BASE_CRIT_DAMAGE_MULTIPLIER.value
    );
    expect(result.result.value).toBeCloseTo(
      (26.19 / 100) * 2 + (1 - 26.19 / 100) * 1,
      10
    );
    expect(
      result.warnings.some((w) => w.includes("아직 반영되지 않은"))
    ).toBe(true);
  });

  it("치명 스탯을 찾을 수 없으면 확률 0%로 계산하고 경고를 남긴다", () => {
    const result = calculateCombatCritResult(
      { characterName: "테스트", className: "테스트직업", stats: [] },
      NOW
    );

    expect(result.result.finalCritRatePercent).toBe(0);
    expect(result.result.value).toBeCloseTo(1, 10);
    expect(
      result.warnings.some((w) => w.includes("찾을 수 없습니다"))
    ).toBe(true);
  });

  it("dataTimestamp는 호출부에서 전달한 now를 그대로 사용한다", () => {
    const result = calculateCombatCritResult(
      { characterName: "테스트", className: "테스트직업", stats: [CRIT_STAT] },
      NOW
    );
    expect(result.dataTimestamp).toBe(NOW);
  });
});
