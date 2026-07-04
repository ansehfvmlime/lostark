import { describe, expect, it } from "vitest";

import {
  MAX_ATTEMPTS_CAP,
  buildHoningAttemptDistribution,
  calculateCeilingAttempt,
  calculateHoningCost,
  honingCostInputSchema,
  type HoningCostInput,
} from "./honingCost";

const NOW = "2026-07-04T00:00:00.000Z";

function input(overrides: Partial<HoningCostInput> = {}): HoningCostInput {
  return {
    baseSuccessRatePercent: 50,
    successRateIncreasePercent: 10,
    artisanEnergyPerAttemptPercent: 25,
    artisanEnergyThresholdPercent: 100,
    costPerAttempt: 100,
    targetPercentile: 90,
    ...overrides,
  };
}

describe("calculateCeilingAttempt", () => {
  it("threshold/e를 올림해 장인의 기운 천장 도달 시도 번호를 계산한다", () => {
    expect(
      calculateCeilingAttempt({
        artisanEnergyThresholdPercent: 100,
        artisanEnergyPerAttemptPercent: 25,
      })
    ).toBe(4);

    expect(
      calculateCeilingAttempt({
        artisanEnergyThresholdPercent: 100,
        artisanEnergyPerAttemptPercent: 30,
      })
    ).toBe(4); // ceil(100/30) = 4
  });

  it("한 번의 시도로 천장에 도달하면 1을 반환한다", () => {
    expect(
      calculateCeilingAttempt({
        artisanEnergyThresholdPercent: 100,
        artisanEnergyPerAttemptPercent: 150,
      })
    ).toBe(1);
  });

  it("비현실적으로 작은 축적량은 MAX_ATTEMPTS_CAP으로 제한한다", () => {
    expect(
      calculateCeilingAttempt({
        artisanEnergyThresholdPercent: 100,
        artisanEnergyPerAttemptPercent: 0.0001,
      })
    ).toBe(MAX_ATTEMPTS_CAP);
  });
});

describe("buildHoningAttemptDistribution", () => {
  it("성공확률은 실패마다 누적 증가하고, 천장 시도에서는 100%로 고정된다", () => {
    const rows = buildHoningAttemptDistribution(input());

    expect(rows).toHaveLength(4);
    expect(rows[0]?.successRatePercent).toBe(50);
    expect(rows[1]?.successRatePercent).toBe(60);
    expect(rows[2]?.successRatePercent).toBe(70);
    expect(rows[3]?.successRatePercent).toBe(100); // 장인의 기운 천장 도달 → 확정 성공
  });

  it("100%를 초과하는 확률은 clamp된다", () => {
    const rows = buildHoningAttemptDistribution(
      input({ baseSuccessRatePercent: 90, successRateIncreasePercent: 30 })
    );
    for (const row of rows) {
      expect(row.successRatePercent).toBeLessThanOrEqual(100);
      expect(row.successRatePercent).toBeGreaterThanOrEqual(0);
    }
  });

  it("누적 확률은 마지막 시도(천장)에서 정확히 1에 도달한다", () => {
    const rows = buildHoningAttemptDistribution(input());
    expect(rows.at(-1)?.cumulativeProbability).toBeCloseTo(1, 10);
  });

  it("각 시도의 첫 성공 확률을 정확히 계산한다 (수기 검증값과 비교)", () => {
    const rows = buildHoningAttemptDistribution(input());
    // 1: 0.5, 2: 0.5*0.6=0.3, 3: 0.2*0.7=0.14, 4: 0.06*1=0.06 (합계 1.0)
    expect(rows[0]?.firstSuccessProbability).toBeCloseTo(0.5, 10);
    expect(rows[1]?.firstSuccessProbability).toBeCloseTo(0.3, 10);
    expect(rows[2]?.firstSuccessProbability).toBeCloseTo(0.14, 10);
    expect(rows[3]?.firstSuccessProbability).toBeCloseTo(0.06, 10);
  });
});

