import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { ArmoryCard } from "@/lib/lostark/schemas";
import { parseCardCritRateContributions } from "./cards";

const fixturePath = path.resolve(
  __dirname,
  "../../../../../tests/fixtures/character-cards-example.json"
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
const REAL_ARMORY_CARD = fixture.response as ArmoryCard;

describe("parseCardCritRateContributions", () => {
  it("실 fixture(치명타 관련 세트 없음)는 빈 배열을 반환한다", () => {
    expect(parseCardCritRateContributions(REAL_ARMORY_CARD)).toEqual([]);
  });

  it("치명타 적중률이 있는 세트 효과를 감지해 기여를 만든다", () => {
    const armoryCard: ArmoryCard = {
      Effects: [
        {
          Index: 0,
          CardSlots: [0, 1],
          Items: [
            { Name: "테스트 세트", Description: "치명타 적중률이 5.0% 증가한다." },
            { Name: "테스트 세트 (4각성합계)", Description: "받는 피해 3.0% 감소" },
          ],
        },
      ],
    };

    const contributions = parseCardCritRateContributions(armoryCard);
    expect(contributions).toHaveLength(1);
    expect(contributions[0]).toMatchObject({
      sourceType: "CARD",
      sourceName: "테스트 세트",
      applied: true,
      value: 5.0,
    });
  });

  it("armoryCard가 없거나 Effects가 없으면 빈 배열을 반환한다", () => {
    expect(parseCardCritRateContributions(null)).toEqual([]);
    expect(parseCardCritRateContributions({})).toEqual([]);
  });

  it("여러 세트에 걸쳐 치명타 항목을 전부 수집한다", () => {
    const armoryCard: ArmoryCard = {
      Effects: [
        {
          Index: 0,
          CardSlots: [0, 1],
          Items: [
            { Name: "세트A", Description: "치명타 적중률이 5.0% 증가한다." },
          ],
        },
        {
          Index: 1,
          CardSlots: [2, 3],
          Items: [
            { Name: "세트B (6각성합계)", Description: "치명타 적중률이 3.0% 증가한다." },
          ],
        },
      ],
    };

    const contributions = parseCardCritRateContributions(armoryCard);
    expect(contributions.map((c) => c.sourceName)).toEqual(["세트A", "세트B (6각성합계)"]);
  });
});
