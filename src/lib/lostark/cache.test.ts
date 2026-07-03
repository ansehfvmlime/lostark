import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cacheStore, withCache } from "./cache";

describe("withCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("최초 호출은 cache miss이며 fetcher를 호출한다", async () => {
    const fetcher = vi.fn().mockResolvedValue("value-1");

    const result = await withCache("test-key-miss", 1000, fetcher);

    expect(result.cacheHit).toBe(false);
    expect(result.value).toBe("value-1");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("TTL 이내 재호출은 cache hit이며 fetcher를 다시 호출하지 않는다", async () => {
    const fetcher = vi.fn().mockResolvedValue("value-2");
    await withCache("test-key-hit", 60_000, fetcher);

    const second = await withCache("test-key-hit", 60_000, fetcher);

    expect(second.cacheHit).toBe(true);
    expect(second.value).toBe("value-2");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("TTL 만료 후에는 cache miss로 fetcher를 다시 호출한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("value-first")
      .mockResolvedValueOnce("value-second");

    await withCache("test-key-ttl", 1000, fetcher);
    vi.advanceTimersByTime(1001);
    const result = await withCache("test-key-ttl", 1000, fetcher);

    expect(result.cacheHit).toBe(false);
    expect(result.value).toBe("value-second");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("cacheStore.get은 만료된 항목을 null로 반환한다", async () => {
    await cacheStore.set("expire-key", "stale", 500);
    vi.advanceTimersByTime(501);

    const value = await cacheStore.get("expire-key");

    expect(value).toBeNull();
  });
});
