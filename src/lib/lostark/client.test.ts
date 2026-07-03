import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LostArkApiError, getCharacterProfile } from "./client";

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

describe("getCharacterProfile", () => {
  beforeEach(() => {
    process.env.LOSTARK_API_BASE_URL = "https://developer-lostark.game.onstove.com";
    process.env.LOSTARK_API_JWT = "test-jwt";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LOSTARK_API_BASE_URL;
    delete process.env.LOSTARK_API_JWT;
  });

  it("정상 응답을 CharacterProfile로 파싱한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        CharacterName: "테스트캐릭터",
        CharacterClassName: "버서커",
        CharacterLevel: 60,
        ItemAvgLevel: "1,700.00",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCharacterProfile("테스트캐릭터");

    expect(result.profile.CharacterName).toBe("테스트캐릭터");
    // authorization 헤더에 JWT가 실려 나가는지 확인 (서버 프록시 동작 검증)
    const [, requestInit] = fetchMock.mock.calls[0]!;
    expect((requestInit.headers as Record<string, string>).authorization).toBe(
      "bearer test-jwt"
    );
  });

  it("존재하지 않는 캐릭터(HTTP 200 + null body)는 NOT_FOUND로 처리한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null)));

    await expect(getCharacterProfile("없는캐릭터")).rejects.toMatchObject({
      type: "NOT_FOUND",
    } satisfies Partial<LostArkApiError>);
  });

  it("401 응답은 UNAUTHORIZED로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "unauthorized" }, { status: 401 }))
    );

    await expect(getCharacterProfile("아무개")).rejects.toMatchObject({
      type: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("429 응답은 RATE_LIMITED로 변환하고 재시도 대기시간을 계산한다", async () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 30;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { message: "rate limited" },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": "100",
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(resetEpoch),
            },
          }
        )
      )
    );

    try {
      await getCharacterProfile("아무개");
      expect.unreachable("에러가 발생해야 한다");
    } catch (error) {
      expect(error).toBeInstanceOf(LostArkApiError);
      const apiError = error as LostArkApiError;
      expect(apiError.type).toBe("RATE_LIMITED");
      expect(apiError.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("503 응답은 SERVICE_UNAVAILABLE로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({}, { status: 503 }))
    );

    await expect(getCharacterProfile("아무개")).rejects.toMatchObject({
      type: "SERVICE_UNAVAILABLE",
    });
  });

  it("네트워크 오류는 SERVICE_UNAVAILABLE로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(getCharacterProfile("아무개")).rejects.toMatchObject({
      type: "SERVICE_UNAVAILABLE",
    });
  });

  it("스키마와 맞지 않는 응답 구조는 INVALID_RESPONSE로 변환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ unexpected: "shape" }))
    );

    await expect(getCharacterProfile("아무개")).rejects.toMatchObject({
      type: "INVALID_RESPONSE",
    });
  });
});
