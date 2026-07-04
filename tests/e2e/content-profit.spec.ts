import { expect, test } from "@playwright/test";

const HIGH_LEVEL_CHARACTER = {
  ServerName: "카마인",
  CharacterName: "테스트딜러",
  CharacterLevel: 70,
  CharacterClassName: "스트라이커",
  ItemAvgLevel: "1,805.00",
};

const LOW_LEVEL_CHARACTER = {
  ServerName: "카마인",
  CharacterName: "테스트부캐",
  CharacterLevel: 70,
  CharacterClassName: "바드",
  ItemAvgLevel: "1,650.00",
};

// 1660(1막 노말 입장) 이상 1670(2막 노말 입장) 미만 → 입장 가능 레이드가
// "카제로스 레이드 1막 (노말)" 하나로 고정되어 재료 합계 계산을 결정적으로 검증할 수 있다.
const MID_LEVEL_CHARACTER = {
  ServerName: "카마인",
  CharacterName: "테스트미드",
  CharacterLevel: 70,
  CharacterClassName: "바드",
  ItemAvgLevel: "1,665.00",
};

test.describe("콘텐츠 수익 효율 계산기", () => {
  test("빈 캐릭터명으로 제출하면 API를 호출하지 않고 유효성 검사 메시지를 보여준다", async ({
    page,
  }) => {
    let apiCalled = false;
    await page.route("**/api/lostark/character/*/siblings", () => {
      apiCalled = true;
    });

    await page.goto("/calculators/content-profit");
    await page.getByRole("button", { name: "원정대 불러오기" }).click();

    await expect(page.getByText("캐릭터명을 입력해주세요.")).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test("원정대 조회 실패 시 에러 메시지를 보여준다", async ({ page }) => {
    await page.route("**/api/lostark/character/*/siblings", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "현재 로스트아크 API 서버가 점검 중이거나 응답하지 않습니다. 잠시 후 다시 시도해주세요.",
        }),
      })
    );

    await page.goto("/calculators/content-profit");
    await page
      .getByPlaceholder("원정대의 아무 캐릭터명이나 입력하세요")
      .fill("아무개");
    await page.getByRole("button", { name: "원정대 불러오기" }).click();

    await expect(page.getByText("원정대 조회 실패")).toBeVisible();
    await expect(page.getByText(/점검 중이거나 응답하지 않습니다/)).toBeVisible();
  });

  test("입장 가능한 레이드가 없는 캐릭터는 안내 문구를 보여준다", async ({
    page,
  }) => {
    await page.route("**/api/lostark/character/*/siblings", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siblings: [LOW_LEVEL_CHARACTER],
          dataTimestamp: "2026-07-04T00:00:00.000Z",
          cacheHit: false,
          sources: [],
        }),
      })
    );

    await page.goto("/calculators/content-profit");
    await page
      .getByPlaceholder("원정대의 아무 캐릭터명이나 입력하세요")
      .fill("테스트부캐");
    await page.getByRole("button", { name: "원정대 불러오기" }).click();

    await expect(page.getByText("테스트부캐")).toBeVisible();
    await expect(page.getByText("입장 가능한 레이드가 없습니다.")).toBeVisible();
  });

  test("높은 아이템레벨 캐릭터는 상위 3개 레이드가 자동 선택되고, 체크 해제 시 합계가 줄어든다", async ({
    page,
  }) => {
    await page.route("**/api/lostark/character/*/siblings", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siblings: [HIGH_LEVEL_CHARACTER],
          dataTimestamp: "2026-07-04T00:00:00.000Z",
          cacheHit: false,
          sources: [],
        }),
      })
    );

    // 재료 시세 조회는 실제 로스트아크 API를 호출하지 않도록 항상 mock한다. 이 테스트는
    // 귀속/거래가능 골드 합계만 검증하므로 재료는 "조회 실패(0골드)"로 응답한다.
    await page.route("**/api/lostark/markets/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [],
          totalCount: 0,
          dataTimestamp: "2026-07-04T00:00:00.000Z",
          cacheHit: false,
          sources: [],
        }),
      })
    );

    await page.goto("/calculators/content-profit");
    await page
      .getByPlaceholder("원정대의 아무 캐릭터명이나 입력하세요")
      .fill("테스트딜러");
    await page.getByRole("button", { name: "원정대 불러오기" }).click();
    await expect(page.getByText("테스트딜러")).toBeVisible();

    // 아이템레벨 1805는 카제로스 1~4막+종막 하드까지 전부 입장 가능하다.
    await expect(page.getByText(/종막.*하드/)).toBeVisible();

    await page.getByRole("button", { name: "선택한 캐릭터 계산하기" }).click();
    await expect(page.getByText("콘텐츠 수익 효율 계산 결과")).toBeVisible();

    // 아이템레벨 1805는 세르카(나이트메어 1740)에도 입장 가능하다. 상위 3개는
    // 종막(32,000)과 세르카(32,000)가 동률로 묶이고 그 다음 4막(27,000)이 뽑힌다
    // = 91,000골드. 재료는 시세 조회 실패로 0골드 처리된다.
    await expect(page.locator("span.text-xl")).toHaveText("91,000 골드");
    await expect(page.getByText(/주 3회/)).toBeVisible();
    await expect(page.getByText(/저신뢰/)).toBeVisible();
    await expect(
      page.getByText("일부 재료의 거래소 시세를 가져오지 못해 0골드로 계산되었습니다.")
    ).toBeVisible();

    // 유일한 캐릭터를 체크 해제하면 계산 버튼이 비활성화된다 (선택된 캐릭터 없음).
    await page.getByLabel("테스트딜러 포함").click();
    await expect(
      page.getByRole("button", { name: "선택한 캐릭터 계산하기" })
    ).toBeDisabled();
  });

  test("재료 시세를 반영해 재료 환산 골드와 총 기대 골드를 계산한다", async ({
    page,
  }) => {
    await page.route("**/api/lostark/character/*/siblings", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siblings: [MID_LEVEL_CHARACTER],
          dataTimestamp: "2026-07-04T00:00:00.000Z",
          cacheHit: false,
          sources: [],
        }),
      })
    );

    const unitPriceByItem: Record<string, { price: number; bundle: number }> = {
      "운명의 파괴석": { price: 50_000, bundle: 100 }, // 개당 500골드
      "운명의 수호석": { price: 1_000, bundle: 100 }, // 개당 10골드
      "운명의 돌파석": { price: 1_000, bundle: 1 }, // 개당 1,000골드
    };

    await page.route("**/api/lostark/markets/search**", (route) => {
      const url = new URL(route.request().url());
      const itemName = url.searchParams.get("itemName") ?? "";
      const priced = unitPriceByItem[itemName];
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: priced
            ? [
                {
                  Id: 1,
                  Name: itemName,
                  Grade: "일반",
                  BundleCount: priced.bundle,
                  TradeRemainCount: null,
                  YDayAvgPrice: priced.price,
                  RecentPrice: priced.price,
                  CurrentMinPrice: priced.price,
                },
              ]
            : [],
          totalCount: priced ? 1 : 0,
          dataTimestamp: "2026-07-04T00:00:00.000Z",
          cacheHit: false,
          sources: [],
        }),
      });
    });

    await page.goto("/calculators/content-profit");
    await page
      .getByPlaceholder("원정대의 아무 캐릭터명이나 입력하세요")
      .fill("테스트미드");
    await page.getByRole("button", { name: "원정대 불러오기" }).click();
    await expect(page.getByText("테스트미드")).toBeVisible();

    // 1665는 카제로스 1막 노말(1660)에만 입장 가능하다 (1막 하드 1680, 2막 노말
    // 1670 모두 미달).
    await expect(
      page.getByText("카제로스 레이드 1막: 대지를 부수는 업화의 궤적 (노말)")
    ).toBeVisible();
    await expect(page.getByText("운명의 파괴석 1,060개")).toBeVisible();
    await expect(page.getByText("운명의 수호석 2,120개")).toBeVisible();
    await expect(page.getByText("운명의 돌파석 9개")).toBeVisible();

    await page.getByRole("button", { name: "선택한 캐릭터 계산하기" }).click();
    await expect(page.getByText("콘텐츠 수익 효율 계산 결과")).toBeVisible();

    // 귀속 5,750 + 거래가능 5,750 = 11,500골드
    // 재료: 파괴석 1,060×500 + 수호석 2,120×10 + 돌파석 9×1,000 = 530,000+21,200+9,000 = 560,200골드
    // 총 기대 골드 = 11,500 + 560,200 = 571,700골드
    await expect(page.getByText("560,200 골드").first()).toBeVisible();
    await expect(page.locator("span.text-xl")).toHaveText("571,700 골드");
  });
});
