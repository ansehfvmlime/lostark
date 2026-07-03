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
