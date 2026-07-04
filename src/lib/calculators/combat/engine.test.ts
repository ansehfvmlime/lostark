import { describe, expect, it } from "vitest";

import { BASE_CRIT_DAMAGE_MULTIPLIER } from "@/data/config/combatConstants";
import { CRIT_RATE_PARTY_SYNERGIES } from "@/data/config/partySynergies";
import type {
  ArkPassiveEffect,
  ArmoryCard,
  CharacterStat,
  CombatSkill,
  EquipmentItem,
} from "@/lib/lostark/schemas";
import characterFixture from "../../../../tests/fixtures/character-profile-example.json";
import arkPassiveFixture from "../../../../tests/fixtures/character-arkpassive-example.json";
import { detectBluntThornEvolution, parseArkPassiveEffects } from "./parser/arkPassive";
import {
  applyCritRateCeiling,
  buildCritRateContribution,
  calculateCombatCritResult,
  calculateExpectedDamageMultiplier,
  combineCritRateContributions,
  findStat,
} from "./engine";

const REAL_ARK_PASSIVE_EFFECTS = arkPassiveFixture.response
  .Effects as ArkPassiveEffect[];

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

  describe("Stage 2a — 아크패시브 진화 트리 반영 (실 fixture)", () => {
    it("예리한 감각(+4.0%)/일격(+20.0%)이 반영되고 accuracyLevel이 올라간다", () => {
      const stats = characterFixture.response.Stats as CharacterStat[];
      const result = calculateCombatCritResult(
        {
          characterName: characterFixture.response.CharacterName,
          className: characterFixture.response.CharacterClassName,
          stats,
          arkPassiveEffects: REAL_ARK_PASSIVE_EFFECTS,
        },
        NOW
      );

      // 26.19(치명 스탯) + 4.0(예리한 감각) + 20.0(일격) + 0(달인, 유지율 미입력=0%) = 50.19
      expect(result.result.finalCritRatePercent).toBeCloseTo(50.19, 10);
      expect(result.result.accuracyLevel).toBe("PARTIAL_CLASS_RULES");
      expect(result.result.critRateCapPercent).toBe(80); // 뭉툭한 가시 감지
      expect(result.result.evolutionDamageFromOverflowPercent).toBe(0); // 80% 미만이라 초과분 없음

      const sourceNames = result.result.contributions.map((c) => c.sourceName);
      expect(sourceNames.some((name) => name.includes("예리한 감각"))).toBe(true);
      expect(sourceNames.some((name) => name.includes("일격"))).toBe(true);
      expect(sourceNames.some((name) => name.includes("달인"))).toBe(true);
    });

    it("달인 스택 유지율(%)을 입력하면 그만큼만 반영한다", () => {
      const stats = characterFixture.response.Stats as CharacterStat[];
      const result = calculateCombatCritResult(
        {
          characterName: characterFixture.response.CharacterName,
          className: characterFixture.response.CharacterClassName,
          stats,
          arkPassiveEffects: REAL_ARK_PASSIVE_EFFECTS,
          masterNodeUptimePercent: 100,
        },
        NOW
      );

      // 26.19 + 4.0 + 20.0 + 1.4(달인 100% 유지) = 51.59
      expect(result.result.finalCritRatePercent).toBeCloseTo(51.59, 10);
    });

    it("치명타 확률 상한(80%)을 초과하면 초과분이 진화형 피해로 전환된다", () => {
      const highCritStat: CharacterStat = {
        Type: "치명",
        Value: "9999",
        Tooltip: ["치명타 적중률이 95.00% 증가합니다."],
      };

      const result = calculateCombatCritResult(
        {
          characterName: "테스트",
          className: "테스트직업",
          stats: [highCritStat],
          arkPassiveEffects: REAL_ARK_PASSIVE_EFFECTS,
        },
        NOW
      );

      // raw = 95 + 4.0(예리한 감각) + 20.0(일격) + 0(달인) = 119 → 80% 상한
      expect(result.result.finalCritRatePercent).toBe(80);
      // 초과분 39% × 150% = 58.5% (75% 상한 이내)
      expect(result.result.evolutionDamageFromOverflowPercent).toBeCloseTo(
        58.5,
        10
      );
      expect(
        result.warnings.some((w) => w.includes("뭉툭한 가시"))
      ).toBe(true);
      // 기대 피해 배율에는 진화형 피해가 포함되지 않는다 (80% 기준으로만 계산)
      expect(result.result.value).toBeCloseTo(
        calculateExpectedDamageMultiplier(80, BASE_CRIT_DAMAGE_MULTIPLIER.value),
        10
      );
    });

    it("아크패시브 데이터를 제공하지 않으면 Stage 1과 동일하게 BASIC으로 계산한다", () => {
      const stats = characterFixture.response.Stats as CharacterStat[];
      const result = calculateCombatCritResult(
        {
          characterName: characterFixture.response.CharacterName,
          className: characterFixture.response.CharacterClassName,
          stats,
        },
        NOW
      );

      expect(result.result.accuracyLevel).toBe("BASIC");
      expect(result.result.finalCritRatePercent).toBe(26.19);
      expect(result.result.critRateCapPercent).toBe(100);
    });
  });
});

