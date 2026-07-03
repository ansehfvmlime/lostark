import { describe, expect, it } from "vitest";

import type { RaidReward } from "@/data/config/raids";
import {
  calculateContentProfit,
  filterEligibleRaids,
  parseItemLevel,
  selectTopRaids,
  type ContentProfitInput,
} from "./contentProfit";

const NOW = "2026-07-04T00:00:00.000Z";

function raid(overrides: Partial<RaidReward> = {}): RaidReward {
  return {
    id: "kazeros-act1-normal",
    raidGroup: "카제로스 레이드",
    weeklyLockoutKey: "kazeros-act1",
    raidName: "카제로스 레이드 1막 (노말)",
    difficulty: "NORMAL",
    minItemLevel: 1660,
    boundGold: 5750,
    tradableGold: 5750,
    materials: [],
    gameVersion: "test",
    verifiedAt: "2026-07-04",
    source: "COMMUNITY",
    confidence: "LOW",
    ...overrides,
  };
}

describe("parseItemLevel", () => {
  it("콤마 포함 문자열을 숫자로 파싱한다", () => {
    expect(parseItemLevel("1,805.00")).toBe(1805);
  });

  it("숫자는 그대로 반환한다", () => {
    expect(parseItemLevel(1660)).toBe(1660);
  });
});

