import { describe, expect, it } from "vitest";

import {
  calculateMaterialCost,
  resolveUnitPriceFromMarketItem,
  type MaterialCostInput,
} from "./materialCost";
import type { MarketItem } from "@/lib/lostark/schemas";

const NOW = "2026-07-04T00:00:00.000Z";

function material(
  overrides: Partial<MaterialCostInput["materials"][number]> = {}
): MaterialCostInput["materials"][number] {
  return {
    itemName: "파괴강석",
    requiredQuantity: 100,
    ownedQuantity: 0,
    unitPrice: 10,
    priceOrigin: "API",
    priceFetchedAt: "2026-07-04T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateMaterialCost", () => {
  it("부족 수량 × 개당 가격으로 재료별 비용과 총 비용을 계산한다", () => {
    const result = calculateMaterialCost(
      { materials: [material({ requiredQuantity: 100, ownedQuantity: 30, unitPrice: 10 })] },
      NOW
    );

    expect(result.result.lines[0]).toMatchObject({
      shortageQuantity: 70,
      cost: 700,
    });
    expect(result.result.value).toBe(700);
  });

  it("여러 재료의 비용을 합산한다", () => {
    const result = calculateMaterialCost(
      {
        materials: [
          material({ itemName: "파괴강석", requiredQuantity: 100, ownedQuantity: 0, unitPrice: 10 }),
          material({ itemName: "수호강석", requiredQuantity: 50, ownedQuantity: 20, unitPrice: 5 }),
        ],
      },
      NOW
    );

    // 파괴강석: 100 * 10 = 1000, 수호강석: 30 * 5 = 150
    expect(result.result.value).toBe(1150);
    expect(result.result.lines).toHaveLength(2);
  });

  it("보유 수량이 필요 수량보다 많으면 부족분/비용이 0이다", () => {
    const result = calculateMaterialCost(
      { materials: [material({ requiredQuantity: 10, ownedQuantity: 999, unitPrice: 100 })] },
      NOW
    );

    expect(result.result.lines[0]?.shortageQuantity).toBe(0);
    expect(result.result.lines[0]?.cost).toBe(0);
    expect(result.result.value).toBe(0);
  });

  it("필요 수량이 0이면 비용도 0이다 (누락/0 입력 처리)", () => {
    const result = calculateMaterialCost(
      { materials: [material({ requiredQuantity: 0, ownedQuantity: 0, unitPrice: 100 })] },
      NOW
    );

    expect(result.result.value).toBe(0);
  });

  it("재료가 없으면 총 비용 0과 경고를 반환한다", () => {
    const result = calculateMaterialCost({ materials: [] }, NOW);

    expect(result.result.value).toBe(0);
    expect(result.result.lines).toEqual([]);
    expect(result.warnings).toContain("계산할 재료가 없습니다.");
  });

  it("음수 입력은 0으로 클램프하고 경고를 남긴다", () => {
    const result = calculateMaterialCost(
      { materials: [material({ requiredQuantity: -10, ownedQuantity: -5, unitPrice: -1 })] },
      NOW
    );

    expect(result.result.lines[0]).toMatchObject({
      requiredQuantity: 0,
      ownedQuantity: 0,
      unitPrice: 0,
      shortageQuantity: 0,
      cost: 0,
    });
    expect(
      result.warnings.some((w) => w.includes("음수"))
    ).toBe(true);
  });

  it("소수점이 발생하는 비용은 반올림한다", () => {
    // 부족 17개 × 개당 0.95골드 = 16.15 → 반올림 16
    const result = calculateMaterialCost(
      { materials: [material({ requiredQuantity: 17, ownedQuantity: 0, unitPrice: 0.95 })] },
      NOW
    );

    expect(result.result.lines[0]?.cost).toBe(16);
  });

  it("시세를 가져오지 못한 재료는 0골드로 계산되고 경고를 남긴다", () => {
    const result = calculateMaterialCost(
      {
        materials: [
          material({ unitPrice: 0, priceUnavailable: true, priceFetchedAt: undefined }),
        ],
      },
      NOW
    );

    expect(result.result.lines[0]?.cost).toBe(0);
    expect(
      result.warnings.some((w) => w.includes("시세를 가져오지 못해"))
    ).toBe(true);
  });

  it("각 재료의 출처(sources)를 이름별로 기록한다", () => {
    const result = calculateMaterialCost(
      {
        materials: [
          material({ itemName: "파괴강석", priceOrigin: "API" }),
          material({ itemName: "수호강석", priceOrigin: "USER" }),
        ],
      },
      NOW
    );

    expect(result.sources).toEqual([
      expect.objectContaining({ field: "파괴강석", origin: "API" }),
      expect.objectContaining({ field: "수호강석", origin: "USER" }),
    ]);
  });

  it("dataTimestamp는 재료 중 가장 최근 priceFetchedAt을 사용한다", () => {
    const result = calculateMaterialCost(
      {
        materials: [
          material({ priceFetchedAt: "2026-07-01T00:00:00.000Z" }),
          material({ priceFetchedAt: "2026-07-03T00:00:00.000Z" }),
        ],
      },
      NOW
    );

    expect(result.dataTimestamp).toBe("2026-07-03T00:00:00.000Z");
  });

  it("priceFetchedAt이 하나도 없으면 now를 dataTimestamp로 사용한다", () => {
    const result = calculateMaterialCost(
      { materials: [material({ priceFetchedAt: undefined, priceOrigin: "USER" })] },
      NOW
    );

    expect(result.dataTimestamp).toBe(NOW);
  });
});

describe("resolveUnitPriceFromMarketItem", () => {
  function marketItem(overrides: Partial<MarketItem> = {}): MarketItem {
    return {
      Id: 66102004,
      Name: "파괴강석",
      Grade: "일반",
      BundleCount: 100,
      YDayAvgPrice: 16.7,
      RecentPrice: 17,
      CurrentMinPrice: 17,
      ...overrides,
    };
  }

  it("묶음 최저가를 묶음 수량으로 나눠 개당 가격을 계산한다", () => {
    expect(resolveUnitPriceFromMarketItem(marketItem({ CurrentMinPrice: 100, BundleCount: 100 }))).toBe(1);
  });

  it("묶음 수량이 1이면 최저가를 그대로 사용한다", () => {
    expect(resolveUnitPriceFromMarketItem(marketItem({ CurrentMinPrice: 3, BundleCount: 1 }))).toBe(3);
  });

  it("BundleCount가 0 이하인 비정상 응답은 1로 방어 처리한다", () => {
    expect(resolveUnitPriceFromMarketItem(marketItem({ CurrentMinPrice: 5, BundleCount: 0 }))).toBe(5);
  });
});
