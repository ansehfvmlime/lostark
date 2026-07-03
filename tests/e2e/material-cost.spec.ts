import { expect, test } from "@playwright/test";

test.describe("재료 구매 비용 계산기", () => {
  test("재료를 선택하지 않고 제출하면 API를 호출하지 않고 유효성 검사 메시지를 보여준다", async ({
    page,
  }) => {
    let apiCalled = false;
    await page.route("**/api/lostark/markets/search**", () => {
      apiCalled = true;
    });

    await page.goto("/calculators/material-cost");
    await page.getByRole("button", { name: "시세 조회 후 계산" }).click();

    await expect(page.getByText("재료를 선택해주세요.")).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test("거래소 시세로 부족 수량 비용을 계산해 보여준다", async ({ page }) => {
    await page.route("**/api/lostark/markets/search**", (route) => {
      const url = new URL(route.request().url());
      const itemName = url.searchParams.get("itemName") ?? "";
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              Id: 66102004,
              Name: itemName,
              Grade: "일반",
              BundleCount: 100,
              TradeRemainCount: null,
              YDayAvgPrice: 16.7,
              RecentPrice: 17,
              CurrentMinPrice: 20, // 개당 0.2골드
            },
          ],
          totalCount: 1,
          dataTimestamp: "2026-07-04T00:00:00.000Z",
          cacheHit: false,
          sources: [
            { field: "market", origin: "API", fetchedAt: "2026-07-04T00:00:00.000Z" },
          ],
        }),
      });
    });

    await page.goto("/calculators/material-cost");

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "파괴강석", exact: true }).click();

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("500"); // 필요 수량
    await numberInputs.nth(1).fill("100"); // 보유 수량

    await page.getByRole("button", { name: "시세 조회 후 계산" }).click();
    await expect(page.getByText("예상 총 비용")).toBeVisible();

    // 부족 400개 × 개당 0.2골드 = 80골드 (총액 표시 + 표 셀 양쪽에 나타나므로 총액만 특정)
    await expect(page.locator("p.text-3xl")).toHaveText("80 골드");
    await expect(page.getByText("계산 근거 보기")).toBeVisible();
  });

  test("시세 조회에 실패한 재료는 0골드로 계산하고 경고를 보여준다", async ({
    page,
  }) => {
    await page.route("**/api/lostark/markets/search**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "현재 로스트아크 API 서버가 점검 중이거나 응답하지 않습니다. 잠시 후 다시 시도해주세요.",
        }),
      })
    );

    await page.goto("/calculators/material-cost");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "수호강석", exact: true }).click();

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("100");
    await numberInputs.nth(1).fill("0");

    await page.getByRole("button", { name: "시세 조회 후 계산" }).click();
    await expect(page.getByText("예상 총 비용")).toBeVisible();
    await expect(page.locator("p.text-3xl")).toHaveText("0 골드");
    await expect(
      page.getByText("일부 재료의 거래소 시세를 가져오지 못해 0골드로 계산되었습니다.")
    ).toBeVisible();
  });
});
