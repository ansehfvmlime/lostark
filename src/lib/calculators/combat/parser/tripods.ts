import { extractPercentAfterKeyword } from "@/lib/lostark/tooltip";
import type { CombatSkill } from "@/lib/lostark/schemas";
import type { EffectContribution } from "@/types/combat";

/**
 * 트라이포드 치명타 적중률 파싱 (docs/COMBAT.md 섹션 4.1).
 *
 * `ArmorySkills[].Tripods[]`에서 **`IsSelected: true`인 트라이포드만** 반영한다.
 * 같은 Tier/Slot 안에서는 하나만 선택 가능하므로, 필터링하지 않으면 미선택 트라이포드
 * 효과까지 전부 합산하는 오류가 난다 (CLAUDE.md 섹션 7.3 "특정 스킬 전용 효과는 해당
 * 스킬의 계산에만 반영").
 */
export type SkillCritRateContribution = EffectContribution & {
  targetSkillName: string;
};

export function parseTripodCritRateContributions(
  skills: CombatSkill[] | null | undefined
): SkillCritRateContribution[] {
  const contributions: SkillCritRateContribution[] = [];

  for (const skill of skills ?? []) {
    for (const tripod of skill.Tripods ?? []) {
      if (!tripod.IsSelected || !tripod.Tooltip) continue;

      const percent = extractPercentAfterKeyword(
        [tripod.Tooltip],
        "치명타 적중률"
      );
      if (percent === null) continue;

      contributions.push({
        sourceType: "TRIPOD",
        sourceName: `${tripod.Name} (${skill.Name})`,
        target: "SKILL",
        targetSkillName: skill.Name,
        stat: "CRIT_RATE",
        value: percent,
        unit: "PERCENT",
        applied: true,
        reason: "선택된 트라이포드 tooltip에서 직접 파싱한 값입니다.",
        confidence: "HIGH",
      });
    }
  }

  return contributions;
}

/** 스킬 이름별로 트라이포드 치명타 적중률 보너스 합계를 묶는다. */
export function groupSkillCritBonusByName(
  contributions: SkillCritRateContribution[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const contribution of contributions) {
    map.set(
      contribution.targetSkillName,
      (map.get(contribution.targetSkillName) ?? 0) + contribution.value
    );
  }
  return map;
}
