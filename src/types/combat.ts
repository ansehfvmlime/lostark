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

export type CombatCritInput = {
  characterName: string;
  className: string;
};

export type CombatCritResultValue = {
  /** 기대 피해 배율 (예: 1.2619 = 126.19%) */
  value: number;
  unit: "배율";
  finalCritRatePercent: number;
  critDamageMultiplier: number;
  accuracyLevel: CalculationAccuracyLevel;
  contributions: EffectContribution[];
};

export type CombatCritResult = CalculationResult<
  CombatCritInput,
  CombatCritResultValue
>;
