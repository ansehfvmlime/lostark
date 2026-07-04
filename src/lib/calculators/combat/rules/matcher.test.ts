import { describe, expect, it } from "vitest";

import type { EffectRule } from "@/types/combat";
import type { ParsedArkPassiveNode } from "../parser/arkPassive";
import { matchArkPassiveCritRules } from "./matcher";

function node(overrides: Partial<ParsedArkPassiveNode> = {}): ParsedArkPassiveNode {
  return {
    category: "진화",
    tier: 2,
    nodeName: "예리한 감각",
    level: 1,
    descriptionText:
      "치명타 적중률이 4.0% 증가하고, 진화형 피해가 5.0% 증가합니다.",
    ...overrides,
  };
}

function rule(overrides: Partial<EffectRule> = {}): EffectRule {
  return {
    id: "test-rule",
    sourceType: "ARK_PASSIVE",
    target: "GLOBAL",
    match: { nameIncludes: ["예리한 감각"] },
    effect: {
      stat: "CRIT_RATE",
      operation: "ADD_PERCENT_POINT",
      valueFrom: "TOOLTIP",
      unit: "PERCENT",
    },
    confidence: "HIGH",
    description: "test",
    verifiedAt: "2026-07-04",
    source: "TOOLTIP_PARSED",
    ...overrides,
  };
}

describe("matchArkPassiveCritRules", () => {
  it("노드 이름이 매칭되면 tooltip에서 값을 파싱해 기여를 만든다", () => {
    const contributions = matchArkPassiveCritRules([node()], [rule()]);

    expect(contributions).toHaveLength(1);
    expect(contributions[0]).toMatchObject({
      applied: true,
      value: 4.0,
      stat: "CRIT_RATE",
    });
  });

  it("매칭되는 노드가 없으면 기여를 만들지 않는다", () => {
    const contributions = matchArkPassiveCritRules(
      [node({ nodeName: "최적화 훈련" })],
      [rule()]
    );
    expect(contributions).toHaveLength(0);
  });

  it("exactName 매칭도 지원한다", () => {
    const contributions = matchArkPassiveCritRules(
      [node({ nodeName: "달인" })],
      [rule({ match: { exactName: "달인" } })]
    );
    expect(contributions).toHaveLength(1);
  });

  it("tooltip에서 값을 파싱하지 못하면 applied:false 기여를 만든다", () => {
    const contributions = matchArkPassiveCritRules(
      [node({ descriptionText: "치명타와 무관한 효과 설명" })],
      [rule()]
    );
    expect(contributions).toHaveLength(1);
    expect(contributions[0]).toMatchObject({ applied: false, value: 0 });
  });

  it("manualToggleRequired 룰은 유지율(%)을 곱해서 반영한다", () => {
    const masterNode = node({
      nodeName: "달인",
      descriptionText:
        "달인 : 치명타 적중률 +1.4% / 추가 피해 +1.7%, 최대 5중첩",
    });
    const masterRule = rule({
      match: { exactName: "달인" },
      condition: { manualToggleRequired: true },
    });

    const noUptime = matchArkPassiveCritRules([masterNode], [masterRule]);
    expect(noUptime[0]?.value).toBe(0); // manualUptimePercent 미지정 시 기본 0%

    const halfUptime = matchArkPassiveCritRules([masterNode], [masterRule], {
      manualUptimePercent: 50,
    });
    expect(halfUptime[0]?.value).toBeCloseTo(0.7, 10); // 1.4% × 50%

    const fullUptime = matchArkPassiveCritRules([masterNode], [masterRule], {
      manualUptimePercent: 100,
    });
    expect(fullUptime[0]?.value).toBeCloseTo(1.4, 10);
  });

  it("manualUptimePercent가 100을 초과하거나 음수면 0~100으로 clamp한다", () => {
    const masterNode = node({
      nodeName: "달인",
      descriptionText: "치명타 적중률 +1.4%",
    });
    const masterRule = rule({
      match: { exactName: "달인" },
      condition: { manualToggleRequired: true },
    });

    const over = matchArkPassiveCritRules([masterNode], [masterRule], {
      manualUptimePercent: 150,
    });
    expect(over[0]?.value).toBeCloseTo(1.4, 10);

    const negative = matchArkPassiveCritRules([masterNode], [masterRule], {
      manualUptimePercent: -10,
    });
    expect(negative[0]?.value).toBe(0);
  });

  it("여러 룰을 동시에 매칭한다", () => {
    const contributions = matchArkPassiveCritRules(
      [
        node({ nodeName: "예리한 감각" }),
        node({
          nodeName: "일격",
          descriptionText:
            "치명타 적중률이 20.0% 증가하고, 방향성 공격 스킬의 치명타 피해가 32.0% 증가한다.",
        }),
      ],
      [
        rule({ match: { nameIncludes: ["예리한 감각"] } }),
        rule({ id: "decisive-blow", match: { nameIncludes: ["일격"] } }),
      ]
    );

    expect(contributions).toHaveLength(2);
    expect(contributions.map((c) => c.value)).toEqual([4.0, 20.0]);
  });
});
