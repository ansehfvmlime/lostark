import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { ArkPassiveEffect } from "@/lib/lostark/schemas";
import {
  detectBluntThornEvolution,
  parseArkPassiveEffect,
  parseArkPassiveEffects,
} from "./arkPassive";

const fixturePath = path.resolve(
  __dirname,
  "../../../../../tests/fixtures/character-arkpassive-example.json"
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
const REAL_EFFECTS = fixture.response.Effects as ArkPassiveEffect[];

function findParsedNode(name: string) {
  return parseArkPassiveEffects(REAL_EFFECTS).find((node) =>
    node.nodeName.includes(name)
  );
}

describe("parseArkPassiveEffect", () => {
  it("Description에서 카테고리/티어/이름/레벨을 뽑는다 (실 fixture: 예리한 감각)", () => {
    const raw = REAL_EFFECTS.find((e) => e.Description.includes("예리한 감각"))!;
    const parsed = parseArkPassiveEffect(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.category).toBe("진화");
    expect(parsed?.tier).toBe(2);
    expect(parsed?.nodeName).toBe("예리한 감각");
    expect(parsed?.level).toBe(1);
    expect(parsed?.descriptionText).toContain("치명타 적중률이");
  });

  it("Description 형식이 예상과 다르면 null을 반환한다", () => {
    const parsed = parseArkPassiveEffect({
      Name: "진화",
      Description: "이상한 형식의 설명",
      ToolTip: '{"Element_002":{"type":"MultiTextBox","value":"아무 효과"}}',
    });
    expect(parsed).toBeNull();
  });

  it("ToolTip이 JSON 파싱에 실패하면 null을 반환한다", () => {
    const parsed = parseArkPassiveEffect({
      Name: "진화",
      Description: "진화 2티어 예리한 감각 Lv.1",
      ToolTip: "깨진 JSON {",
    });
    expect(parsed).toBeNull();
  });
});

describe("parseArkPassiveEffects (실 fixture 회귀)", () => {
  it("실 fixture의 모든 노드를 파싱한다", () => {
    const parsed = parseArkPassiveEffects(REAL_EFFECTS);
    expect(parsed.length).toBe(REAL_EFFECTS.length);
  });

  it("예리한 감각 Lv.1의 효과 설명에 치명타 적중률 4.0%가 들어있다", () => {
    const node = findParsedNode("예리한 감각");
    expect(node?.level).toBe(1);
    expect(node?.descriptionText).toContain("4.0%");
  });

  it("일격 Lv.2의 효과 설명에 치명타 적중률 20.0%가 들어있다", () => {
    const node = findParsedNode("일격");
    expect(node?.level).toBe(2);
    expect(node?.descriptionText).toContain("20.0%");
  });

  it("달인 Lv.1의 효과 설명에 치명타 적중률 +1.4%/5중첩이 들어있다", () => {
    const node = findParsedNode("달인");
    expect(node?.level).toBe(1);
    expect(node?.descriptionText).toContain("1.4%");
    expect(node?.descriptionText).toContain("5중첩");
  });
});

describe("detectBluntThornEvolution (실 fixture 회귀)", () => {
  it("뭉툭한 가시 노드에서 상한/전환비율/전환상한을 정확히 파싱한다", () => {
    const parsed = parseArkPassiveEffects(REAL_EFFECTS);
    const info = detectBluntThornEvolution(parsed);

    expect(info).not.toBeNull();
    expect(info?.capPercent).toBe(80.0);
    expect(info?.conversionRatePercent).toBe(150.0);
    expect(info?.conversionCapPercent).toBe(75.0);
    expect(info?.sourceName).toContain("뭉툭한 가시");
  });

  it("노드가 없으면 null을 반환한다", () => {
    expect(detectBluntThornEvolution([])).toBeNull();
  });

  it("문구가 예상과 다르면(파싱 실패) null을 반환한다", () => {
    const nodes = [
      {
        category: "진화",
        tier: 5,
        nodeName: "뭉툭한 가시",
        level: 1,
        descriptionText: "알 수 없는 새 문구",
      },
    ];
    expect(detectBluntThornEvolution(nodes)).toBeNull();
  });
});
