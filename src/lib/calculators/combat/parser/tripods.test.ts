import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { CombatSkill } from "@/lib/lostark/schemas";
import {
  groupSkillCritBonusByName,
  parseTripodCritRateContributions,
} from "./tripods";

const fixturePath = path.resolve(
  __dirname,
  "../../../../../tests/fixtures/character-combat-skills-example.json"
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
const REAL_SKILLS = fixture.response as CombatSkill[];

describe("parseTripodCritRateContributions (실 fixture)", () => {
  it("이 캐릭터는 치명타 트라이포드를 선택하지 않아 기여가 없다", () => {
    // 삼연권의 "암흑 공격"(+40%), 격호각의 "급소타격"(+40%) 모두 IsSelected: false.
    expect(parseTripodCritRateContributions(REAL_SKILLS)).toEqual([]);
  });
});

describe("parseTripodCritRateContributions (선택된 트라이포드, 합성 데이터)", () => {
  it("IsSelected:true인 치명타 트라이포드만 반영한다", () => {
    const skills: CombatSkill[] = [
      {
        Name: "삼연권",
        Level: 1,
        Type: "일반",
        Tripods: [
          {
            Tier: 0,
            Slot: 1,
            Name: "암흑 공격",
            IsSelected: true,
            Tooltip:
              "<font>[암] 속성으로 변경되고 공격의 치명타 적중률이 <FONT COLOR='#99ff99'>40.0%</FONT> 증가한다.</font>",
          },
          {
            Tier: 0,
            Slot: 2,
            Name: "화염 공격",
            IsSelected: true,
            Tooltip: "<font>적에게 주는 피해가 40.0% 증가한다.</font>",
          },
        ],
      },
    ];

    const contributions = parseTripodCritRateContributions(skills);
    expect(contributions).toHaveLength(1);
    expect(contributions[0]).toMatchObject({
      sourceType: "TRIPOD",
      target: "SKILL",
      targetSkillName: "삼연권",
      value: 40.0,
      applied: true,
    });
  });

  it("IsSelected:false인 트라이포드는 치명타 옵션이 있어도 무시한다", () => {
    const skills: CombatSkill[] = [
      {
        Name: "격호각",
        Level: 14,
        Type: "콤보",
        Tripods: [
          {
            Tier: 0,
            Slot: 3,
            Name: "급소타격",
            IsSelected: false,
            Tooltip: "<font>치명타 적중률이 40.0% 증가한다.</font>",
          },
        ],
      },
    ];
    expect(parseTripodCritRateContributions(skills)).toEqual([]);
  });

  it("여러 스킬에서 각각의 치명타 트라이포드를 독립적으로 수집한다", () => {
    const skills: CombatSkill[] = [
      {
        Name: "스킬A",
        Level: 1,
        Type: "일반",
        Tripods: [
          {
            Tier: 0,
            Slot: 1,
            Name: "트라이포드A",
            IsSelected: true,
            Tooltip: "<font>치명타 적중률이 10.0% 증가한다.</font>",
          },
        ],
      },
      {
        Name: "스킬B",
        Level: 1,
        Type: "일반",
        Tripods: [
          {
            Tier: 0,
            Slot: 1,
            Name: "트라이포드B",
            IsSelected: true,
            Tooltip: "<font>치명타 적중률이 15.0% 증가한다.</font>",
          },
        ],
      },
    ];

    const contributions = parseTripodCritRateContributions(skills);
    expect(contributions).toHaveLength(2);
    expect(contributions.map((c) => c.targetSkillName)).toEqual([
      "스킬A",
      "스킬B",
    ]);
  });

  it("빈 입력/undefined는 빈 배열을 반환한다", () => {
    expect(parseTripodCritRateContributions(undefined)).toEqual([]);
    expect(parseTripodCritRateContributions([])).toEqual([]);
  });
});

describe("groupSkillCritBonusByName", () => {
  it("같은 스킬의 여러 트라이포드 기여를 합산한다", () => {
    const map = groupSkillCritBonusByName([
      {
        sourceType: "TRIPOD",
        sourceName: "a",
        target: "SKILL",
        targetSkillName: "스킬A",
        stat: "CRIT_RATE",
        value: 10,
        unit: "PERCENT",
        applied: true,
        reason: "",
        confidence: "HIGH",
      },
      {
        sourceType: "TRIPOD",
        sourceName: "b",
        target: "SKILL",
        targetSkillName: "스킬A",
        stat: "CRIT_RATE",
        value: 5,
        unit: "PERCENT",
        applied: true,
        reason: "",
        confidence: "HIGH",
      },
    ]);
    expect(map.get("스킬A")).toBe(15);
  });

  it("입력이 없으면 빈 Map을 반환한다", () => {
    expect(groupSkillCritBonusByName([]).size).toBe(0);
  });
});
