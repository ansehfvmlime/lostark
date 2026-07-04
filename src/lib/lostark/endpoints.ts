/**
 * 로스트아크 Open API endpoint 경로.
 * 공식 developer 포털(https://developer-lostark.game.onstove.com/usage-guide)
 * 대조 확인일: 2026-07-03. 확정 내역은 docs/API_NOTES.md 참고.
 */

/** GET /armories/characters/{characterName}/profiles */
export function characterProfilePath(characterName: string): string {
  return `/armories/characters/${encodeURIComponent(characterName)}/profiles`;
}

/** POST /markets/items (CategoryCode 필수, ItemName은 부분 일치 검색) */
export function marketsSearchPath(): string {
  return "/markets/items";
}

/** GET /characters/{characterName}/siblings (armories 하위 아님) */
export function characterSiblingsPath(characterName: string): string {
  return `/characters/${encodeURIComponent(characterName)}/siblings`;
}

/**
 * GET /armories/characters/{characterName}/arkpassive
 * 공식 usage-guide 문서에는 없으나 실 API 호출로 200 응답을 확인했다
 * (docs/API_NOTES.md 참고, 확인일 2026-07-04).
 */
export function characterArkPassivePath(characterName: string): string {
  return `/armories/characters/${encodeURIComponent(characterName)}/arkpassive`;
}
