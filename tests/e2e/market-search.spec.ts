import { expect, test } from "@playwright/test";

test.describe("거래소 시세 조회", () => {
  test("빈 검색어로 제출하면 API를 호출하지 않고 유효성 검사 메시지를 보여준다", async ({
    page,
  }) => {
    let apiCalled = false;
    await page.route("**/api/lostark/markets/search**", () => {
      apiCalled = true;
    });

    await page.goto("/market");
    await page.getByRole("button", { name: "시세 조회" }).click();

    await expect(page.getByText("검색할 재료명을 입력해주세요.")).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test("검색 결과를 표로 보여주고 갱신 시점을 표시한다", async ({ page }) => {
    await page.route("**/api/lostark/markets/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              Id: 66102004,
              Name: "파괴강석",
              Grade: "일반",
              BundleCount: 100,
              TradeRemainCount: null,
              YDayAvgPrice: 16.7,
              RecentPrice: 17,
              CurrentMinPrice: 17,
            },
            {
              Id: 66102005,
              Name: "정제된 파괴강석",
              Grade: "일반",
              BundleCount: 100,
              TradeRemainCount: null,
              YDayAvgPrice: 93.8,
              RecentPrice: 102,
              CurrentMinPrice: 95,
            },
          ],
          totalCount: 2,
          dataTimestamp: "2026-07-04T00:00:00.000Z",
          cacheHit: false,
          sources: [
            { field: "market", origin: "API", fetchedAt: "2026-07-04T00:00:00.000Z" },
          ],
        }),
      })
    );

    await page.goto("/market");
    await page
      .getByPlaceholder("재료명을 입력하세요 (예: 파괴강석)")
      .fill("파괴강석");
    await page.getByRole("button", { name: "시세 조회" }).click();

    await expect(page.getByText("검색 결과")).toBeVisible();
    await expect(page.getByText("파괴강석", { exact: true })).toBeVisible();
    await expect(page.getByText("정제된 파괴강석", { exact: true })).toBeVisible();
    await expect(page.getByText(/기준 데이터/)).toBeVisible();
  });

  test("검색 결과가 없으면 안내 문구를 보여준다", async ({ page }) => {
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

    await page.goto("/market");
    await page
      .getByPlaceholder("재료명을 입력하세요 (예: 파괴강석)")
      .fill("존재하지않는재료아무렇게나");
    await page.getByRole("button", { name: "시세 조회" }).click();

    await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();
  });
});
