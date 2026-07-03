import "server-only";

/**
 * MVP 캐시 스텁.
 *
 * CLAUDE.md 섹션 3/9 규칙상 정식 캐시는 `ApiCache` 테이블(Prisma/PostgreSQL) 기반이어야 하지만,
 * Phase 1 시점에는 DB/Prisma가 아직 세팅되지 않았다 (Phase 1 목표는 "캐시 구조의 기반").
 * 여기서는 동일한 키/TTL 인터페이스를 가진 in-memory 구현을 두고, Phase 4에서
 * ApiCache 테이블 기반 구현으로 교체한다. 인터페이스(CacheStore)를 그대로 유지하면
 * 호출부(route handler, 계산기) 코드는 바뀌지 않는다.
 *
 * 주의: in-memory이므로 서버리스/멀티 인스턴스 환경에서는 인스턴스 간 캐시가 공유되지 않고,
 * 재시작 시 초기화된다. 프로덕션 배포 전 반드시 DB 기반 구현으로 교체해야 한다.
 */

// CLAUDE.md 섹션 5 캐시 TTL 정책 표.
export const CACHE_TTL_MS = {
  MARKET_PRICE: 10 * 60 * 1000, // 거래소 시세: 10분
  CHARACTER_ARMORY: 30 * 60 * 1000, // 캐릭터 armory 전체: 30분
  AUCTION_SEARCH: 10 * 60 * 1000, // 경매장 검색 결과: 10분
} as const;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
}

class InMemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

// 모듈 싱글턴. Next.js dev 환경의 모듈 재평가(HMR)로 인한 초기화를 globalThis로 방지한다.
const globalForCache = globalThis as unknown as { __lostarkCacheStore?: CacheStore };
export const cacheStore: CacheStore =
  globalForCache.__lostarkCacheStore ?? new InMemoryCacheStore();
globalForCache.__lostarkCacheStore = cacheStore;

/** 캐시 hit 시 그대로 반환하고, miss 시 fetcher를 호출해 저장 후 반환한다. */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<{ value: T; cacheHit: boolean }> {
  const cached = await cacheStore.get<T>(key);
  if (cached !== null) {
    return { value: cached, cacheHit: true };
  }
  const value = await fetcher();
  await cacheStore.set(key, value, ttlMs);
  return { value, cacheHit: false };
}
