import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// 실 API 응답 fixture를 재사용해 결정론적으로 검증한다 (character-search.spec.ts와 동일한
// 이유: 라이브 API에 의존하면 실제 캐릭터 데이터가 바뀔 때 테스트가 흔들린다).
const fixture = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../fixtures/character-profile-example.json"),
    "utf-8"
  )
);

test.describe("치명타 전투 효율 계산기", () => {
  test("치명 스탯 tooltip을 파싱해 치명타 확률과 기대 피해 배율을 계산한다", async ({
    page,
  }) => {
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

    await page.goto("/calculators/combat");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill(fixture.response.CharacterName);
    await page.getByRole("button", { name: "검색" }).click();

    await expect(
      page.getByText(`${fixture.response.CharacterName} 치명타 전투 효율`)
    ).toBeVisible();

    // 치명 스탯 732 → tooltip의 "치명타 적중률이 26.19% 증가합니다"를 그대로 파싱
    await expect(page.getByText("26.19%", { exact: true })).toBeVisible();
    // 기본 치명타 피해 배율 200%
    await expect(page.getByText("200%", { exact: true })).toBeVisible();
    // 기대 피해 배율 = 0.2619*2 + 0.7381*1 = 1.2619 → 126.19%
    await expect(page.getByText("126.19%", { exact: true })).toBeVisible();

    await expect(page.getByText("정확도: 기본(치명 스탯만)")).toBeVisible();
    await expect(page.getByText("반영됨")).toBeVisible();
    await expect(
      page.getByText(/아직 반영되지 않은 기본\(BASIC\) 계산/)
    ).toBeVisible();
  });

  test("치명 스탯이 없는 캐릭터는 0%로 계산하고 경고를 보여준다", async ({
    page,
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Stats만 제거하기 위한 구조 분해
    const { Stats, ...characterWithoutStats } = fixture.response;

    await page.route("**/api/lostark/character/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          character: characterWithoutStats,
          dataTimestamp: "2026-07-03T12:00:00.000Z",
          cacheHit: false,
          sources: [],
        }),
      })
    );

    await page.goto("/calculators/combat");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill(fixture.response.CharacterName);
    await page.getByRole("button", { name: "검색" }).click();

    await expect(page.getByText("0.00%", { exact: true })).toBeVisible();
    await expect(page.getByText("미반영")).toBeVisible();
    await expect(
      page.getByText('"치명" 스탯 정보를 찾을 수 없습니다.').first()
    ).toBeVisible();
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

    await page.goto("/calculators/combat");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill("존재하지않는캐릭터");
    await page.getByRole("button", { name: "검색" }).click();

    await expect(page.getByText("조회 실패")).toBeVisible();
    await expect(
      page.getByText("요청한 캐릭터를 찾을 수 없습니다.")
    ).toBeVisible();
  });
});
