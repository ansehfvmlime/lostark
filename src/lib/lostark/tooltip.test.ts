import { describe, expect, it } from "vitest";

import {
  extractAllPercentsAfterKeyword,
  extractMultiTextBoxText,
  extractPercentAfterKeyword,
  extractPercentFromElementTooltip,
  parseElementTooltip,
  stripTooltipTags,
} from "./tooltip";

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

describe("extractAllPercentsAfterKeyword", () => {
  it("같은 줄에 키워드가 여러 번 나오면 전부 순서대로 반환한다", () => {
    const lines = [
      "치명타 적중률이 20.0% 증가하고, 치명타 적중률이 10.0% 추가로 증가한다.",
    ];
    expect(extractAllPercentsAfterKeyword(lines, "치명타 적중률")).toEqual([
      20.0, 10.0,
    ]);
  });

  it("매치가 없으면 빈 배열을 반환한다", () => {
    expect(extractAllPercentsAfterKeyword(["아무 효과 없음"], "치명타 적중률")).toEqual(
      []
    );
  });
});

describe("parseElementTooltip / extractMultiTextBoxText", () => {
  const rawTooltip =
    '{"Element_000":{"type":"NameTagBox","value":"예리한 감각"},"Element_001":{"type":"CommonSkillTitle","value":{"leftText":"레벨"}},"Element_002":{"type":"MultiTextBox","value":"치명타 적중률이 <FONT COLOR=\'#99ff99\'>4.0% </font>증가하고, 진화형 피해가 <FONT COLOR=\'#99ff99\'>5.0% </font>증가합니다.||<BR>"}}';

  it("JSON-in-string tooltip을 파싱한다", () => {
    const parsed = parseElementTooltip(rawTooltip);
    expect(parsed).not.toBeNull();
    expect(parsed?.Element_000?.value).toBe("예리한 감각");
  });

  it("JSON이 아닌 문자열은 null을 반환한다", () => {
    expect(parseElementTooltip("그냥 평문 문자열")).toBeNull();
  });

  it("빈 객체/배열 JSON은 null을 반환한다 (배열은 Element map이 아니므로 제외)", () => {
    expect(parseElementTooltip("[]")).toBeNull();
  });

  it("MultiTextBox 타입 원소들의 텍스트만 이어붙인다", () => {
    const parsed = parseElementTooltip(rawTooltip)!;
    const text = extractMultiTextBoxText(parsed);
    expect(text).toContain("치명타 적중률이");
    expect(text).toContain("진화형 피해가");
    expect(text).not.toContain("예리한 감각"); // NameTagBox 타입은 제외
  });
});

describe("extractPercentFromElementTooltip", () => {
  const rawTooltip =
    '{"Element_002":{"type":"MultiTextBox","value":"치명타 적중률이 <FONT COLOR=\'#99ff99\'>20.0% </font>증가하고, 방향성 공격 스킬의 치명타 피해가 <FONT COLOR=\'#99ff99\'>32.0% </font>증가한다.||<BR>"}}';

  it("JSON-in-string tooltip에서 키워드 뒤 퍼센트를 추출한다", () => {
    expect(extractPercentFromElementTooltip(rawTooltip, "치명타 적중률")).toBe(
      20.0
    );
  });

  it("JSON 파싱에 실패하면 null을 반환한다", () => {
    expect(
      extractPercentFromElementTooltip("깨진 JSON {", "치명타 적중률")
    ).toBeNull();
  });

  it("키워드가 없으면 null을 반환한다", () => {
    expect(extractPercentFromElementTooltip(rawTooltip, "공격 속도")).toBeNull();
  });
});
