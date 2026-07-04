import "server-only";

import {
  characterArkPassivePath,
  characterCardsPath,
  characterCombatSkillsPath,
  characterEquipmentPath,
  characterProfilePath,
  characterSiblingsPath,
  marketsSearchPath,
} from "./endpoints";
import {
  arkPassiveSchema,
  armoryCardSchema,
  characterProfileSchema,
  characterSiblingsResponseSchema,
  combatSkillsResponseSchema,
  equipmentResponseSchema,
  marketSearchResponseSchema,
  type ArkPassive,
  type ArmoryCard,
  type CharacterProfile,
  type CharacterSibling,
  type CombatSkill,
  type EquipmentItem,
  type MarketSearchResponse,
} from "./schemas";

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
        "요청한 리소스를 찾을 수 없습니다.",
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

export type MarketSearchParams = {
  categoryCode: number;
  /** 부분 일치 검색 (실측 확인, docs/API_NOTES.md 참고) */
  itemName?: string;
  pageNo?: number;
};

export type MarketSearchResult = {
  result: MarketSearchResponse;
  rateLimit: RateLimitInfo;
};

/** POST /markets/items */
export async function searchMarketItems(
  params: MarketSearchParams
): Promise<MarketSearchResult> {
  const { data, rateLimit } = await requestLostArkApi(marketsSearchPath(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CategoryCode: params.categoryCode,
      ...(params.itemName ? { ItemName: params.itemName } : {}),
      ...(params.pageNo ? { PageNo: params.pageNo } : {}),
    }),
  });

  const parsed = marketSearchResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new LostArkApiError(
      "INVALID_RESPONSE",
      "거래소 시세 응답 형식이 예상과 다릅니다.",
      { cause: parsed.error }
    );
  }

  return { result: parsed.data, rateLimit };
}

export type CharacterSiblingsResult = {
  siblings: CharacterSibling[];
  rateLimit: RateLimitInfo;
};

/** GET /characters/{characterName}/siblings — 같은 원정대(계정)의 전체 캐릭터 목록 */
export async function getCharacterSiblings(
  characterName: string
): Promise<CharacterSiblingsResult> {
  const { data, rateLimit } = await requestLostArkApi(
    characterSiblingsPath(characterName)
  );

  // 실제 API로 확인된 동작(2026-07-04): 존재하지 않는 캐릭터는 armories/profiles와 달리
  // null이 아니라 HTTP 200 + 빈 배열 []을 반환한다. docs/API_NOTES.md 참고.
  const parsed = characterSiblingsResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new LostArkApiError(
      "INVALID_RESPONSE",
      "원정대 캐릭터 목록 응답 형식이 예상과 다릅니다.",
      { cause: parsed.error }
    );
  }

  return { siblings: parsed.data, rateLimit };
}

export type CharacterArkPassiveResult = {
  arkPassive: ArkPassive | null;
  rateLimit: RateLimitInfo;
};

/**
 * GET /armories/characters/{characterName}/arkpassive — 아크패시브(진화/깨달음/도약)
 * 트리 데이터. 치명타 계산 Stage 2의 핵심 데이터 (docs/COMBAT.md 참고).
 */
export async function getCharacterArkPassive(
  characterName: string
): Promise<CharacterArkPassiveResult> {
  const { data, rateLimit } = await requestLostArkApi(
    characterArkPassivePath(characterName)
  );

  // profiles와 동일하게, 존재하지 않는 캐릭터는 HTTP 200 + null을 반환한다
  // (실측 확인, 2026-07-04). 아크패시브 데이터가 없는 경우(구 시스템 잔존 캐릭터 등)와
  // 구분하기 위해, 여기서는 "캐릭터를 못 찾음"만 null로 취급하고 상위에서 처리한다.
  if (data === null) {
    return { arkPassive: null, rateLimit };
  }

  const parsed = arkPassiveSchema.safeParse(data);
  if (!parsed.success) {
    throw new LostArkApiError(
      "INVALID_RESPONSE",
      "아크패시브 정보 응답 형식이 예상과 다릅니다.",
      { cause: parsed.error }
    );
  }

  return { arkPassive: parsed.data, rateLimit };
}

export type CharacterCardsResult = {
  armoryCard: ArmoryCard | null;
  rateLimit: RateLimitInfo;
};

/** GET /armories/characters/{characterName}/cards — 카드 목록 및 세트 효과. */
export async function getCharacterCards(
  characterName: string
): Promise<CharacterCardsResult> {
  const { data, rateLimit } = await requestLostArkApi(
    characterCardsPath(characterName)
  );

  if (data === null) {
    return { armoryCard: null, rateLimit };
  }

  const parsed = armoryCardSchema.safeParse(data);
  if (!parsed.success) {
    throw new LostArkApiError(
      "INVALID_RESPONSE",
      "카드 정보 응답 형식이 예상과 다릅니다.",
      { cause: parsed.error }
    );
  }

  return { armoryCard: parsed.data, rateLimit };
}

export type CharacterEquipmentResult = {
  equipment: EquipmentItem[] | null;
  rateLimit: RateLimitInfo;
};

/** GET /armories/characters/{characterName}/equipment — 장비 목록 (팔찌 포함). */
export async function getCharacterEquipment(
  characterName: string
): Promise<CharacterEquipmentResult> {
  const { data, rateLimit } = await requestLostArkApi(
    characterEquipmentPath(characterName)
  );

  if (data === null) {
    return { equipment: null, rateLimit };
  }

  const parsed = equipmentResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new LostArkApiError(
      "INVALID_RESPONSE",
      "장비 정보 응답 형식이 예상과 다릅니다.",
      { cause: parsed.error }
    );
  }

  return { equipment: parsed.data, rateLimit };
}

export type CharacterCombatSkillsResult = {
  skills: CombatSkill[] | null;
  rateLimit: RateLimitInfo;
};

/** GET /armories/characters/{characterName}/combat-skills — 스킬 및 트라이포드 선택 정보. */
export async function getCharacterCombatSkills(
  characterName: string
): Promise<CharacterCombatSkillsResult> {
  const { data, rateLimit } = await requestLostArkApi(
    characterCombatSkillsPath(characterName)
  );

  if (data === null) {
    return { skills: null, rateLimit };
  }

  const parsed = combatSkillsResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new LostArkApiError(
      "INVALID_RESPONSE",
      "스킬 정보 응답 형식이 예상과 다릅니다.",
      { cause: parsed.error }
    );
  }

  return { skills: parsed.data, rateLimit };
}
