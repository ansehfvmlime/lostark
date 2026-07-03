import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { searchMarketItems } from "@/lib/lostark/client";
import { CACHE_TTL_MS, withCache } from "@/lib/lostark/cache";
import { getClientIp, lostArkErrorToResponse } from "@/lib/utils/apiRoute";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import type { MarketSearchApiResponse } from "@/types/market";

// 서버 API route 자체 rate limit (CLAUDE.md 섹션 12).
const ROUTE_RATE_LIMIT_MAX_REQUESTS = 30;
const ROUTE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

const searchQuerySchema = z.object({
  categoryCode: z.coerce.number().int().positive(),
  itemName: z
    .string()
    .trim()
    .min(1)
    .max(50, "검색어가 너무 깁니다.")
    .optional(),
});

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(
    `markets-search-route:${clientIp}`,
    ROUTE_RATE_LIMIT_MAX_REQUESTS,
    ROUTE_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = request.nextUrl;
  const queryValidation = searchQuerySchema.safeParse({
    categoryCode: searchParams.get("categoryCode"),
    itemName: searchParams.get("itemName") ?? undefined,
  });
  if (!queryValidation.success) {
    return NextResponse.json(
      {
        error:
          queryValidation.error.issues[0]?.message ?? "검색 조건이 올바르지 않습니다.",
      },
      { status: 400 }
    );
  }
  const { categoryCode, itemName } = queryValidation.data;

  try {
    // 검색 조건(카테고리+검색어)을 캐시 키에 포함한다 (CLAUDE.md 섹션 5).
    const cacheKey = `market-search:${categoryCode}:${itemName ?? ""}`;
    const { value, cacheHit } = await withCache(
      cacheKey,
      CACHE_TTL_MS.MARKET_PRICE,
      () => searchMarketItems({ categoryCode, itemName })
    );

    const responseBody: MarketSearchApiResponse = {
      items: value.result.Items,
      totalCount: value.result.TotalCount,
      dataTimestamp: new Date().toISOString(),
      cacheHit,
      sources: [
        { field: "market", origin: "API", fetchedAt: new Date().toISOString() },
      ],
    };
    return NextResponse.json(responseBody);
  } catch (error) {
    return lostArkErrorToResponse(error);
  }
}