describe("filterEligibleRaids", () => {
  it("아이템 레벨 이상인 레이드만 남긴다", () => {
    const raids = [
      raid({ id: "a", minItemLevel: 1660 }),
      raid({ id: "b", minItemLevel: 1700 }),
      raid({ id: "c", minItemLevel: 1720 }),
    ];

    const eligible = filterEligibleRaids(raids, 1700);

    expect(eligible.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("selectTopRaids", () => {
  it("같은 weeklyLockoutKey 중 골드가 더 높은 난이도만 남긴다", () => {
    const raids = [
      raid({
        id: "act1-normal",
        weeklyLockoutKey: "act1",
        boundGold: 5000,
        tradableGold: 5000,
      }),
      raid({
        id: "act1-hard",
        weeklyLockoutKey: "act1",
        boundGold: 6000,
        tradableGold: 6000,
      }),
    ];

    const selected = selectTopRaids(raids, 3);

    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe("act1-hard");
  });

  it("골드 합계 기준 내림차순으로 상위 N개를 고른다", () => {
    const raids = [
      raid({ id: "low", weeklyLockoutKey: "g1", boundGold: 1000, tradableGold: 1000 }),
      raid({ id: "mid", weeklyLockoutKey: "g2", boundGold: 5000, tradableGold: 5000 }),
      raid({ id: "high", weeklyLockoutKey: "g3", boundGold: 9000, tradableGold: 9000 }),
      raid({ id: "extra", weeklyLockoutKey: "g4", boundGold: 3000, tradableGold: 3000 }),
    ];

    const selected = selectTopRaids(raids, 3);

    expect(selected.map((r) => r.id)).toEqual(["high", "mid", "extra"]);
  });

  it("기본 limit은 WEEKLY_GOLD_REWARD_LIMIT(3)이다", () => {
    const raids = Array.from({ length: 5 }, (_, i) =>
      raid({
        id: `raid-${i}`,
        weeklyLockoutKey: `group-${i}`,
        boundGold: i * 1000,
        tradableGold: i * 1000,
      })
    );

    expect(selectTopRaids(raids)).toHaveLength(3);
  });
});

function characterSelection(
  overrides: Partial<ContentProfitInput["characters"][number]> = {}
): ContentProfitInput["characters"][number] {
  return {
    characterName: "유우시",
    className: "스트라이커",
    itemLevel: 1805,
    raids: [],
    ...overrides,
  };
}

describe("calculateContentProfit", () => {
  it("귀속 + 거래가능 골드를 합산한다 (재료 없음)", () => {
    const result = calculateContentProfit(
      {
        characters: [
          characterSelection({
            raids: [
              {
                raidId: "kazeros-act1-normal",
                raidName: "카제로스 레이드 1막 (노말)",
                boundGold: 5750,
                tradableGold: 5750,
                materials: [],
              },
            ],
          }),
        ],
      },
      NOW
    );

    expect(result.result.value).toBe(11500);
    expect(result.result.characterCount).toBe(1);
  });

  it("체크된 재료만 재료 환산 골드에 포함한다", () => {
    const result = calculateContentProfit(
      {
        characters: [
          characterSelection({
            raids: [
              {
                raidId: "kazeros-act1-normal",
                raidName: "카제로스 레이드 1막 (노말)",
                boundGold: 0,
                tradableGold: 0,
                materials: [
                  {
                    itemName: "운명의 파괴석",
                    quantity: 100,
                    unitPrice: 5,
                    included: true,
                    priceOrigin: "API",
                  },
                  {
                    itemName: "운명의 수호석",
                    quantity: 100,
                    unitPrice: 1,
                    included: false,
                    priceOrigin: "API",
                  },
                ],
              },
            ],
          }),
        ],
      },
      NOW
    );

    // 체크 해제된 운명의 수호석(100×1=100)은 제외 → 500만 반영
    expect(result.result.materialGoldTotal).toBe(500);
    expect(result.result.value).toBe(500);
  });

  it("여러 캐릭터의 합계를 더한다", () => {
    const result = calculateContentProfit(
      {
        characters: [
          characterSelection({
            characterName: "캐릭A",
            raids: [
              {
                raidId: "r1",
                raidName: "레이드1",
                boundGold: 1000,
                tradableGold: 1000,
                materials: [],
              },
            ],
          }),
          characterSelection({
            characterName: "캐릭B",
            raids: [
              {
                raidId: "r1",
                raidName: "레이드1",
                boundGold: 2000,
                tradableGold: 2000,
                materials: [],
              },
            ],
          }),
        ],
      },
      NOW
    );

    expect(result.result.characterCount).toBe(2);
    expect(result.result.value).toBe(6000);
  });

  it("선택된 캐릭터가 없으면 0원이고 경고를 남긴다", () => {
    const result = calculateContentProfit({ characters: [] }, NOW);

    expect(result.result.value).toBe(0);
    expect(result.warnings).toContain("선택된 캐릭터가 없습니다.");
  });

  it("음수 골드/수량/가격은 0으로 클램프한다", () => {
    const result = calculateContentProfit(
      {
        characters: [
          characterSelection({
            raids: [
              {
                raidId: "r1",
                raidName: "레이드1",
                boundGold: -100,
                tradableGold: -100,
                materials: [
                  {
                    itemName: "테스트재료",
                    quantity: -5,
                    unitPrice: -10,
                    included: true,
                    priceOrigin: "USER",
                  },
                ],
              },
            ],
          }),
        ],
      },
      NOW
    );

    expect(result.result.value).toBe(0);
  });

  it("시세 조회 실패 재료가 있으면 경고를 남긴다", () => {
    const result = calculateContentProfit(
      {
        characters: [
          characterSelection({
            raids: [
              {
                raidId: "r1",
                raidName: "레이드1",
                boundGold: 0,
                tradableGold: 0,
                materials: [
                  {
                    itemName: "운명의 파괴석",
                    quantity: 10,
                    unitPrice: 0,
                    included: true,
                    priceOrigin: "API",
                    priceUnavailable: true,
                  },
                ],
              },
            ],
          }),
        ],
      },
      NOW
    );

    expect(
      result.warnings.some((w) => w.includes("시세를 가져오지 못해"))
    ).toBe(true);
  });

  it("dataTimestamp는 재료 중 가장 최근 priceFetchedAt을 사용하고, 없으면 now를 사용한다", () => {
    const withFetchedAt = calculateContentProfit(
      {
        characters: [
          characterSelection({
            raids: [
              {
                raidId: "r1",
                raidName: "레이드1",
                boundGold: 0,
                tradableGold: 0,
                materials: [
                  {
                    itemName: "재료",
                    quantity: 1,
                    unitPrice: 1,
                    included: true,
                    priceOrigin: "API",
                    priceFetchedAt: "2026-07-01T00:00:00.000Z",
                  },
                ],
              },
            ],
          }),
        ],
      },
      NOW
    );
    expect(withFetchedAt.dataTimestamp).toBe("2026-07-01T00:00:00.000Z");

    const withoutFetchedAt = calculateContentProfit(
      { characters: [characterSelection({ raids: [] })] },
      NOW
    );
    expect(withoutFetchedAt.dataTimestamp).toBe(NOW);
  });

  it("주 3회 제한 안내 문구를 항상 포함한다", () => {
    const result = calculateContentProfit({ characters: [] }, NOW);
    expect(result.warnings.some((w) => w.includes("주 3회"))).toBe(true);
  });
});
