import "server-only";

/**
 * 서버 API route 자체 rate limit (CLAUDE.md 섹션 12).
 * 외부 로스트아크 API 제한(분당 100회)과 별개로, 우리 서버가 클라이언트로부터
 * 과도한 요청을 받는 것을 막기 위한 최소 방어선이다. 고정 윈도우 방식의 단순 구현.
 *
 * in-memory이므로 멀티 인스턴스 배포 시 인스턴스별로 카운트가 분리된다.
 * 트래픽이 늘어나면 Redis/DB 기반 구현으로 교체를 검토한다.
 */

type WindowState = {
  count: number;
  windowStartMs: number;
};

const globalForRateLimit = globalThis as unknown as {
  __lostarkRateLimitStore?: Map<string, WindowState>;
};
const store =
  globalForRateLimit.__lostarkRateLimitStore ?? new Map<string, WindowState>();
globalForRateLimit.__lostarkRateLimitStore = store;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** key(예: `${route}:${ip}`) 단위로 windowMs 동안 최대 maxRequests번 허용한다. */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const state = store.get(key);

  if (!state || now - state.windowStartMs >= windowMs) {
    store.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
  }

  if (state.count < maxRequests) {
    state.count += 1;
    return {
      allowed: true,
      remaining: maxRequests - state.count,
      retryAfterSeconds: 0,
    };
  }

  const retryAfterSeconds = Math.ceil(
    (state.windowStartMs + windowMs - now) / 1000
  );
  return { allowed: false, remaining: 0, retryAfterSeconds };
}
