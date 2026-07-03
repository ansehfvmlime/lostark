import { expect, test } from "@playwright/test";

test.describe("계산기 목록", () => {
  test("구현된 계산기와 준비 중인 계산기를 구분해서 보여준다", async ({
    page,
  }) => {
    await page.goto("/calculators");

    await expect(
      page.getByRole("heading", { name: "계산기 목록" })
    ).toBeVisible();
    await expect(page.getByText("재료 구매 비용 계산기")).toBeVisible();
    await expect(page.getByText("콘텐츠 수익 효율 계산기")).toBeVisible();
    // 제공 중/준비 중 계산기가 각각 여러 개이므로 첫 번째만 확인
    await expect(page.getByText("제공 중").first()).toBeVisible();
    await expect(page.getByText("준비 중").first()).toBeVisible();

    // 준비 중 계산기 버튼은 비활성화되어 있어야 한다
    await expect(
      page.getByRole("button", { name: "준비 중" }).first()
    ).toBeDisabled();
  });

  test("제공 중인 계산기를 클릭하면 해당 계산기로 이동한다", async ({
    page,
  }) => {
    await page.goto("/calculators");
    await page
      .getByRole("button", { name: "계산기 열기" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/calculators\/material-cost$/);
  });
});
