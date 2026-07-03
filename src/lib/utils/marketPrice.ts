import { HONING_MATERIAL_CATALOG } from "@/data/config/materialCategories";
import { resolveUnitPriceFromMarketItem } from "@/lib/calculators/materialCost";
import type { MarketSearchApiResponse } from "@/types/market";

/**
 * 클라이언트 전용 헬퍼. 우리 서버 API route(/api/lostark/markets/search)를 호출해
 * 재료명의 개당 시세를 조회한다. server-only가 아니다 — 브라우저(클라이언트 컴포넌트)에서
 * fetch로 우리 자신의 route를 호출하는 용도다.
 */

export type ResolvedMarketPrice = {
  itemName: string;
  unitPrice: number;
  priceOrigin: "API";
  priceFetchedAt?: string;
  priceUnavailable?: boolean;
};

/** 카탈로그에 등록된 재료면 그 카테고리 코드를, 아니면 재련 재료(50010)를 기본값으로 쓴다. */
function resolveCategoryCode(itemName: string): number {
  const catalogEntry = HONING_MATERIAL_CATALOG.find(
    (entry) => entry.itemName === itemName
  );
  return catalogEntry?.categoryCode ?? 50010;
}

export async function resolveMarketPrice(
  itemName: string
): Promise<ResolvedMarketPrice> {
  const categoryCode = resolveCategoryCode(itemName);

  try {
    const response = await fetch(
      `/api/lostark/markets/search?categoryCode=${categoryCode}&itemName=${encodeURIComponent(itemName)}`
    );

    if (!response.ok) {
      return { itemName, unitPrice: 0, priceOrigin: "API", priceUnavailable: true };
    }

    const data = (await response.json()) as MarketSearchApiResponse;
    const matched = data.items.find((item) => item.Name === itemName);

    if (!matched) {
      return { itemName, unitPrice: 0, priceOrigin: "API", priceUnavailable: true };
    }

    return {
      itemName,
      unitPrice: resolveUnitPriceFromMarketItem(matched),
      priceOrigin: "API",
      priceFetchedAt: data.dataTimestamp,
    };
  } catch {
    return { itemName, unitPrice: 0, priceOrigin: "API", priceUnavailable: true };
  }
}
