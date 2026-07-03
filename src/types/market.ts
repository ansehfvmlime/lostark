import type { MarketItem } from "@/lib/lostark/schemas";
import type { ValueSource } from "@/types/calculation";

/** GET /api/lostark/markets/search 성공 응답 */
export type MarketSearchApiResponse = {
  items: MarketItem[];
  totalCount: number;
  dataTimestamp: string;
  cacheHit: boolean;
  sources: ValueSource[];
};

/** GET /api/lostark/markets/search 실패 응답 */
export type MarketApiErrorResponse = {
  error: string;
};
