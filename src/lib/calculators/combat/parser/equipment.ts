import {
  extractItemPartBoxText,
  extractPercentAfterKeyword,
  parseElementTooltip,
} from "@/lib/lostark/tooltip";
import type { EquipmentItem } from "@/lib/lostark/schemas";
import type { EffectContribution } from "@/types/combat";

/**
 * 팔찌 치명타 적중률 옵션 파싱 (docs/COMBAT.md 섹션 2.8).
 *
 * 팔찌는 `ArmoryEquipment[]`의 `Type: "팔찌"` 원소다. 다른 장비처럼 `MultiTextBox`가
 * 아니라 `ItemPartBox` 타입 원소(제목 "팔찌 효과")의 중첩된 값 안에 옵션 텍스트가
 * 들어있다 (실 API 응답으로 확인, docs/API_NOTES.md 참고).
 */
const BRACELET_TYPE = "팔찌";
const BRACELET_EFFECT_TITLE = "팔찌 효과";

export function parseBraceletCritRateContribution(
  equipment: EquipmentItem[] | null | undefined
): EffectContribution | null {
  const bracelet = equipment?.find((item) => item.Type === BRACELET_TYPE);
  if (!bracelet) return null;

  const base = {
    sourceType: "BRACELET" as const,
    sourceName: bracelet.Name,
    target: "GLOBAL" as const,
    stat: "CRIT_RATE" as const,
    unit: "PERCENT" as const,
    confidence: "HIGH" as const,
  };

  const parsedTooltip = parseElementTooltip(bracelet.Tooltip);
  if (!parsedTooltip) {
    return {
      ...base,
      value: 0,
      applied: false,
      reason: "팔찌 tooltip을 해석하지 못했습니다.",
    };
  }

  const effectText = extractItemPartBoxText(parsedTooltip, BRACELET_EFFECT_TITLE);
  if (!effectText) {
    return {
      ...base,
      value: 0,
      applied: false,
      reason: '팔찌 tooltip에서 "팔찌 효과" 섹션을 찾지 못했습니다.',
    };
  }

  const percent = extractPercentAfterKeyword([effectText], "치명타 적중률");
  if (percent === null) {
    return {
      ...base,
      value: 0,
      applied: false,
      reason: "이 팔찌에는 치명타 적중률 옵션이 감지되지 않았습니다.",
    };
  }

  return {
    ...base,
    value: percent,
    applied: true,
    reason: "팔찌 tooltip에서 직접 파싱한 값입니다.",
  };
}
