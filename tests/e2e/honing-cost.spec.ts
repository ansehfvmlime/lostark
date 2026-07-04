import { expect, test, type Page } from "@playwright/test";

// Base UI Input(type=number)은 Playwright의 fill()이 기존 값을 지우지 않고 뒤에
// 이어붙이는 경우가 있어(예: 기본값 "10" + "50" → "1050"), 항상 먼저 빈 문자열로
// 지운 뒤 채운다.
async function fillNumberField(page: Page, label: RegExp, value: string) {
  const field = page.getByLabel(label);
  await field.fill("");
  await field.fill(value);
}

test.describe("강화/재련 기대 비용 계산기", () => {
  test("입력값으로 기대 비용/최악 확정 비용/percentile 비용을 계산한다", async ({
    page,
  }) => {
    await page.goto("/calculators/honing-cost");

    await fillNumberField(page, /기본 성공 확률/, "50");
    await fillNumberField(page, /실패 시 확률 증가폭/, "10");
    await fillNumberField(page, /시도당 장인의 기운 축적량/, "25");
    await fillNumberField(page, /장인의 기운 임계값/, "100");
    await fillNumberField(page, /시도 1회당 재료 비용/, "100");
    await fillNumberField(page, /보수적 시나리오 백분위수/, "90");

    await page.getByRole("button", { name: "계산하기" }).click();

    await expect(page.getByText("강화/재련 기대 비용 계산 결과")).toBeVisible();

    // E[N] = 1*0.5+2*0.3+3*0.14+4*0.06 = 1.76 → 기대 비용 176골드
    await expect(page.getByText("176 골드")).toBeVisible();
    await expect(page.getByText("기대 시도 횟수: 1.76회")).toBeVisible();

    // 장인의 기운 천장(4회차) 확정 비용 = 4 × 100 = 400골드
    await expect(page.getByText("400 골드")).toBeVisible();
    await expect(page.getByText(/장인의 기운 천장 \(4회차 확정\)/)).toBeVisible();

    // 상위 90% 시나리오는 누적확률 0.94를 넘는 3회차 = 300골드
    await expect(page.getByText("300 골드")).toBeVisible();
    await expect(page.getByText(/상위 90% 시나리오 \(3회차\)/)).toBeVisible();

    await expect(page.getByText("계산 근거 보기")).toBeVisible();
  });

  test("0 이하의 장인의 기운 축적량은 유효성 검사 오류를 보여준다", async ({
    page,
  }) => {
    await page.goto("/calculators/honing-cost");

    await fillNumberField(page, /시도당 장인의 기운 축적량/, "0");
    await page.getByRole("button", { name: "계산하기" }).click();

    await expect(
      page.getByText("강화/재련 기대 비용 계산 결과")
    ).not.toBeVisible();
  });
});
