import { z } from "zod";

import type { CalculationResult } from "@/types/calculation";

/**
 * 강화/재련 기대 비용 계산기 (CLAUDE.md 섹션 6, 13).
 *
 * 단순 기하분포(기대 시도 = 1/p)를 쓰지 않는다. 로스트아크 재련은 실패할 때마다 성공
 * 확률이 누적 상승하고, "장인의 기운" 게이지가 매 시도 축적되어 100%(임계값)에 도달하면
 * 다음 시도가 확정 성공한다. 이 두 규칙을 "연속 실패 횟수"를 상태로 하는 점화식으로
 * 모델링한다 (순수 함수, 시뮬레이션/난수 없이 폐형 점화식으로 계산).
 *
 * 성공 확률/증가폭/게이지 축적량/시도당 비용은 게임 수치를 하드코딩하지 않고 전부
 * 사용자 직접 입력값이다 (CLAUDE.md 섹션 6: "성공 확률과 재료 요구량은 하드코딩하지
 * 않는다. 초기 버전은 사용자 직접 입력").
 */

export const honingCostInputSchema = z.object({
  /** 1차 시도 기준 기본 성공 확률 (%) */
  baseSuccessRatePercent: z.number().min(0).max(100),
  /** 실패할 때마다 다음 시도 확률에 누적되는 증가폭 (%p) */
  successRateIncreasePercent: z.number().min(0),
  /** 매 시도(성공/실패 무관)마다 축적되는 장인의 기운 (%) */
  artisanEnergyPerAttemptPercent: z.number().positive(),
  /** 장인의 기운이 이 값에 도달하면 다음 시도가 확정 성공한다 (%) */
  artisanEnergyThresholdPercent: z.number().positive(),
  /** 시도 1회(성공/실패 무관)당 소모하는 재료의 골드 환산 비용 */
  costPerAttempt: z.number().nonnegative(),
  /** 보수적 시나리오로 표시할 백분위수 (예: 90 → 상위 90% 시도 이내 성공하는 비용) */
  targetPercentile: z.number().min(1).max(99),
});

export type HoningCostInput = z.infer<typeof honingCostInputSchema>;

/**
 * 장인의 기운 축적량이 지나치게 작아 필요 시도 횟수가 비현실적으로 커지는 입력을
 * 방어한다. 이 상한에 도달하면 게이지 임계값 도달 전에 계산을 강제 종료하고
 * warnings에 기록한다 (계산이 멈추거나 브라우저가 멈추는 것을 방지).
 */
export const MAX_ATTEMPTS_CAP = 10_000;

export type HoningAttemptDistributionRow = {
  /** 시도 번호 (1부터 시작) */
  attempt: number;
  /** 이 시도에서의 성공 확률 (%). 장인의 기운 천장에 도달하면 100. */
  successRatePercent: number;
  /** 이 시도에서 "처음" 성공할 확률 (직전까지 전부 실패 × 이번 시도 성공) */
  firstSuccessProbability: number;
  /** 이 시도까지 성공이 완료될 누적 확률 */
  cumulativeProbability: number;
};

export type HoningCostResultValue = {
  value: number;
  unit: "골드";
  /** 기대 시도 횟수 (점화식: Σ 생존확률) */
  expectedAttempts: number;
  /** 장인의 기운이 임계값에 도달해 확정 성공하는 시도 번호 */
  ceilingAttempt: number;
  /** 장인의 기운 천장 도달 시나리오의 최악 확정 비용 = ceilingAttempt × 시도당 비용 */
  worstCaseCost: number;
  /** 사용자가 지정한 percentile 기준 시도 횟수 */
  percentileAttempts: number;
  /** percentile 시나리오 비용 = percentileAttempts × 시도당 비용 */
  percentileCost: number;
  targetPercentile: number;
  distribution: HoningAttemptDistributionRow[];
};

export type HoningCostResult = CalculationResult<
  HoningCostInput,
  HoningCostResultValue
>;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** 장인의 기운이 threshold에 도달해 확정 성공하는 시도 번호(1-indexed)를 계산한다. */
export function calculateCeilingAttempt(
  input: Pick<
    HoningCostInput,
    "artisanEnergyPerAttemptPercent" | "artisanEnergyThresholdPercent"
  >
): number {
  const raw = Math.ceil(
    input.artisanEnergyThresholdPercent / input.artisanEnergyPerAttemptPercent
  );
  return Math.min(Math.max(raw, 1), MAX_ATTEMPTS_CAP);
}

/**
 * 시도 k(1-indexed)의 성공 확률(%). 장인의 기운 천장(ceilingAttempt)에 도달하면
 * 확정 성공(100%)이다.
 */
function attemptSuccessRatePercent(
  attempt: number,
  ceilingAttempt: number,
  input: HoningCostInput
): number {
  if (attempt >= ceilingAttempt) return 100;
  const raw =
    input.baseSuccessRatePercent +
    (attempt - 1) * input.successRateIncreasePercent;
  return clampPercent(raw);
}

/**
 * 연속 실패 횟수를 상태로 하는 점화식으로 시도별 분포를 계산한다.
 * survival[k] = 시도 k까지 전부 실패했을 확률 (survival[0] = 1).
 * firstSuccess[k] = survival[k-1] × 성공확률(k) — 시도 k에서 "처음" 성공할 확률.
 */
