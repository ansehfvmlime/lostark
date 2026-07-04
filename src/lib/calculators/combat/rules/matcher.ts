import { extractPercentAfterKeyword } from "@/lib/lostark/tooltip";
import type { EffectContribution, EffectRule } from "@/types/combat";
import type { ParsedArkPassiveNode } from "../parser/arkPassive";

/**
 * 룰 엔진 매칭 로직 (CLAUDE.md 섹션 7.2). 룰 데이터는 `data/rules/*.json`에 있고,
 * 이 파일은 "파싱된 노드 목록 × 룰 목록 → EffectContribution 목록" 변환만 담당한다.
 */

const STAT_KEYWORD: Partial<Record<EffectRule["effect"]["stat"], string>> = {
  CRIT_RATE: "치명타 적중률",
};

function nodeMatchesRule(node: ParsedArkPassiveNode, rule: EffectRule): boolean {
  if (rule.match.exactName) return node.nodeName === rule.match.exactName;
  if (rule.match.nameIncludes) {
    return rule.match.nameIncludes.some((needle) =>
      node.nodeName.includes(needle)
    );
  }
  return false;
}

export type MatchArkPassiveOptions = {
  /** `condition.manualToggleRequired` 룰에만 적용되는 스택/버프 유지율(%). */
  manualUptimePercent?: number;
};

/**
 * 아크패시브 룰들을 파싱된 노드 목록에 매칭해 EffectContribution 배열을 만든다.
 * 캐릭터가 보유하지 않은(매칭되지 않는) 룰은 기여 자체를 만들지 않는다 — 가능한 모든
 * 룰을 나열하는 것이 아니라 "실제로 감지된 노드"만 반영/미반영으로 표시한다.
 */
export function matchArkPassiveCritRules(
  nodes: ParsedArkPassiveNode[],
  rules: EffectRule[],
  options: MatchArkPassiveOptions = {}
): EffectContribution[] {
  const contributions: EffectContribution[] = [];

  for (const rule of rules) {
    const matchedNode = nodes.find((node) => nodeMatchesRule(node, rule));
    if (!matchedNode) continue;

    const keyword = STAT_KEYWORD[rule.effect.stat];
    const rawValue =
      rule.effect.valueFrom === "TOOLTIP" && keyword
        ? extractPercentAfterKeyword([matchedNode.descriptionText], keyword)
        : (rule.effect.value ?? null);

    const sourceName = `${matchedNode.nodeName} (Lv.${matchedNode.level})`;

    if (rawValue === null) {
      contributions.push({
        sourceType: rule.sourceType,
        sourceName,
        target: rule.target,
        stat: rule.effect.stat,
        value: 0,
        unit: rule.effect.unit,
        applied: false,
        reason: `"${matchedNode.nodeName}" 노드의 tooltip에서 ${
          keyword ?? rule.effect.stat
        } 수치를 파싱하지 못했습니다.`,
        confidence: rule.confidence,
      });
      continue;
    }

    const requiresManualToggle = rule.condition?.manualToggleRequired ?? false;
    const uptimeFraction = requiresManualToggle
      ? Math.min(100, Math.max(0, options.manualUptimePercent ?? 0)) / 100
      : 1;
    const appliedValue = rawValue * uptimeFraction;

    contributions.push({
      sourceType: rule.sourceType,
      sourceName,
      target: rule.target,
      stat: rule.effect.stat,
      value: appliedValue,
      unit: rule.effect.unit,
      applied: true,
      reason: requiresManualToggle
        ? `tooltip 파싱값 ${rawValue}%에 사용자 입력 유지율(${(uptimeFraction * 100).toFixed(
            0
          )}%)을 곱해 반영했습니다.`
        : "아크패시브 노드 tooltip에서 직접 파싱한 값입니다.",
      confidence: rule.confidence,
    });
  }

  return contributions;
}
