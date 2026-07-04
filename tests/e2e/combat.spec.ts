import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// 실 API 응답 fixture를 재사용해 결정론적으로 검증한다 (character-search.spec.ts와 동일한
// 이유: 라이브 API에 의존하면 실제 캐릭터 데이터가 바뀔 때 테스트가 흔들린다).
function loadFixture(name: string) {
  return JSON.parse(
    readFileSync(path.resolve(__dirname, `../fixtures/${name}`), "utf-8")
  );
}

const fixture = loadFixture("character-profile-example.json");
const arkPassiveFixture = loadFixture("character-arkpassive-example.json");
const equipmentFixture = loadFixture("character-equipment-example.json");

// 각 armory 하위 route를 구분해서 mock한다. glob의 `*`는 `/`를 넘어가지 않으므로
// `.../character/{name}`과 `.../character/{name}/xxx` 패턴은 서로 겹치지 않는다.
function routeProfile(page: Page, character: unknown) {
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

function routeArkPassive(page: Page, effects: unknown[]) {
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

function routeCards(page: Page, armoryCard: unknown) {
  return page.route("**/api/lostark/character/*/cards", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        armoryCard,
        dataTimestamp: "2026-07-03T12:00:00.000Z",
        cacheHit: false,
        sources: [],
      }),
    })
  );
}

function routeEquipment(page: Page, equipment: unknown[]) {
  return page.route("**/api/lostark/character/*/equipment", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        equipment,
        dataTimestamp: "2026-07-03T12:00:00.000Z",
        cacheHit: false,
        sources: [],
      }),
    })
  );
}

function routeCombatSkills(page: Page, skills: unknown[]) {
  return page.route("**/api/lostark/character/*/combat-skills", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        skills,
        dataTimestamp: "2026-07-03T12:00:00.000Z",
        cacheHit: false,
        sources: [],
      }),
    })
  );
}

async function routeAllArmory(
  page: Page,
  options: {
    character: unknown;
    arkPassiveEffects?: unknown[];
    cards?: unknown;
    equipment?: unknown[];
    skills?: unknown[];
  }
) {
  await routeProfile(page, options.character);
  await routeArkPassive(page, options.arkPassiveEffects ?? []);
  await routeCards(page, options.cards ?? { Effects: [] });
  await routeEquipment(page, options.equipment ?? []);
  await routeCombatSkills(page, options.skills ?? []);
}

test.describe("치명타 전투 효율 계산기", () => {
  test("치명 스탯 tooltip을 파싱해 치명타 확률과 기대 피해 배율을 계산한다 (추가 데이터 없음)", async ({
    page,
  }) => {
    await routeAllArmory(page, { character: fixture.response });

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

    // 4개 armory 섹션을 모두 시도했으므로 accuracyLevel은 FULL_CLASS_RULES다
    // (반영된 치명타 관련 효과가 없어도 "시도"했다는 사실 자체로 등급이 오른다).
    await expect(
      page.getByText("정확도: 아크패시브/카드/팔찌/트라이포드 반영").first()
    ).toBeVisible();
    await expect(page.getByText("반영됨")).toBeVisible();
  });

  test("아크패시브 진화 노드(예리한 감각/일격/달인)가 반영되고 달인 유지율 입력으로 재계산된다", async ({
    page,
  }) => {
    await routeAllArmory(page, {
      character: fixture.response,
      arkPassiveEffects: arkPassiveFixture.response.Effects,
    });

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
    await routeAllArmory(page, {
      character: highCritCharacter,
      arkPassiveEffects: arkPassiveFixture.response.Effects,
    });

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

  test("카드 세트/팔찌/트라이포드/파티 시너지를 종합 반영한다", async ({
    page,
  }) => {
    const cardsWithCrit = {
      Effects: [
        {
          Index: 0,
          CardSlots: [0, 1],
          Items: [
            { Name: "테스트 세트", Description: "치명타 적중률이 5.0% 증가한다." },
          ],
        },
      ],
    };
    const skillsWithSelectedTripod = [
      {
        Name: "테스트 스킬",
        Level: 1,
        Type: "일반",
        Tripods: [
          {
            Tier: 0,
            Slot: 1,
            Name: "테스트 트라이포드",
            IsSelected: true,
            Tooltip: "<font>치명타 적중률이 10.0% 증가한다.</font>",
          },
        ],
      },
    ];

    await routeAllArmory(page, {
      character: fixture.response,
      arkPassiveEffects: arkPassiveFixture.response.Effects,
      cards: cardsWithCrit,
      equipment: equipmentFixture.response,
      skills: skillsWithSelectedTripod,
    });

    await page.goto("/calculators/combat");
    await page
      .getByPlaceholder("캐릭터명을 입력하세요 (예: 유우시)")
      .fill(fixture.response.CharacterName);
    await page.getByRole("button", { name: "검색" }).click();

    // 26.19(치명) + 24.0(예리한 감각+일격) + 5.0(카드) + 3.4(팔찌) = 58.59 (파티 시너지 전)
    await expect(page.getByText("58.59%", { exact: true })).toBeVisible();
    await expect(page.getByText("테스트 세트")).toBeVisible();
    await expect(page.getByText("찬란한 구원자의 팔찌")).toBeVisible();

    // 스킬별 breakdown 표: 58.59 + 10.0 = 68.59
    await expect(page.getByText("테스트 스킬").first()).toBeVisible();
    await expect(page.getByText("68.59%", { exact: true })).toBeVisible();

    // 파티 시너지 체크박스 선택 → +10%
    await page.getByText("스트라이커 · 오의난무 / 일격필살 (+10%)").click();
    // 58.59 + 10(파티 시너지) = 68.59 (전역), 스킬별은 68.59 + 10 = 78.59
    await expect(page.getByText("78.59%", { exact: true })).toBeVisible();
  });

  test("치명 스탯이 없는 캐릭터는 0%로 계산하고 경고를 보여준다", async ({
    page,
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Stats만 제거하기 위한 구조 분해
    const { Stats, ...characterWithoutStats } = fixture.response;

    await routeAllArmory(page, { character: characterWithoutStats });

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
