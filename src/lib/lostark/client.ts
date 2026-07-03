import "server-only";

import { characterProfilePath } from "./endpoints";
import { characterProfileSchema, type CharacterProfile } from "./schemas";

/**
 * server-only 가드: 이 모듈이 실수로 클라이언트 번들에 포함되면 빌드가 실패한다.
 * JWT는 이 파일 밖으로 나가지 않는다 (CLAUDE.md 섹션 5/12).
 */

export type LostArkApiErrorType =
  | "UNAUTHORIZED" // 401
  | "FORBIDDEN" // 403
  | "NOT_FOUND" // 404
  | "UNSUPPORTED_MEDIA_TYPE" // 415
  | "RATE_LIMITED" // 429
  | "SERVER_ERROR" // 500
  | "SERVICE_UNAVAILABLE" // 502/503/504 및 네트워크 오류
  | "INVALID_RESPONSE" // JSON 파싱/Zod 검증 실패
  | "UNKNOWN";

export class LostArkApiError extends Error {
  readonly type: LostArkApiErrorType;
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(
    type: LostArkApiErrorType,
    message: string,
    options?: { status?: number; retryAfterSeconds?: number; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "LostArkApiError";
    this.type = type;
    this.status = options?.status;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export type RateLimitInfo = {
  limit: number | null;
  remaining: number | null;
  resetEpochSeconds: number | null;
};

// 로스트아크 API rate limit: 분당 100회 수준 (CLAUDE.md 섹션 5). 응답 헤더로 실측한다.
function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  const toNumberOrNull = (value: string | null): number | null => {
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };
  return {
    limit: toNumberOrNull(headers.get("X-RateLimit-Limit")),
    remaining: toNumberOrNull(headers.get("X-RateLimit-Remaining")),
    resetEpochSeconds: toNumberOrNull(headers.get("X-RateLimit-Reset")),
  };
}

function requireEnv(name: "LOSTARK_API_BASE_URL" | "LOSTARK_API_JWT"): string {
  const value = process.env[name];
  if (!value) {
    throw new LostArkApiError(
      "UNKNOWN",
      `서버 환경변수 ${name}이 설정되어 있지 않습니다.`
    );
  }
  return value;
}

async function requestLostArkApi(
  path: string,
  init?: RequestInit
): Promise<{ data: unknown; rateLimit: RateLimitInfo }> {
  const baseUrl = requireEnv("LOSTARK_API_BASE_URL");
  const jwt = requireEnv("LOSTARK_API_JWT");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `bearer ${jwt}`,
        ...(init?.headers ?? {}),
      },
      // 캐싱은 lib/lostark/cache.ts에서 명시적으로 관리한다. fetch 자체 캐시는 끈다.
      cache: "no-store",
    });
  } catch (cause) {
    throw new LostArkApiError(
      "SERVICE_UNAVAILABLE",
      "현재 로스트아크 API 서버가 점검 중이거나 응답하지 않습니다. 잠시 후 다시 시도해주세요.",
      { cause }
    );
  }

  const rateLimit = parseRateLimitHeaders(response.headers);

  if (response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch (cause) {
      throw new LostArkApiError(
        "INVALID_RESPONSE",
        "로스트아크 API 응답을 해석할 수 없습니다.",
        { status: response.status, cause }
      );
    }
    return { data, rateLimit };
  }

  switch (response.status) {
    case 401:
      throw new LostArkApiError(
        "UNAUTHORIZED",
        "API 인증에 실패했습니다. 서버의 JWT 설정을 확인해주세요.",
        { status: 401 }
      );
    case 403:
      throw new LostArkApiError(
        "FORBIDDEN",
        "이 요청에 대한 접근 권한이 없습니다.",
        { status: 403 }
      );
    case 404:
      throw new LostArkApiError(
        "NOT_FOUND",
        "요청한 캐릭터를 찾을 수 없습니다.",
        { status: 404 }
      );
    case 415:
      throw new LostArkApiError(
        "UNSUPPORTED_MEDIA_TYPE",
        "요청 형식이 올바르지 않습니다.",
        { status: 415 }
      );
    case 429: {
      const retryAfterSeconds = rateLimit.resetEpochSeconds
        ? Math.max(0, rateLimit.resetEpochSeconds - Math.floor(Date.now() / 1000))
        : undefined;
      throw new LostArkApiError(
        "RATE_LIMITED",
        "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        { status: 429, retryAfterSeconds }
      );
    }
    case 500:
      throw new LostArkApiError(
        "SERVER_ERROR",
        "현재 로스트아크 API 서버에 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        { status: 500 }
      );
    case 502:
    case 503:
    case 504:
      throw new LostArkApiError(
        "SERVICE_UNAVAILABLE",
        "현재 로스트아크 API 서버가 점검 중이거나 응답하지 않습니다. 잠시 후 다시 시도해주세요.",
        { status: response.status }
      );
    default:
      throw new LostArkApiError(
        "UNKNOWN",
        "알 수 없는 오류가 발생했습니다.",
        { status: response.status }
      );
  }
}

export type CharacterProfileResult = {
  profile: CharacterProfile;
  rateLimit: RateLimitInfo;
};

/** GET /armories/characters/{characterName}/profiles */
export async function getCharacterProfile(
  characterName: string
): Promise<CharacterProfileResult> {
  const { data, rateLimit } = await requestLostArkApi(
    characterProfilePath(characterName)
  );

  // 실제 API로 확인된 동작(2026-07-03): 존재하지 않는 캐릭터는 404가 아니라
  // HTTP 200 + body `null`로 응답한다. docs/API_NOTES.md 참고.
  if (data === null) {
    throw new LostArkApiError(
      "NOT_FOUND",
      "요청한 캐릭터를 찾을 수 없습니다.",
      { status: 200 }
    );
  }

  const parsed = characterProfileSchema.safeParse(data);
  if (!parsed.success) {
    throw new LostArkApiError(
      "INVALID_RESPONSE",
      "캐릭터 정보 응답 형식이 예상과 다릅니다.",
      { cause: parsed.error }
    );
  }

  return { profile: parsed.data, rateLimit };
}
