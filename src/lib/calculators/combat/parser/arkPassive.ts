import { extractMultiTextBoxText, parseElementTooltip, stripTooltipTags } from "@/lib/lostark/tooltip";
import type { ArkPassiveEffect } from "@/lib/lostark/schemas";

/**
 * ArkPassive.Effects[] 파싱 전용 (CLAUDE.md 섹션 8 Parser Strategy).
 *
 * `Description`은 "<FONT ...>진화</FONT> 2티어 <FONT ...>예리한 감각 Lv.1</FONT>"
 * 형태다 (실 API 응답으로 확인, docs/API_NOTES.md 참고). 여기서 카테고리(진화/깨달음/
 * 도약)·티어·노드 이름·레벨을 뽑고, `ToolTip`(JSON-in-string)에서 효과 설명 평문을
 * 뽑아 하나의 구조로 합친다. `Description` 형식이 예상과 다르거나 `ToolTip` JSON
 * 파싱에 실패하면 해당 노드는 건너뛰고 호출부에서 warnings로 남길 수 있도록 null을
 * 반환한다(계산 전체를 죽이지 않는다).
 */

export type ParsedArkPassiveNode = {
  /** "진화" | "깨달음" | "도약" */
  category: string;
  tier: number;
  nodeName: string;
  level: number;
  /** ToolTip에서 뽑은 효과 설명 평문 (태그 제거 전, extractPercentAfterKeyword로 바로 사용 가능) */
  descriptionText: string;
};

const DESCRIPTION_PATTERN = /^(\S+)\s*(\d+)티어\s*(.+?)\s*Lv\.(\d+)$/;

export function parseArkPassiveEffect(
  effect: ArkPassiveEffect
): ParsedArkPassiveNode | null {
  const plainDescription = stripTooltipTags(effect.Description);
  const match = plainDescription.match(DESCRIPTION_PATTERN);
  if (!match) return null;

  const [, category, tierStr, nodeName, levelStr] = match;

  const parsedTooltip = parseElementTooltip(effect.ToolTip);
  if (!parsedTooltip) return null;

  const descriptionText = extractMultiTextBoxText(parsedTooltip);
  if (!descriptionText) return null;

  return {
    category: category!,
    tier: Number(tierStr),
    nodeName: nodeName!,
    level: Number(levelStr),
    descriptionText,
  };
}

/** 파싱 실패한 원소는 제외하고 성공한 것만 반환한다. */
export function parseArkPassiveEffects(
  effects: ArkPassiveEffect[]
): ParsedArkPassiveNode[] {
  return effects
    .map((effect) => parseArkPassiveEffect(effect))
    .filter((node): node is ParsedArkPassiveNode => node !== null);
}

/**
 * 아크패시브 진화 5티어 "뭉툭한 가시" — 치명타 확률 상한을 낮추고 초과분을 진화형
 * 피해로 전환하는 "계산 모드 스위치" (docs/COMBAT.md 섹션 2.5, 6.3). 일반
 * EffectRule(ADD_PERCENT_POINT)로 표현할 수 없어 전용 파서로 분리했다.
 */
export type BluntThornEvolutionInfo = {
  /** 치명타 확률 상한 (%). tooltip 원문 기준 80.0 */
  capPercent: number;
  /** 상한 초과분 중 진화형 피해로 전환되는 비율 (%). tooltip 원문 기준 150.0 */
  conversionRatePercent: number;
  /** 이 노드로 인한 진화형 피해 전환의 상한 (%). tooltip 원문 기준 75.0 */
  conversionCapPercent: number;
  sourceName: string;
};

const BLUNT_THORN_CAP_PATTERN = /치명타가 발생할 확률이 최대\s*([0-9]+(?:\.[0-9]+)?)%\s*로 제한/;
const BLUNT_THORN_CONVERSION_RATE_PATTERN =
  /초과한 모든 치명타가 발생할 확률의\s*([0-9]+(?:\.[0-9]+)?)%가 진화형 피해로 전환/;
const BLUNT_THORN_CONVERSION_CAP_PATTERN =
  /이 노드에 의한 진화형 피해는 최대\s*([0-9]+(?:\.[0-9]+)?)%까지 적용/;

/**
 * 뭉툭한 가시 노드를 감지하고 세 수치(상한/전환비율/전환상한)를 tooltip에서 직접
 * 파싱한다. 노드가 없으면 null. 노드는 있으나 세 수치 중 하나라도 파싱에 실패하면
 * (문구가 예상과 달라진 패치 등) 안전하게 null을 반환해 이 계산 모드를 켜지 않는다
 * — 불확실한 상태로 상한/전환을 적용하지 않는다(CLAUDE.md 섹션 2).
 */
export function detectBluntThornEvolution(
  nodes: ParsedArkPassiveNode[]
): BluntThornEvolutionInfo | null {
  const node = nodes.find((candidate) => candidate.nodeName.includes("뭉툭한 가시"));
  if (!node) return null;

  const plain = stripTooltipTags(node.descriptionText);
  const capMatch = plain.match(BLUNT_THORN_CAP_PATTERN);
  const rateMatch = plain.match(BLUNT_THORN_CONVERSION_RATE_PATTERN);
  const conversionCapMatch = plain.match(BLUNT_THORN_CONVERSION_CAP_PATTERN);

  if (!capMatch || !rateMatch || !conversionCapMatch) return null;

  return {
    capPercent: Number(capMatch[1]),
    conversionRatePercent: Number(rateMatch[1]),
    conversionCapPercent: Number(conversionCapMatch[1]),
    sourceName: `${node.nodeName} (Lv.${node.level})`,
  };
}