export function buildHoningAttemptDistribution(
  input: HoningCostInput
): HoningAttemptDistributionRow[] {
  const ceilingAttempt = calculateCeilingAttempt(input);

  const rows: HoningAttemptDistributionRow[] = [];
  let survival = 1;
  let cumulative = 0;

  for (let attempt = 1; attempt <= ceilingAttempt; attempt += 1) {
    const successRatePercent = attemptSuccessRatePercent(
      attempt,
      ceilingAttempt,
      input
    );
    const firstSuccessProbability = survival * (successRatePercent / 100);
    cumulative += firstSuccessProbability;
    survival *= 1 - successRatePercent / 100;

    rows.push({
      attempt,
      successRatePercent,
      firstSuccessProbability,
      // 부동소수점 누적 오차로 1을 살짝 넘는 것을 방지한다.
      cumulativeProbability: Math.min(1, cumulative),
    });
  }

  return rows;
}

/** 기대 시도 횟수 = Σ_{k=0}^{K-1} P(N>k) (생존확률의 합, 점화식 항등식). */
function expectedAttemptsFromDistribution(
  distribution: HoningAttemptDistributionRow[]
): number {
  let survivalBeforeAttempt = 1;
  let expected = 0;
  for (const row of distribution) {
    expected += survivalBeforeAttempt;
    survivalBeforeAttempt *= 1 - row.successRatePercent / 100;
  }
  return expected;
}

function findPercentileAttempts(
  distribution: HoningAttemptDistributionRow[],
  targetPercentile: number
): number {
  const target = targetPercentile / 100;
  const EPSILON = 1e-9;
  for (const row of distribution) {
    if (row.cumulativeProbability >= target - EPSILON) {
      return row.attempt;
    }
  }
  return distribution.at(-1)?.attempt ?? 1;
}

export function calculateHoningCost(
  input: HoningCostInput,
  now: string
): HoningCostResult {
  const warnings: string[] = [];

  const rawCeiling = Math.ceil(
    input.artisanEnergyThresholdPercent / input.artisanEnergyPerAttemptPercent
  );
  if (rawCeiling > MAX_ATTEMPTS_CAP) {
    warnings.push(
      `장인의 기운 축적량이 작아 필요 시도 횟수가 ${rawCeiling.toLocaleString(
        "ko-KR"
      )}회로 계산되어, 계산 안정성을 위해 ${MAX_ATTEMPTS_CAP.toLocaleString(
        "ko-KR"
      )}회로 제한해 계산했습니다. 실제 장인의 기운 천장 도달 시도보다 이 값이 더 작을 수 있습니다.`
    );
  }

  const distribution = buildHoningAttemptDistribution(input);
  const ceilingAttempt = calculateCeilingAttempt(input);
  const expectedAttempts = expectedAttemptsFromDistribution(distribution);
  const expectedCost = expectedAttempts * input.costPerAttempt;
  const worstCaseCost = ceilingAttempt * input.costPerAttempt;
  const percentileAttempts = findPercentileAttempts(
    distribution,
    input.targetPercentile
  );
  const percentileCost = percentileAttempts * input.costPerAttempt;

  if (input.costPerAttempt === 0) {
    warnings.push("시도당 비용이 0골드로 입력되어 있어 비용이 모두 0으로 계산됩니다.");
  }

  warnings.push(
    "확률/게이지 수치는 사용자가 직접 입력한 값이며, 실제 게임 수치와 다를 수 있습니다. 확률 계산은 기대값이며 실제 결과는 운에 따라 달라질 수 있습니다."
  );

  return {
    title: "강화/재련 기대 비용 계산",
    input,
    assumptions: [
      "매 시도(성공/실패 무관)마다 같은 재료 비용이 소모된다고 가정합니다.",
      "성공 확률은 실패할 때마다 입력한 증가폭만큼 누적되며, 100%를 넘지 않도록 clamp합니다.",
      "장인의 기운이 임계값(기본 100%)에 도달하는 시도에서는 확률과 무관하게 확정 성공으로 계산합니다.",
      "\"최악 확정 비용\"은 장인의 기운 천장에 도달할 때까지의 비용이며, \"percentile 비용\"은 지정한 백분위수 이내에 성공할 확률을 기준으로 한 시나리오입니다. 둘 다 기대 비용과 다른 별도의 시나리오입니다.",
    ],
    formula:
      "기대 시도 = Σ(생존확률), 시도k 성공확률 = min(기본확률 + (k-1)×증가폭, 100%) (장인의 기운 임계값 도달 시 100%), 기대 비용 = 기대 시도 × 시도당 비용",
    sources: [{ field: "강화 확률/비용 입력값", origin: "USER" }],
    result: {
      value: Math.round(expectedCost),
      unit: "골드",
      expectedAttempts,
      ceilingAttempt,
      worstCaseCost: Math.round(worstCaseCost),
      percentileAttempts,
      percentileCost: Math.round(percentileCost),
      targetPercentile: input.targetPercentile,
      distribution,
    },
    warnings,
    dataTimestamp: now,
  };
}
