import type { CalculationResult } from "./calculation";

/**
 * 전투(치명타) 계산 도메인 공통 타입 (CLAUDE.md 섹션 7.6, 7.8).
 */

export type EffectSourceType =
  | "STAT"
  | "ENGRAVING"
  | "SKILL"
  | "TRIPOD"
  | "EQUIPMENT"
  | "BRACELET"
  | "ELIXIR"
  | "CARD"
  | "ARK_PASSIVE"
  | "ARK_GRID"
  | "MANUAL";

export type EffectTarget = "GLOBAL" | "SKILL";

/** 계산에 반영/미반영된 개별 효과 하나. 반영 여부와 무관하게 전부 남긴다. */
export type EffectContribution = {
  sourceType: EffectSourceType;
  sourceName: string;
  target: EffectTarget;
  targetSkillName?: string;
  stat: string;
  value: number;
  unit: string;
  applied: boolean;
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

/**
 * 계산 정확도 레벨. 모든 직업을 처음부터 완벽 지원하지 않으므로, 현재 계산이
 * 어느 수준까지 반영됐는지 항상 표시한다.
 */
export type CalculationAccuracyLevel =
  | "BASIC" // 치명 스탯 기반 계산만
  | "PARTIAL_CLASS_RULES" // 일부 룰 반영, 미반영 항목 warnings 표시
  | "FULL_CLASS_RULES" // 주요 각인/스킬/트라이포드/아크패시브 반영
  | "MANUAL_ASSISTED"; // 조건부 효과를 사용자 입력으로 보정

/**
 * 각인/트라이포드/카드 등 효과를 데이터로 관리하는 룰 (CLAUDE.md 섹션 7.2).
 * 룰 자체는 `data/rules/*.json`에 두고, 코드(`lib/calculators/combat/rules/`)는
 * 매칭/적용 로직만 담당한다.
 */
export type EffectRule = {
  id: string;
  sourceType: EffectSourceType;
  target: EffectTarget;
  className?: string;
  skillName?: string;
  skillType?: string;
  match: {
    nameIncludes?: string[];
    descriptionIncludes?: string[];
    exactName?: string;
  };
  effect: {
    stat: "CRIT_RATE" | "CRIT_DAMAGE" | "DAMAGE_INCREASE" | "ATTACK_POWER" | "WEAPON_POWER" | "COOLDOWN_REDUCTION";
    operation: "ADD_PERCENT_POINT" | "MULTIPLY" | "SET" | "CONDITIONAL";
    value?: number;
    valueFrom?: "TOOLTIP";
    unit: "PERCENT" | "MULTIPLIER" | "POINT";
    damageBucket?: string;
  };
  condition?: {
    requiresBackAttack?: boolean;
    requiresHeadAttack?: boolean;
    requiresSkillName?: string;
    requiresSkillType?: string;
    requiresEngraving?: string;
    requiresArkPassiveNode?: string;
    manualToggleRequired?: boolean;
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  gameVersion?: string;
  verifiedAt: string;
  source: "TOOLTIP_PARSED" | "OFFICIAL_PATCH_NOTE" | "COMMUNITY" | "MANUAL";
};

export type CombatCritInput = {
  characterName: string;
  className: string;
  /** "달인" 노드가 감지된 경우, 사용자가 입력한 스택 유지율(%). 미입력 시 0으로 취급. */
  masterNodeUptimePercent?: number;
  /** 사용자가 체크박스로 선택한 파티 시너지 옵션 id 목록 (data/config/partySynergies.ts 참고). */
  partySynergyIds?: string[];
};

/** 특정 스킬의 최종 치명타 확률 (GLOBAL 합계 + 그 스킬의 선택된 트라이포드 보너스). */
export type SkillCritRateBreakdown = {
  skillName: string;
  tripodBonusPercent: number;
  finalCritRatePercent: number;
  expectedDamageMultiplier: number;
};

export type CombatCritResultValue = {
  /** 기대 피해 배율 (예: 1.2619 = 126.19%) — 치명타 확률 × 치명타 피해 배율 범위만 다룬다. */
  value: number;
  unit: "배율";
  finalCritRatePercent: number;
  critDamageMultiplier: number;
  accuracyLevel: CalculationAccuracyLevel;
  contributions: EffectContribution[];
  /** 치명타 확률 상한 (%). 기본 100, 뭉툭한 가시 노드 활성 시 해당 노드의 상한값. */
  critRateCapPercent: number;
  /**
   * 뭉툭한 가시로 인해 치명타 확률 초과분이 전환된 진화형 피해(%). `value`(기대 피해
   * 배율)에는 포함되지 않는 별도 수치다 — docs/COMBAT.md 섹션 6.3 참고.
   */
  evolutionDamageFromOverflowPercent: number;
  /** 치명타 관련 트라이포드를 선택한 스킬들의 스킬별 최종 치명타 확률/기대 배율. */
  skillCritRates: SkillCritRateBreakdown[];
};

export type CombatCritResult = CalculationResult<
  CombatCritInput,
  CombatCritResultValue
>;
