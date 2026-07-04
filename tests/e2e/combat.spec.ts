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
const arkPassiveFixture = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../fixtures/character-arkpassive-example.json"),
    "utf-8"
  )
);

// 프로필 route(`.../character/{name}`)와 아크패시브 route(`.../character/{name}/arkpassive`)를
// 구분해서 mock한다. glob의 `*`는 `/`를 넘어가지 않으므로 두 패턴은 서로 겹치지 않는다.
function routeProfile(page: import("@playwright/test").Page, character: unknown) {
  return page.route("**/api/lostark/character/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        character,
        dataTimestamp: "2026-07-03T12:00:00.000Z",
        cacheHit: false,
        sources: [],
      }),
    })
  );
}

function routeArkPassive(
  page: import("@playwright/test").Page,
  effects: unknown[]
) {
  return page.route("**/api/lostark/character/*/arkpassive", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        arkPassive: { Title: "테스트", IsArkPassive: true, Points: [], Effects: effects },
        dataTimestamp: "2026-07-03T12:00:00.000Z",
        cacheHit: false,
        sources: [],
      }),
    })
  );
}

test.describe("치명타 전투 효율 계산기", () => {
  test("치명 스탯 tooltip을 파싱해 치명타 확률과 기대 피해 배율을 계산한다 (아크패시브 노드 없음)", async ({
    page,
  }) => {
    await routeProfile(page, fixture.response);
    await routeArkPassive(page, []);

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

    // 아크패시브 응답은 왔지만 치명타 관련 노드가 없어 반영된 기여가 없다 —
    // 그래도 아크패시브 데이터를 시도했으므로 정확도는 "일부 룰 반영"이다.
    await expect(page.getByText("정확도: 일부 룰 반영").first()).toBeVisible();
    await expect(page.getByText("반영됨")).toBeVisible();
  });

  test("아크패시브 진화 노드(예리한 감각/일격/달인)가 반영되고 달인 유지율 입력으로 재계산된다", async ({
    page,
  }) => {
    await routeProfile(page, fixture.response);
    await routeArkPassive(page, arkPassiveFixture.response.Effects);

    await page.goto("/calculators/combat");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill(fixture.response.CharacterName);
    await page.getByRole("button", { name: "검색" }).click();

    await expect(
      page.getByText(`${fixture.response.CharacterName} 치명타 전투 효율`)
    ).toBeVisible();

    // 26.19(치명 스탯) + 4.0(예리한 감각) + 20.0(일격) + 0(달인, 유지율 미입력) = 50.19
    await expect(page.getByText("50.19%", { exact: true })).toBeVisible();
    await expect(page.getByText("예리한 감각 (Lv.1)")).toBeVisible();
    await expect(page.getByText("일격 (Lv.2)")).toBeVisible();
    await expect(page.getByText("달인 (Lv.1)")).toBeVisible();

    // 달인 유지율 입력 필드가 나타나고, 100으로 바꾸면 재계산된다.
    const uptimeInput = page.getByLabel(/달인 스택 유지율/);
    await expect(uptimeInput).toBeVisible();
    await uptimeInput.fill("100");

    // 26.19 + 4.0 + 20.0 + 1.4(달인 100% 유지) = 51.59
    await expect(page.getByText("51.59%", { exact: true })).toBeVisible();
  });

  test("치명타 확률이 뭉툭한 가시 상한(80%)을 넘으면 초과분이 진화형 피해로 표시된다", async ({
    page,
  }) => {
    const highCritCharacter = {
      ...fixture.response,
      Stats: [
        {
          Type: "치명",
          Value: "9999",
          Tooltip: ["치명타 적중률이 95.00% 증가합니다."],
        },
      ],
    };
    await routeProfile(page, highCritCharacter);
    await routeArkPassive(page, arkPassiveFixture.response.Effects);

    await page.goto("/calculators/combat");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill(fixture.response.CharacterName);
    await page.getByRole("button", { name: "검색" }).click();

    // raw = 95 + 4.0 + 20.0 = 119 → 80% 상한
    await expect(page.getByText("80.00%", { exact: true })).toBeVisible();
    await expect(page.getByText(/상한 80%/)).toBeVisible();
    // 초과분 39% × 150% = 58.5%
    await expect(page.getByText("+58.50%", { exact: true })).toBeVisible();
    await expect(page.getByText(/뭉툭한 가시/).first()).toBeVisible();
  });

  test("치명 스탯이 없는 캐릭터는 0%로 계산하고 경고를 보여준다", async ({
    page,
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Stats만 제거하기 위한 구조 분해
    const { Stats, ...characterWithoutStats } = fixture.response;

    await routeProfile(page, characterWithoutStats);
    await routeArkPassive(page, []);

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
    await page.route("**/api/lostark/character/*", (route) =>
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