describe("applyCritRateCeiling", () => {
  it("뭉툭한 가시가 없으면 100% 상한만 적용한다", () => {
    const result = applyCritRateCeiling(120, null);
    expect(result.finalCritRatePercent).toBe(100);
    expect(result.evolutionDamageFromOverflowPercent).toBe(0);
    expect(result.critRateCapPercent).toBe(100);
  });

  it("뭉툭한 가시가 있으면 해당 상한을 적용하고 초과분을 전환한다", () => {
    const bluntThorn = {
      capPercent: 80,
      conversionRatePercent: 150,
      conversionCapPercent: 75,
      sourceName: "뭉툭한 가시 (Lv.2)",
    };

    const result = applyCritRateCeiling(95, bluntThorn);
    expect(result.finalCritRatePercent).toBe(80);
    expect(result.evolutionDamageFromOverflowPercent).toBeCloseTo(22.5, 10); // (95-80)×1.5
    expect(result.critRateCapPercent).toBe(80);
  });

  it("전환된 진화형 피해가 전환 상한을 넘으면 상한으로 clamp한다", () => {
    const bluntThorn = {
      capPercent: 80,
      conversionRatePercent: 150,
      conversionCapPercent: 75,
      sourceName: "뭉툭한 가시 (Lv.2)",
    };

    // 초과분 50% × 150% = 75% → 정확히 상한과 같음
    // 초과분 60% × 150% = 90% → 75%로 clamp
    const result = applyCritRateCeiling(140, bluntThorn);
    expect(result.evolutionDamageFromOverflowPercent).toBe(75);
  });

  it("음수 rawCritRate는 0으로 취급한다", () => {
    const result = applyCritRateCeiling(-10, null);
    expect(result.finalCritRatePercent).toBe(0);
  });
});

describe("detectBluntThornEvolution × applyCritRateCeiling (실 fixture 통합)", () => {
  it("실 fixture의 뭉툭한 가시 노드로 계산한 상한/전환값이 정확하다", () => {
    const nodes = parseArkPassiveEffects(REAL_ARK_PASSIVE_EFFECTS);
    const bluntThorn = detectBluntThornEvolution(nodes);
    expect(bluntThorn).not.toBeNull();

    const result = applyCritRateCeiling(100, bluntThorn);
    expect(result.finalCritRatePercent).toBe(80);
    expect(result.evolutionDamageFromOverflowPercent).toBeCloseTo(30, 10); // (100-80)×1.5
  });
});

