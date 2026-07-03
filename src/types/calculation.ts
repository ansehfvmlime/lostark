/**
 * 모든 계산기(및 API 기반 조회 화면)가 공유하는 공통 결과 계약 (CLAUDE.md 섹션 6).
 * 계산 결과는 "정답"이 아니라 "현재 입력값 기준 추정치"임을 항상 함께 표시한다.
 */

export type ValueOrigin = "API" | "USER" | "ADMIN" | "RULE_TABLE";

export type ValueSource = {
  field: string;
  origin: ValueOrigin;
  /** API/시세 기반 값의 기준 시점 */
  fetchedAt?: string;
};

export type CalculationResult<
  TInput,
  TValue = { value: number; unit: string }
> = {
  title: string;
  input: TInput;
  assumptions: string[];
  formula: string;
  sources: ValueSource[];
  result: TValue;
  warnings: string[];
  dataTimestamp: string;
};
