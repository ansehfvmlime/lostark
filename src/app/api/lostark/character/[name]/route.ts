import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { LostArkApiError, getCharacterProfile } from "@/lib/lostark/client";
import { CACHE_TTL_MS, withCache } from "@/lib/lostark/cache";
import { checkRateLimit } from "@/lib/utils/rateLimit";

// 서버 API route 자체 rate limit (CLAUDE.md 섹션 12). 외부 API 제한(분당 100회)보다
// 보수적으로 잡아, 한 클라이언트가 우리 서버 자원을 독점하지 못하게 한다.
const ROUTE_RATE_LIMIT_MAX_REQUESTS = 30;
const ROUTE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

const characterNameSchema = z
  .string()
  .trim()
  .min(1, "캐릭터명을 입력해주세요.")
  .max(30, "캐릭터명이 너무 깁니다.");

function getClientIp(request: NextRequest): string {
  // Next.js 15+에서 NextRequest.ip가 제거되었다. 배포 플랫폼이 주입하는 헤더를 사용한다.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return "unknown";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(
    `character-route:${clientIp}`,
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
    const cacheKey = `character-profile:${characterName}`;
    const { value, cacheHit } = await withCache(
      cacheKey,
      CACHE_TTL_MS.CHARACTER_ARMORY,
      () => getCharacterProfile(characterName)
    );

    return NextResponse.json({
      character: value.profile,
      dataTimestamp: new Date().toISOString(),
      cacheHit,
      sources: [
        { field: "character", origin: "API" as const, fetchedAt: new Date().toISOString() },
      ],
    });
  } catch (error) {
    if (error instanceof LostArkApiError) {
      const status = errorTypeToHttpStatus(error.type, error.status);
      const headers: HeadersInit = {};
      if (error.retryAfterSeconds !== undefined) {
        headers["Retry-After"] = String(error.retryAfterSeconds);
      }
      return NextResponse.json({ error: error.message }, { status, headers });
    }

    return NextResponse.json(
      { error: "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}

function errorTypeToHttpStatus(
  type: LostArkApiError["type"],
  originalStatus?: number
): number {
  switch (type) {
    case "UNAUTHORIZED":
      return 502; // 우리 서버의 JWT 설정 문제이지 클라이언트 인증 문제가 아니므로 502로 변환
    case "FORBIDDEN":
      return 502;
    case "NOT_FOUND":
      return 404;
    case "UNSUPPORTED_MEDIA_TYPE":
      return 502;
    case "RATE_LIMITED":
      return 429;
    case "SERVER_ERROR":
      return 502;
    case "SERVICE_UNAVAILABLE":
      return 503;
    case "INVALID_RESPONSE":
      return 502;
    default:
      return originalStatus ?? 500;
  }
}
