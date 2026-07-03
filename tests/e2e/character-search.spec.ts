import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// 실 API 응답 fixture를 그대로 재사용해 API route 응답을 모킹한다.
// 라이브 로스트아크 API에 의존하면 실제 캐릭터 데이터가 바뀌거나 API 점검 시
// 테스트가 흔들리므로(flaky), 여기서는 route mocking으로 결정론적으로 검증한다.
// (실 API 왕복 자체는 src/lib/lostark/client.test.ts와 개발 중 수동 검증으로 커버함)
const fixture = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../fixtures/character-profile-example.json"),
    "utf-8"
  )
);

test.describe("메인 페이지", () => {
  test("캐릭터 검색으로 시작하기 버튼을 누르면 /character로 이동한다", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "로스트아크 효율 계산기" })
    ).toBeVisible();

    await page.getByRole("button", { name: "캐릭터 검색으로 시작하기" }).click();
    await expect(page).toHaveURL(/\/character$/);
  });
});

test.describe("캐릭터 검색", () => {
  test("빈 값으로 제출하면 API를 호출하지 않고 클라이언트 유효성 검사 메시지를 보여준다", async ({
    page,
  }) => {
    let apiCalled = false;
    await page.route("**/api/lostark/character/**", () => {
      apiCalled = true;
    });

    await page.goto("/character");
    await page.getByRole("button", { name: "검색" }).click();

    await expect(page.getByText("캐릭터명을 입력해주세요.")).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test("정상 응답을 받으면 캐릭터 프로필 카드를 표시한다", async ({ page }) => {
    await page.route("**/api/lostark/character/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          character: fixture.response,
          dataTimestamp: "2026-07-03T12:00:00.000Z",
          cacheHit: false,
          sources: [
            {
              field: "character",
              origin: "API",
              fetchedAt: "2026-07-03T12:00:00.000Z",
            },
          ],
        }),
      })
    );

    await page.goto("/character");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill(fixture.response.CharacterName);
    await page.getByRole("button", { name: "검색" }).click();

    await expect(
      page.getByText(fixture.response.CharacterName, { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(fixture.response.CharacterClassName)
    ).toBeVisible();
    await expect(page.getByText(/Lv\.\d+/)).toBeVisible();
    await expect(page.getByText("계산 근거 보기")).toBeVisible();
  });

  test("존재하지 않는 캐릭터(404)는 조회 실패 메시지를 보여준다", async ({
    page,
  }) => {
    await page.route("**/api/lostark/character/**", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "요청한 캐릭터를 찾을 수 없습니다." }),
      })
    );

    await page.goto("/character");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill("존재하지않는캐릭터");
    await page.getByRole("button", { name: "검색" }).click();

    await expect(page.getByText("조회 실패")).toBeVisible();
    await expect(
      page.getByText("요청한 캐릭터를 찾을 수 없습니다.")
    ).toBeVisible();
  });

  test("점검/장애 응답(503)은 점검 안내 메시지를 보여준다", async ({ page }) => {
    await page.route("**/api/lostark/character/**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "현재 로스트아크 API 서버가 점검 중이거나 응답하지 않습니다. 잠시 후 다시 시도해주세요.",
        }),
      })
    );

    await page.goto("/character");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill("아무개");
    await page.getByRole("button", { name: "검색" }).click();

    await expect(page.getByText(/점검 중이거나 응답하지 않습니다/)).toBeVisible();
  });

  test("요청이 많을 때(429)는 재시도 안내 메시지를 보여준다", async ({
    page,
  }) => {
    await page.route("**/api/lostark/character/**", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        }),
      })
    );

    await page.goto("/character");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill("아무개");
    await page.getByRole("button", { name: "검색" }).click();

    await expect(page.getByText("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")).toBeVisible();
  });
});
