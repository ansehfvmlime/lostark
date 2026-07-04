import { BASE_CRIT_DAMAGE_MULTIPLIER } from "@/data/config/combatConstants";
import { extractPercentAfterKeyword } from "@/lib/lostark/tooltip";
import type { CharacterStat } from "@/lib/lostark/schemas";
import type { ValueSource } from "@/types/calculation";
import type {
  CombatCritInput,
  CombatCritResult,
  EffectContribution,
} from "@/types/combat";

/**
 * 치명타 전투 효율 계산 — Stage 1 (CLAUDE.md 섹션 14 "전투 계산 MVP" 1단계):
 * 프로필/치명 스탯 기반 기본 계산. 각인/트라이포드/장비/아크패시브 등 룰 엔진
 * 반영은 이후 단계에서 추가한다.
 *
 * 핵심 아이디어: 로스트아크 API의 "치명" 스탯 tooltip에는 이미 게임이 계산한
 * "치명타 적중률이 X% 증가합니다" 문구가 들어있다. 별도의 스탯→확률 변환 계수를
 * 추측/하드코딩하지 않고 이 문구를 그대로 파싱해서 쓴다 (Two-Layer 원칙: API
 * 수집 계층에서 이미 해석된 값을 우선 사용).
 */

export function findStat(
  stats: CharacterStat[] | undefined,
  type: string
): CharacterStat | undefined {
  return stats?.find((stat) => stat.Type === type);
}

/** "치명" 스탯 tooltip에서 치명타 확률 기여를 EffectContribution으로 만든다. */
export function buildCritRateContribution(
  stats: CharacterStat[] | undefined
): EffectContribution {
  const critStat = findStat(stats, "치명");

  if (!critStat) {
    return {
      sourceType: "STAT",
      sourceName: "치명 스탯",
      target: "GLOBAL",
      stat: "CRIT_RATE",
      value: 0,
      unit: "PERCENT",
      applied: false,
      reason: '캐릭터 프로필 응답에서 "치명" 스탯 정보를 찾을 수 없습니다.',
      confidence: "HIGH",
    };
  }

  const percent = extractPercentAfterKeyword(
    critStat.Tooltip ?? [],
    "치명타 적중률"
  );

  if (percent === null) {
    return {
      sourceType: "STAT",
      sourceName: `치명 스탯 (수치 ${critStat.Value})`,
      target: "GLOBAL",
      stat: "CRIT_RATE",
      value: 0,
      unit: "PERCENT",
      applied: false,
      reason:
        '치명 스탯 tooltip에서 "치명타 적중률이 N% 증가합니다" 문구를 찾지 못해 파싱에 실패했습니다.',
      confidence: "HIGH",
    };
  }

  return {
    sourceType: "STAT",
    sourceName: `치명 스탯 (수치 ${critStat.Value})`,
    target: "GLOBAL",
    stat: "CRIT_RATE",
    value: percent,
    unit: "PERCENT",
    applied: true,
    reason: "API 응답의 치명 스탯 tooltip에서 직접 파싱한 값입니다.",
    confidence: "HIGH",
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * 섹션 7.3 스태킹 순서: SET 적용 → ADD_PERCENT_POINT 합산 → MULTIPLY → clamp.
 * Stage 1은 ADD_PERCENT_POINT 성격의 기여(치명 스탯)만 존재해 SET/MULTIPLY
 * 단계가 아직 없지만, 이후 룰 엔진이 기여를 추가해도 순서가 바뀌지 않도록
 * "적용된 기여를 합산 후 clamp"하는 형태로 만들어 둔다.
 */
export function combineCritRateContributions(
  contributions: EffectContribution[]
): number {
  const sum = contributions
    .filter((contribution) => contribution.applied)
    .reduce((total, contribution) => total + contribution.value, 0);
  return clampPercent(sum);
}

/** 기대 피해 배율 = 치명타 확률 × 치명타 피해 배율 + 비치명 확률 × 1 (섹션 7.3). */
export function calculateExpectedDamageMultiplier(
  critRatePercent: number,
  critDamageMultiplier: number
): number {
  const critRate = critRatePercent / 100;
  return critRate * critDamageMultiplier + (1 - critRate) * 1;
}

export function calculateCombatCritResult(
  input: CombatCritInput & { stats: CharacterStat[] | undefined },
  now: string
): CombatCritResult {
  const { characterName, className, stats } = input;

  const contribution = buildCritRateContribution(stats);
  const contributions = [contribution];
  const finalCritRatePercent = combineCritRateContributions(contributions);
  const critDamageMultiplier = BASE_CRIT_DAMAGE_MULTIPLIER.value;
  const expectedDamageMultiplier = calculateExpectedDamageMultiplier(
    finalCritRatePercent,
    critDamageMultiplier
  );

  const warnings: string[] = [];
  if (!contribution.applied) {
    warnings.push(contribution.reason);
  }
  warnings.push(
    "각인/트라이포드/장비/카드/아크패시브 등 치명타에 영향을 주는 다른 효과는 아직 반영되지 않은 기본(BASIC) 계산입니다."
  );
  warnings.push(
    `기본 치명타 피해 배율(${Math.round(
      critDamageMultiplier * 100
    )}%)은 공식 문서로 확인되지 않은 커뮤니티 통용값입니다.`
  );

  const sources: ValueSource[] = [
    { field: "치명 스탯", origin: "API" },
    { field: "기본 치명타 피해 배율", origin: "ADMIN" },
  ];

  return {
    title: "치명타 전투 효율 계산 (기본)",
    input: { characterName, className },
    assumptions: [
      '치명타 확률은 캐릭터 프로필의 "치명" 스탯 tooltip에 이미 계산되어 있는 값을 그대로 사용합니다.',
      "이 단계에서는 각인/트라이포드/장비/아크패시브 등 다른 치명타 관련 효과를 반영하지 않습니다 (정확도: BASIC).",
      "기대 피해 배율 = 치명타 확률 × 치명타 피해 배율 + 비치명 확률 × 1 입니다.",
    ],
    formula:
      "최종 치명타 확률 = clamp(Σ 적용된 기여, 0, 100%), 기대 피해 배율 = 최종 치명타 확률 × 치명타 피해 배율 + (1 − 최종 치명타 확률) × 1",
    sources,
    result: {
      value: expectedDamageMultiplier,
      unit: "배율",
      finalCritRatePercent,
      critDamageMultiplier,
      accuracyLevel: "BASIC",
      contributions,
    },
    warnings,
    dataTimestamp: now,
  };
}
