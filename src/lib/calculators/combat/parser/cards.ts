import { extractPercentAfterKeyword } from "@/lib/lostark/tooltip";
import type { ArmoryCard } from "@/lib/lostark/schemas";
import type { EffectContribution } from "@/types/combat";

/**
 * 카드 세트 효과 파싱 (docs/COMBAT.md 섹션 5).
 *
 * `ArmoryCard.Effects[].Items[]`는 캐릭터의 현재 각성 합계 기준으로 이미 활성화된
 * 임계값만 담고 있음을 실 API 응답으로 확인했다(예: 카드 3장 각 5각성 = 합계 15 →
 * "(15각성합계)"까지만 나열). 따라서 별도의 각성 합계 계산 없이 `Items[]` 전체를
 * "현재 적용 중"으로 취급해 치명타 적중률 문구가 있는 항목만 골라낸다.
 */
export function parseCardCritRateContributions(
  armoryCard: ArmoryCard | null | undefined
): EffectContribution[] {
  const items = (armoryCard?.Effects ?? []).flatMap(
    (effect) => effect.Items ?? []
  );

  const contributions: EffectContribution[] = [];
  for (const item of items) {
    const percent = extractPercentAfterKeyword(
      [item.Description],
      "치명타 적중률"
    );
    if (percent === null) continue;

    contributions.push({
      sourceType: "CARD",
      sourceName: item.Name,
      target: "GLOBAL",
      stat: "CRIT_RATE",
      value: percent,
      unit: "PERCENT",
      applied: true,
      reason: "카드 세트 효과 설명에서 직접 파싱한 값입니다.",
      confidence: "HIGH",
    });
  }

  return contributions;
}
