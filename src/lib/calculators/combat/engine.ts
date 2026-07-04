import { BASE_CRIT_DAMAGE_MULTIPLIER } from "@/data/config/combatConstants";
import arkPassiveCritRulesData from "@/data/rules/arkPassiveCrit.json";
import { extractPercentAfterKeyword } from "@/lib/lostark/tooltip";
import type { ArkPassiveEffect, CharacterStat } from "@/lib/lostark/schemas";
import type { ValueSource } from "@/types/calculation";
import type {
  CalculationAccuracyLevel,
  CombatCritInput,
  CombatCritResult,
  EffectContribution,
  EffectRule,
} from "@/types/combat";
import {
  detectBluntThornEvolution,
  parseArkPassiveEffects,
} from "./parser/arkPassive";
import { matchArkPassiveCritRules } from "./rules/matcher";

const ARK_PASSIVE_CRIT_RULES = arkPassiveCritRulesData as EffectRule[];

/**
 * 치명타 전투 효율 계산.
 *
 * Stage 1 (CLAUDE.md 섹션 14 "전투 계산 MVP" 1단계): 프로필/치명 스탯 기반 기본 계산.
 * 핵심 아이디어: 로스트아크 API의 "치명" 스탯 tooltip에는 이미 게임이 계산한
 * "치명타 적중률이 X% 증가합니다" 문구가 들어있다. 별도의 스탯→확률 변환 계수를
 * 추측/하드코딩하지 않고 이 문구를 그대로 파싱해서 쓴다 (Two-Layer 원칙: API
 * 수집 계층에서 이미 해석된 값을 우선 사용).
 *
 * Stage 2a (docs/COMBAT.md 섹션 2): 아크패시브 진화 트리(GLOBAL) 치명타 노드 반영.
 * 트라이포드/카드/팔찌/파티 시너지 등 나머지 GLOBAL·SKILL 항목은 아직 미반영이며
 * accuracyLevel과 warnings로 항상 명시한다.
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

function clampPercent(value: number, max = 100): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

/** applied된 기여만 합산한다 (clamp 이전 raw 합계 — 뭉툭한 가시 모드 스위치에서 필요). */
function sumAppliedCritRate(contributions: EffectContribution[]): number {
  return contributions
    .filter((contribution) => contribution.applied)
    .reduce((total, contribution) => total + contribution.value, 0);
}

/**
 * 섹션 7.3 스태킹 순서: SET 적용 → ADD_PERCENT_POINT 합산 → MULTIPLY → clamp(0~100%).
 * 아크패시브 "뭉툭한 가시" 노드처럼 상한이 100%가 아닌 특수 케이스는 이 함수를 쓰지
 * 않고 `applyCritRateCeiling`으로 별도 처리한다 (docs/COMBAT.md 섹션 6.3).
 */
export function combineCritRateContributions(
  contributions: EffectContribution[]
): number {
  return clampPercent(sumAppliedCritRate(contributions));
}

export type CritRateCeilingResult = {
  finalCritRatePercent: number;
  /** 뭉툭한 가시로 인해 진화형 피해로 전환된 값 (%). 노드가 없으면 0. */
  evolutionDamageFromOverflowPercent: number;
  critRateCapPercent: number;
};

/**
 * 뭉툭한 가시(docs/COMBAT.md 섹션 2.5, 6.3) 감지 여부에 따라 치명타 확률 상한을
 * 적용한다. 감지되지 않으면 기존과 동일하게 100% 상한만 적용한다.
 */
export function applyCritRateCeiling(
  rawCritRatePercent: number,
  bluntThorn: ReturnType<
    typeof detectBluntThornEvolution
  > /* null | BluntThornEvolutionInfo */
): CritRateCeilingResult {
  const raw = Math.max(0, rawCritRatePercent);

  if (!bluntThorn) {
    return {
      finalCritRatePercent: clampPercent(raw),
      evolutionDamageFromOverflowPercent: 0,
      critRateCapPercent: 100,
    };
  }

  const finalCritRatePercent = Math.min(raw, bluntThorn.capPercent);
  const overflow = Math.max(0, raw - bluntThorn.capPercent);
  const evolutionDamageFromOverflowPercent = Math.min(
    overflow * (bluntThorn.conversionRatePercent / 100),
    bluntThorn.conversionCapPercent
  );

  return {
    finalCritRatePercent,
    evolutionDamageFromOverflowPercent,
    critRateCapPercent: bluntThorn.capPercent,
  };
}

/** 기대 피해 배율 = 치명타 확률 × 치명타 피해 배율 + 비치명 확률 × 1 (섹션 7.3). */
export function calculateExpectedDamageMultiplier(
  critRatePercent: number,
  critDamageMultiplier: number
): number {
  const critRate = critRatePercent / 100;
  return critRate * critDamageMultiplier + (1 - critRate) * 1;
}

