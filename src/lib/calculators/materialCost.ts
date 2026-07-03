import { z } from "zod";

import type { CalculationResult, ValueOrigin, ValueSource } from "@/types/calculation";
import type { MarketItem } from "@/lib/lostark/schemas";

/**
 * 재료 구매 비용 계산기 (CLAUDE.md 섹션 1, Phase 3 첫 계산기).
 *
 * 순수 함수 원칙(CLAUDE.md 섹션 4): 이 파일은 API 호출/현재 시간 참조를 하지 않는다.
 * "지금 몇 시인지"는 호출부(route handler, UI)가 `now` 인자로 넘겨준다.
 */

export const materialCostInputItemSchema = z.object({
  itemName: z.string().min(1),
  requiredQuantity: z.number().int().nonnegative(),
  ownedQuantity: z.number().int().nonnegative(),
  /** 개당 가격. 묶음 판매 재료는 resolveUnitPriceFromMarketItem으로 미리 환산해서 넣는다. */
  unitPrice: z.number().nonnegative(),
  priceOrigin: z.enum(["API", "USER", "ADMIN", "RULE_TABLE"]),
  priceFetchedAt: z.string().optional(),
  /** 시세 조회에 실패해 unitPrice를 0으로 대체한 경우 true (경고 문구용) */
  priceUnavailable: z.boolean().optional(),
});

export const materialCostInputSchema = z.object({
  materials: z.array(materialCostInputItemSchema),
});

export type MaterialCostInputItem = z.infer<typeof materialCostInputItemSchema>;
export type MaterialCostInput = z.infer<typeof materialCostInputSchema>;

export type MaterialCostLine = {
  itemName: string;
  requiredQuantity: number;
  ownedQuantity: number;
  shortageQuantity: number;
  unitPrice: number;
  cost: number;
};

export type MaterialCostResultValue = {
  value: number;
  unit: "골드";
  lines: MaterialCostLine[];
};

export type MaterialCostResult = CalculationResult<
  MaterialCostInput,
  MaterialCostResultValue
>;

/** 음수 입력은 0으로 클램프한다(방어적 처리). 호출부의 Zod 검증이 1차 방어선이다. */
function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function resolveDataTimestamp(
  materials: MaterialCostInputItem[],
  now: string
): string {
  const fetchedAtList = materials
    .map((material) => material.priceFetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return fetchedAtList.at(-1) ?? now;
}

/**
 * 재료별 비용 = round(max(0, 필요 수량 − 보유 수량) × 개당 가격)
 * 총 비용 = Σ 재료별 비용
 *
 * @param now 계산을 수행하는 시점(ISO 문자열). 호출부에서 `new Date().toISOString()`으로
 *   넘긴다 — 이 함수 자체는 현재 시각을 참조하지 않는다.
 */
export function calculateMaterialCost(
  input: MaterialCostInput,
  now: string
): MaterialCostResult {
  const sources: ValueSource[] = [];
  let hadNegativeInput = false;
  let hadUnavailablePrice = false;

  const lines: MaterialCostLine[] = input.materials.map((material) => {
    if (
      material.requiredQuantity < 0 ||
      material.ownedQuantity < 0 ||
      material.unitPrice < 0
    ) {
      hadNegativeInput = true;
    }
    if (material.priceUnavailable) {
      hadUnavailablePrice = true;
    }

    const requiredQuantity = clampNonNegative(material.requiredQuantity);
    const ownedQuantity = clampNonNegative(material.ownedQuantity);
    const unitPrice = clampNonNegative(material.unitPrice);
    const shortageQuantity = Math.max(0, requiredQuantity - ownedQuantity);
    const cost = Math.round(shortageQuantity * unitPrice);

    sources.push({
      field: material.itemName,
      origin: material.priceOrigin as ValueOrigin,
      fetchedAt: material.priceFetchedAt,
    });

    return {
      itemName: material.itemName,
      requiredQuantity,
      ownedQuantity,
      shortageQuantity,
      unitPrice,
      cost,
    };
  });

  const totalCost = lines.reduce((sum, line) => sum + line.cost, 0);

  const warnings: string[] = [];
  if (input.materials.length === 0) {
    warnings.push("계산할 재료가 없습니다.");
  }
  if (hadNegativeInput) {
    warnings.push("일부 재료의 입력값에 음수가 있어 0으로 처리했습니다.");
  }
  if (hadUnavailablePrice) {
    warnings.push("일부 재료의 거래소 시세를 가져오지 못해 0골드로 계산되었습니다.");
  }
  warnings.push("거래소 가격은 실시간으로 변동될 수 있습니다.");

  return {
    title: "재료 구매 비용 계산",
    input,
    assumptions: [
      "부족 수량 = max(0, 필요 수량 − 보유 수량)로 계산하며, 보유 수량이 더 많으면 0으로 처리합니다.",
      "묶음 단위(예: 100개)로 거래되는 재료는 거래소 최저가를 묶음 수량으로 나눈 개당 가격으로 환산해 계산합니다. 실제 거래소 구매는 묶음 단위로만 가능할 수 있어, 소량 부족분도 묶음 전체 가격이 들 수 있습니다.",
      "재료별 비용은 소수점 이하를 반올림합니다.",
    ],
    formula:
      "재료별 비용 = round(max(0, 필요 수량 − 보유 수량) × 개당 가격), 총 비용 = Σ 재료별 비용",
    sources,
    result: {
      value: totalCost,
      unit: "골드",
      lines,
    },
    warnings,
    dataTimestamp: resolveDataTimestamp(input.materials, now),
  };
}

/**
 * 거래소 API 응답(MarketItem)의 CurrentMinPrice(묶음 최저가)를 개당 가격으로 환산한다.
 * BundleCount가 0 이하로 오는 비정상 응답은 방어적으로 1로 취급한다.
 */
export function resolveUnitPriceFromMarketItem(item: MarketItem): number {
  const bundleCount = item.BundleCount > 0 ? item.BundleCount : 1;
  return item.CurrentMinPrice / bundleCount;
}
