/**
 * 로스트아크 API 응답의 tooltip 텍스트 파싱 전용 모듈 (CLAUDE.md 섹션 4, 8).
 *
 * 캐릭터 프로필 Stats[].Tooltip은 <textformat>/<font> 같은 Flash 스타일 태그가 섞인
 * 일반 문자열 배열이다. 장비/스킬 tooltip처럼 "문자열 안에 JSON이 있고 그 안에 다시
 * HTML이 섞인" 구조는 아니므로, 이 모듈은 우선 그 단순한 형태만 다룬다. 더 복잡한
 * tooltip(장비/스킬)을 다루게 되면 이 파일에 별도 파서를 추가한다.
 */

/** <textformat ...>, <font ...>, </font> 등 태그를 제거하고 순수 텍스트만 남긴다. */
export function stripTooltipTags(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").trim();
}

/**
 * tooltip 줄들에서 `${keyword}이/가 X% 증가합니다` 형태의 첫 매치를 찾아 퍼센트
 * 숫자를 반환한다. 매치가 없으면 null.
 *
 * 키워드는 후보 탐지가 아니라 "정확히 이 구문이 있어야" 확정 반영하는 용도다
 * (CLAUDE.md 섹션 8: 짧은 단어 매칭은 오탐 위험이 있어 긴 구문을 우선한다).
 */
export function extractPercentAfterKeyword(
  tooltipLines: string[],
  keyword: string
): number | null {
  const pattern = new RegExp(
    `${keyword}(?:이|가)\\s*([0-9]+(?:\\.[0-9]+)?)%`
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
