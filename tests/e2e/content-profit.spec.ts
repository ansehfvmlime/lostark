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

    // 상위 3개(종막 32,000 + 4막 27,000 + 3막 21,000) = 80,000골드
    await expect(page.locator("span.text-xl")).toHaveText("80,000 골드");
    await expect(page.getByText(/주 3회/)).toBeVisible();
    await expect(page.getByText(/저신뢰/)).toBeVisible();

    // 유일한 캐릭터를 체크 해제하면 계산 버튼이 비활성화된다 (선택된 캐릭터 없음).
    await page.getByLabel("테스트딜러 포함").click();
    await expect(
      page.getByRole("button", { name: "선택한 캐릭터 계산하기" })
    ).toBeDisabled();
  });
});
