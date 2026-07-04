/**
 * 로스트아크 API 응답의 tooltip 텍스트 파싱 전용 모듈 (CLAUDE.md 섹션 4, 8).
 *
 * 이 API는 같은 응답 안에서도 필드마다 tooltip 포맷이 다르다 (실 API 응답으로 확인,
 * docs/API_NOTES.md 참고):
 * - 캐릭터 프로필 `Stats[].Tooltip`, 스킬의 `Tripods[].Tooltip`: `<textformat>`/`<font>`
 *   같은 Flash 스타일 태그가 섞인 단순 문자열(배열). → `stripTooltipTags` +
 *   `extractPercentAfterKeyword`로 처리.
 * - 아크패시브 `ArkPassive.Effects[].ToolTip`, 장비 `Equipment[].Tooltip`, 스킬
 *   `ArmorySkills[].Tooltip`, 카드 `Cards[].Tooltip`: **문자열 안에 JSON
 *   (`Element_000`, `Element_001`, ...)이 있고 그 값 안에 다시 HTML이 섞인 구조**.
 *   → `parseElementTooltip` + `extractMultiTextBoxText`로 먼저 평문을 뽑은 뒤
 *   `extractPercentAfterKeyword`를 적용한다.
 */

/** <textformat ...>, <font ...>, </font> 등 태그를 제거하고 순수 텍스트만 남긴다. */
export function stripTooltipTags(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").trim();
}

/**
 * tooltip 줄들에서 `${keyword}(이|가) X%` 형태의 첫 매치를 찾아 퍼센트 숫자를
 * 반환한다. 매치가 없으면 null.
 *
 * 조사(이/가)와 "+" 기호는 선택적이다 — 실 API 응답에서 "치명타 적중률이 26.19%
 * 증가합니다"처럼 조사가 붙는 경우도, "달인 : 치명타 적중률 +1.4% / 추가 피해 +1.7%"
 * 처럼 조사 없이 콜론과 "+"만 붙는 경우도 확인했다(docs/COMBAT.md 섹션 2.4).
 *
 * 키워드는 후보 탐지가 아니라 "정확히 이 구문이 있어야" 확정 반영하는 용도다
 * (CLAUDE.md 섹션 8: 짧은 단어 매칭은 오탐 위험이 있어 긴 구문을 우선한다).
 */
export function extractPercentAfterKeyword(
  tooltipLines: string[],
  keyword: string
): number | null {
  const pattern = new RegExp(
    `${keyword}(?:이|가)?\\s*\\+?([0-9]+(?:\\.[0-9]+)?)%`
  );

  for (const line of tooltipLines) {
    const plain = stripTooltipTags(line);
    const match = plain.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }

  return null;
}

/**
 * 정규식으로 매치된 모든 `${keyword}이/가 X% 증가/감소합니다` 값을 순서대로 반환한다.
 * "일격" 노드처럼 같은 tooltip 안에 같은 키워드가 여러 값(예: 치명타 적중률, 치명타
 * 피해)을 가질 수 있는 경우에도, `extractPercentAfterKeyword`는 첫 매치만 반환하므로
 * 필요하면 이 함수로 전체를 확인한다.
 */
export function extractAllPercentsAfterKeyword(
  tooltipLines: string[],
  keyword: string
): number[] {
  const pattern = new RegExp(
    `${keyword}(?:이|가)?\\s*\\+?([0-9]+(?:\\.[0-9]+)?)%`,
    "g"
  );
  const results: number[] = [];

  for (const line of tooltipLines) {
    const plain = stripTooltipTags(line);
    for (const match of plain.matchAll(pattern)) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) results.push(value);
    }
  }

  return results;
}

export type ParsedTooltipElement = {
  type: string;
  value: unknown;
};

/**
 * "문자열 안의 JSON" 형태 tooltip(아크패시브/장비/스킬/카드 등)을 파싱한다.
 * JSON 파싱에 실패하면(예상과 다른 형식) null을 반환한다 — 파싱 실패 항목은 계산에서
 * 제외하고 warnings에 기록해야 한다(CLAUDE.md 섹션 8).
 */
export function parseElementTooltip(
  raw: string
): Record<string, ParsedTooltipElement> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, ParsedTooltipElement>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 파싱된 Element_XXX 맵에서 `MultiTextBox` 타입 원소들의 텍스트를 이어붙인다.
 * 실 API 응답에서 효과 설명 본문은 보통 `MultiTextBox` 타입 원소(주로 `Element_002`)에
 * 들어있다 — 다만 키 이름은 항목마다 달라질 수 있어 키가 아니라 `type`으로 찾는다.
 */
export function extractMultiTextBoxText(
  parsed: Record<string, ParsedTooltipElement>
): string {
  return Object.values(parsed)
    .filter(
      (element): element is ParsedTooltipElement & { value: string } =>
        element?.type === "MultiTextBox" && typeof element.value === "string"
    )
    .map((element) => element.value)
    .join("\n");
}

/**
 * "문자열 안의 JSON" tooltip에서 바로 퍼센트 값을 추출하는 조합 헬퍼.
 * JSON 파싱 실패 시 null을 반환한다(호출부에서 파싱 실패로 처리).
 */
export function extractPercentFromElementTooltip(
  raw: string,
  keyword: string
): number | null {
  const parsed = parseElementTooltip(raw);
  if (!parsed) return null;
  const text = extractMultiTextBoxText(parsed);
  return extractPercentAfterKeyword([text], keyword);
}

/**
 * 파싱된 Element_XXX 맵에서 `ItemPartBox` 타입 원소 중 제목(`value.Element_000`)이
 * `titleIncludes`를 포함하는 항목의 본문(`value.Element_001`)을 반환한다.
 *
 * 팔찌(BRACELET) 옵션이 이 구조를 쓴다 — 장비 tooltip은 여러 `ItemPartBox`를 가질 수
 * 있고(예: "기본 효과", "추가 효과", "팔찌 효과", "아크 패시브 포인트 효과"), 제목으로
 * 원하는 섹션만 구분해야 한다 (실 API 응답으로 확인, docs/API_NOTES.md 참고).
 */
export function extractItemPartBoxText(
  parsed: Record<string, ParsedTooltipElement>,
  titleIncludes: string
): string | null {
  for (const element of Object.values(parsed)) {
    if (element?.type !== "ItemPartBox") continue;
    const value = element.value as
      | { Element_000?: unknown; Element_001?: unknown }
      | null
      | undefined;
    if (
      typeof value?.Element_000 !== "string" ||
      typeof value?.Element_001 !== "string"
    ) {
      continue;
    }
    if (stripTooltipTags(value.Element_000).includes(titleIncludes)) {
      return value.Element_001;
    }
  }
  return null;
}