export type CombatCritEngineInput = CombatCritInput & {
  stats: CharacterStat[] | undefined;
  /** 제공되면 Stage 2a 아크패시브 진화 트리 룰을 함께 반영한다. 미제공 시 Stage 1과 동일. */
  arkPassiveEffects?: ArkPassiveEffect[];
};

export function calculateCombatCritResult(
  input: CombatCritEngineInput,
  now: string
): CombatCritResult {
  const { characterName, className, stats, arkPassiveEffects, masterNodeUptimePercent } =
    input;

  const statContribution = buildCritRateContribution(stats);
  const contributions: EffectContribution[] = [statContribution];

  const warnings: string[] = [];
  if (!statContribution.applied) {
    warnings.push(statContribution.reason);
  }

  let accuracyLevel: CalculationAccuracyLevel = "BASIC";
  let bluntThorn: ReturnType<typeof detectBluntThornEvolution> = null;

  if (arkPassiveEffects) {
    accuracyLevel = "PARTIAL_CLASS_RULES";
    const parsedNodes = parseArkPassiveEffects(arkPassiveEffects);
    const arkPassiveContributions = matchArkPassiveCritRules(
      parsedNodes,
      ARK_PASSIVE_CRIT_RULES,
      { manualUptimePercent: masterNodeUptimePercent }
    );
    contributions.push(...arkPassiveContributions);
    bluntThorn = detectBluntThornEvolution(parsedNodes);

    warnings.push(
      "아크패시브 진화 트리 중 치명타 적중률에 관련된 노드(예리한 감각/일격/달인/뭉툭한 가시)만 반영합니다. 트라이포드/카드/팔찌/파티 시너지/도핑 등은 아직 반영되지 않았습니다 (정확도: 일부 룰 반영)."
    );
  } else {
    warnings.push(
      "각인/트라이포드/장비/카드/아크패시브 등 치명타에 영향을 주는 다른 효과는 아직 반영되지 않은 기본(BASIC) 계산입니다."
    );
  }

  const rawCritRatePercent = sumAppliedCritRate(contributions);
  const { finalCritRatePercent, evolutionDamageFromOverflowPercent, critRateCapPercent } =
    applyCritRateCeiling(rawCritRatePercent, bluntThorn);

  if (bluntThorn) {
    warnings.push(
      `"${bluntThorn.sourceName}" 노드로 치명타 확률 상한이 ${bluntThorn.capPercent}%로 제한되고, 초과분의 ${bluntThorn.conversionRatePercent}%(최대 ${bluntThorn.conversionCapPercent}%)가 진화형 피해로 전환됩니다. 이 진화형 피해는 기대 피해 배율에는 포함되지 않았습니다.`
    );
  }

  const critDamageMultiplier = BASE_CRIT_DAMAGE_MULTIPLIER.value;
  const expectedDamageMultiplier = calculateExpectedDamageMultiplier(
    finalCritRatePercent,
    critDamageMultiplier
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
  if (arkPassiveEffects) {
    sources.push({ field: "아크패시브 진화 트리", origin: "API" });
  }

  return {
    title: "치명타 전투 효율 계산",
    input: { characterName, className, masterNodeUptimePercent },
    assumptions: [
      '치명타 확률은 캐릭터 프로필의 "치명" 스탯 tooltip에 이미 계산되어 있는 값을 그대로 사용합니다.',
      "아크패시브 진화 트리의 치명타 관련 노드(예리한 감각/일격/달인)는 tooltip 파싱값을 그대로 더합니다. 달인 노드는 스킬 사용으로 트리거되는 스택형 버프라 사용자가 입력한 유지율(%)을 곱해 반영합니다.",
      "뭉툭한 가시 노드가 감지되면 치명타 확률 상한이 100%가 아니라 해당 노드의 상한(보통 80%)으로 낮아지고, 초과분은 진화형 피해로 전환됩니다 — 이 진화형 피해는 기대 피해 배율 계산에는 포함하지 않습니다.",
      "기대 피해 배율 = 치명타 확률 × 치명타 피해 배율 + 비치명 확률 × 1 입니다.",
    ],
    formula:
      "최종 치명타 확률 = min(Σ 적용된 기여, 확률 상한[기본 100%, 뭉툭한 가시 시 해당 노드 상한]), 기대 피해 배율 = 최종 치명타 확률 × 치명타 피해 배율 + (1 − 최종 치명타 확률) × 1",
    sources,
    result: {
      value: expectedDamageMultiplier,
      unit: "배율",
      finalCritRatePercent,
      critDamageMultiplier,
      accuracyLevel,
      contributions,
      critRateCapPercent,
      evolutionDamageFromOverflowPercent,
    },
    warnings,
    dataTimestamp: now,
  };
}