describe("Stage 2b — 카드/팔찌/트라이포드/파티 시너지 반영", () => {
  const REAL_EQUIPMENT: EquipmentItem[] = [
    {
      Type: "무기",
      Name: "테스트 무기",
      Grade: "고대",
      Tooltip: JSON.stringify({
        Element_005: {
          type: "ItemPartBox",
          value: { Element_000: "기본 효과", Element_001: "무기 공격력 +1000" },
        },
      }),
    },
    {
      Type: "팔찌",
      Name: "찬란한 구원자의 팔찌",
      Grade: "고대",
      Tooltip: JSON.stringify({
        Element_005: {
          type: "ItemPartBox",
          value: {
            Element_000: "팔찌 효과",
            Element_001: "치명 +106<BR>치명타 적중률이 3.4% 증가한다.",
          },
        },
      }),
    },
  ];

  it("실 fixture(카드/트라이포드는 치명타 항목 없음, 팔찌만 있음)를 통합 반영한다", () => {
    const stats = characterFixture.response.Stats as CharacterStat[];
    const result = calculateCombatCritResult(
      {
        characterName: characterFixture.response.CharacterName,
        className: characterFixture.response.CharacterClassName,
        stats,
        arkPassiveEffects: REAL_ARK_PASSIVE_EFFECTS,
        equipment: REAL_EQUIPMENT,
        armoryCard: { Effects: [] },
        skills: [],
      },
      NOW
    );

    // 26.19(치명) + 4.0(예리한 감각) + 20.0(일격) + 0(달인) + 3.4(팔찌) = 53.59
    expect(result.result.finalCritRatePercent).toBeCloseTo(53.59, 10);
    expect(result.result.accuracyLevel).toBe("FULL_CLASS_RULES");
    expect(
      result.result.contributions.some((c) => c.sourceType === "BRACELET" && c.applied)
    ).toBe(true);
  });

  it("카드 세트/트라이포드/파티 시너지를 합성 데이터로 종합 반영한다", () => {
    const stats = characterFixture.response.Stats as CharacterStat[];
    const armoryCard: ArmoryCard = {
      Effects: [
        {
          Index: 0,
          CardSlots: [0, 1],
          Items: [
            { Name: "테스트 세트", Description: "치명타 적중률이 5.0% 증가한다." },
          ],
        },
      ],
    };
    const skills: CombatSkill[] = [
      {
        Name: "테스트 스킬",
        Level: 1,
        Type: "일반",
        Tripods: [
          {
            Tier: 0,
            Slot: 1,
            Name: "테스트 트라이포드",
            IsSelected: true,
            Tooltip: "<font>치명타 적중률이 10.0% 증가한다.</font>",
          },
        ],
      },
    ];
    const striker = CRIT_RATE_PARTY_SYNERGIES.find((s) => s.id === "striker")!;

    const result = calculateCombatCritResult(
      {
        characterName: "테스트",
        className: "스트라이커",
        stats,
        arkPassiveEffects: REAL_ARK_PASSIVE_EFFECTS,
        armoryCard,
        equipment: REAL_EQUIPMENT,
        skills,
        partySynergyIds: [striker.id],
      },
      NOW
    );

    // GLOBAL = 26.19(치명) + 24.0(예리한 감각+일격) + 5.0(카드) + 3.4(팔찌) + 10(파티 시너지) = 68.59
    expect(result.result.finalCritRatePercent).toBeCloseTo(68.59, 10);
    expect(result.result.accuracyLevel).toBe("FULL_CLASS_RULES");

    expect(result.result.skillCritRates).toHaveLength(1);
    const skillRate = result.result.skillCritRates[0]!;
    expect(skillRate.skillName).toBe("테스트 스킬");
    expect(skillRate.tripodBonusPercent).toBe(10.0);
    // 68.59 + 10.0 = 78.59 (80% 상한 미만)
    expect(skillRate.finalCritRatePercent).toBeCloseTo(78.59, 10);
    expect(skillRate.expectedDamageMultiplier).toBeCloseTo(
      calculateExpectedDamageMultiplier(78.59, BASE_CRIT_DAMAGE_MULTIPLIER.value),
      10
    );

    expect(
      result.result.contributions.some(
        (c) => c.sourceType === "MANUAL" && c.sourceName.includes("스트라이커")
      )
    ).toBe(true);
  });

  it("아무 추가 데이터도 없으면 BASIC, 일부만 있으면 PARTIAL_CLASS_RULES다", () => {
    const stats = characterFixture.response.Stats as CharacterStat[];

    const basicResult = calculateCombatCritResult(
      { characterName: "테스트", className: "테스트", stats },
      NOW
    );
    expect(basicResult.result.accuracyLevel).toBe("BASIC");

    const partialResult = calculateCombatCritResult(
      {
        characterName: "테스트",
        className: "테스트",
        stats,
        arkPassiveEffects: REAL_ARK_PASSIVE_EFFECTS,
      },
      NOW
    );
    expect(partialResult.result.accuracyLevel).toBe("PARTIAL_CLASS_RULES");
  });

  it("스킬별 SKILL 기여는 전역 치명타 확률에 새지 않는다", () => {
    const stats = characterFixture.response.Stats as CharacterStat[];
    const skills: CombatSkill[] = [
      {
        Name: "스킬X",
        Level: 1,
        Type: "일반",
        Tripods: [
          {
            Tier: 0,
            Slot: 1,
            Name: "트라이포드X",
            IsSelected: true,
            Tooltip: "<font>치명타 적중률이 99.0% 증가한다.</font>",
          },
        ],
      },
    ];

    const result = calculateCombatCritResult(
      { characterName: "테스트", className: "테스트", stats, skills },
      NOW
    );

    // 스킬 전용 트라이포드 99%는 전역 최종 치명타 확률(26.19%)에 더해지면 안 된다.
    expect(result.result.finalCritRatePercent).toBeCloseTo(26.19, 10);
    // 대신 스킬별 breakdown에서만 반영된다.
    expect(result.result.skillCritRates[0]?.tripodBonusPercent).toBe(99.0);
  });
});
