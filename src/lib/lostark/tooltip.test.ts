import { describe, expect, it } from "vitest";

import { extractPercentAfterKeyword, stripTooltipTags } from "./tooltip";

describe("stripTooltipTags", () => {
  it("textformat/font 태그를 제거하고 텍스트만 남긴다", () => {
    const raw =
      "<textformat indent='-21' leftMargin='10'><font> </font> 치명타 적중률이 <font color='#99ff99'>26.19%</font> 증가합니다.</textformat>";
    expect(stripTooltipTags(raw)).toBe("치명타 적중률이 26.19% 증가합니다.");
  });

  it("태그가 없는 문자열은 그대로(트림만) 반환한다", () => {
    expect(stripTooltipTags("  그냥 텍스트  ")).toBe("그냥 텍스트");
  });
});

describe("extractPercentAfterKeyword", () => {
  it('"키워드이 N% 증가합니다" 문구에서 퍼센트를 추출한다', () => {
    const lines = [
      "<textformat><font> </font> 치명타 적중률이 <font color='#99ff99'>26.19%</font> 증가합니다.</textformat>",
    ];
    expect(extractPercentAfterKeyword(lines, "치명타 적중률")).toBe(26.19);
  });

  it('조사가 "가"인 경우도 매치한다', () => {
    const lines = ["공격 속도가 19.36% 증가합니다."];
    expect(extractPercentAfterKeyword(lines, "공격 속도")).toBe(19.36);
  });

  it("정수 퍼센트도 매치한다", () => {
    expect(
      extractPercentAfterKeyword(["치명타 적중률이 30% 증가합니다."], "치명타 적중률")
    ).toBe(30);
  });

  it("키워드가 없는 줄들 중에서는 null을 반환한다", () => {
    const lines = [
      "물리 방어력이 5.80% 증가합니다.",
      "마법 방어력이 5.80% 증가합니다.",
    ];
    expect(extractPercentAfterKeyword(lines, "치명타 적중률")).toBeNull();
  });

  it("여러 줄 중 키워드가 있는 줄만 찾는다", () => {
    const lines = [
      "물약 및 원정대 레벨 보상 효과로 32만큼 영구적으로 증가되었습니다.",
      "치명타 적중률이 10.5% 증가합니다.",
      "카드 도감 누적 효과가 반영된 값입니다.",
    ];
    expect(extractPercentAfterKeyword(lines, "치명타 적중률")).toBe(10.5);
  });

  it("빈 배열이면 null을 반환한다", () => {
    expect(extractPercentAfterKeyword([], "치명타 적중률")).toBeNull();
  });
});