describe("calculateHoningCost", () => {
  it("점화식으로 계산한 기대 시도/비용이 수기 검증값과 일치한다", () => {
    const result = calculateHoningCost(input(), NOW);

    // E[N] = 1*0.5 + 2*0.3 + 3*0.14 + 4*0.06 = 1.76
    expect(result.result.expectedAttempts).toBeCloseTo(1.76, 10);
    expect(result.result.value).toBe(176); // round(1.76 * 100)
  });

  it("장인의 기운 천장 도달 시나리오(최악 확정 비용) = 천장 시도 × 시도당 비용", () => {
    const result = calculateHoningCost(input(), NOW);
    expect(result.result.ceilingAttempt).toBe(4);
    expect(result.result.worstCaseCost).toBe(400);
  });

  it("percentile 시나리오는 누적확률이 목표치를 처음 넘는 시도를 사용한다", () => {
    const p50 = calculateHoningCost(input({ targetPercentile: 50 }), NOW);
    const p90 = calculateHoningCost(input({ targetPercentile: 90 }), NOW);
    const p95 = calculateHoningCost(input({ targetPercentile: 95 }), NOW);

    expect(p50.result.percentileAttempts).toBe(1); // 누적 0.5 >= 0.5
    expect(p90.result.percentileAttempts).toBe(3); // 누적 0.94 >= 0.9
    expect(p95.result.percentileAttempts).toBe(4); // 누적 1.0 >= 0.95
    expect(p90.result.percentileCost).toBe(300);
  });

  it("percentile이 높을수록 percentile 시도 횟수는 감소하지 않는다 (단조성)", () => {
    const percentiles = [10, 30, 50, 70, 90, 99];
    const attempts = percentiles.map(
      (targetPercentile) =>
        calculateHoningCost(input({ targetPercentile }), NOW).result
          .percentileAttempts
    );
    for (let i = 1; i < attempts.length; i += 1) {
      expect(attempts[i]).toBeGreaterThanOrEqual(attempts[i - 1]!);
    }
  });

  it("percentile 비용은 항상 최악 확정 비용 이하다", () => {
    const result = calculateHoningCost(input({ targetPercentile: 99 }), NOW);
    expect(result.result.percentileCost).toBeLessThanOrEqual(
      result.result.worstCaseCost
    );
  });

  it("기본 성공확률이 100%이면 기대 시도는 1이다", () => {
    const result = calculateHoningCost(
      input({ baseSuccessRatePercent: 100, successRateIncreasePercent: 0 }),
      NOW
    );
    expect(result.result.expectedAttempts).toBeCloseTo(1, 10);
    expect(result.result.value).toBe(result.result.percentileCost);
  });

  it("한 번의 시도로 장인의 기운 천장에 도달하면 확률과 무관하게 기대 시도는 1이다", () => {
    const result = calculateHoningCost(
      input({
        baseSuccessRatePercent: 1,
        successRateIncreasePercent: 0,
        artisanEnergyPerAttemptPercent: 150,
        artisanEnergyThresholdPercent: 100,
      }),
      NOW
    );
    expect(result.result.ceilingAttempt).toBe(1);
    expect(result.result.expectedAttempts).toBeCloseTo(1, 10);
  });

  it("시도당 비용이 0이면 경고를 남기고 모든 비용이 0이다", () => {
    const result = calculateHoningCost(input({ costPerAttempt: 0 }), NOW);
    expect(result.result.value).toBe(0);
    expect(result.result.worstCaseCost).toBe(0);
    expect(
      result.warnings.some((w) => w.includes("시도당 비용이 0골드"))
    ).toBe(true);
  });

  it("비현실적으로 작은 장인의 기운 축적량은 MAX_ATTEMPTS_CAP으로 제한하고 경고를 남긴다", () => {
    const result = calculateHoningCost(
      input({ artisanEnergyPerAttemptPercent: 0.0001 }),
      NOW
    );
    expect(result.result.ceilingAttempt).toBe(MAX_ATTEMPTS_CAP);
    expect(
      result.warnings.some((w) => w.includes("제한해 계산했습니다"))
    ).toBe(true);
  });

  it("결과 값은 정수로 반올림된다", () => {
    const result = calculateHoningCost(
      input({ costPerAttempt: 33 }),
      NOW
    );
    expect(Number.isInteger(result.result.value)).toBe(true);
    expect(Number.isInteger(result.result.worstCaseCost)).toBe(true);
    expect(Number.isInteger(result.result.percentileCost)).toBe(true);
  });
});

describe("honingCostInputSchema", () => {
  it("음수 확률/비용을 거부한다", () => {
    expect(
      honingCostInputSchema.safeParse(input({ baseSuccessRatePercent: -1 }))
        .success
    ).toBe(false);
    expect(
      honingCostInputSchema.safeParse(
        input({ successRateIncreasePercent: -1 })
      ).success
    ).toBe(false);
    expect(
      honingCostInputSchema.safeParse(input({ costPerAttempt: -1 })).success
    ).toBe(false);
  });

  it("100%를 초과하는 기본 확률을 거부한다", () => {
    expect(
      honingCostInputSchema.safeParse(input({ baseSuccessRatePercent: 101 }))
        .success
    ).toBe(false);
  });

  it("0 이하의 장인의 기운 축적량/임계값을 거부한다", () => {
    expect(
      honingCostInputSchema.safeParse(
        input({ artisanEnergyPerAttemptPercent: 0 })
      ).success
    ).toBe(false);
    expect(
      honingCostInputSchema.safeParse(
        input({ artisanEnergyThresholdPercent: 0 })
      ).success
    ).toBe(false);
  });

  it("percentile은 1~99 범위만 허용한다", () => {
    expect(
      honingCostInputSchema.safeParse(input({ targetPercentile: 0 })).success
    ).toBe(false);
    expect(
      honingCostInputSchema.safeParse(input({ targetPercentile: 100 }))
        .success
    ).toBe(false);
    expect(
      honingCostInputSchema.safeParse(input({ targetPercentile: 90 })).success
    ).toBe(true);
  });
});
