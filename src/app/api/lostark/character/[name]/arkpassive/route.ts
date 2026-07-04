import { NextRequest, NextResponse } from "next/server";

import { getCharacterArkPassive } from "@/lib/lostark/client";
import { CACHE_TTL_MS, withCache } from "@/lib/lostark/cache";
import { characterNameSchema } from "@/lib/lostark/schemas";
import { getClientIp, lostArkErrorToResponse } from "@/lib/utils/apiRoute";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import type { CharacterArkPassiveResponse } from "@/types/character";

// 서버 API route 자체 rate limit (CLAUDE.md 섹션 12).
const ROUTE_RATE_LIMIT_MAX_REQUESTS = 30;
const ROUTE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(
    `character-arkpassive-route:${clientIp}`,
    ROUTE_RATE_LIMIT_MAX_REQUESTS,
    ROUTE_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { name } = await params;
  const nameValidation = characterNameSchema.safeParse(name);
  if (!nameValidation.success) {
    return NextResponse.json(
      { error: nameValidation.error.issues[0]?.message ?? "캐릭터명이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const characterName = nameValidation.data;

  try {
    const cacheKey = `character-arkpassive:${characterName}`;
    const { value, cacheHit } = await withCache(
      cacheKey,
      CACHE_TTL_MS.CHARACTER_ARMORY,
      () => getCharacterArkPassive(characterName)
    );

    if (value.arkPassive === null) {
      return NextResponse.json(
        { error: "요청한 캐릭터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const responseBody: CharacterArkPassiveResponse = {
      arkPassive: value.arkPassive,
      dataTimestamp: new Date().toISOString(),
      cacheHit,
      sources: [
        { field: "arkpassive", origin: "API", fetchedAt: new Date().toISOString() },
      ],
    };
    return NextResponse.json(responseBody);
  } catch (error) {
    return lostArkErrorToResponse(error);
  }
}
