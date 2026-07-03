import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { LostArkApiError } from "@/lib/lostark/client";

/** 로스트아크 API를 감싸는 모든 API route가 공유하는 헬퍼. */

export function getClientIp(request: NextRequest): string {
  // Next.js 15+에서 NextRequest.ip가 제거되었다. 배포 플랫폼이 주입하는 헤더를 사용한다.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return "unknown";
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

/** LostArkApiError를 사용자 친화적 메시지의 NextResponse로 변환한다 (CLAUDE.md 섹션 5). */
export function lostArkErrorToResponse(error: unknown): NextResponse {
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
