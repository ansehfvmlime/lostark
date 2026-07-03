import { z } from "zod";

/**
 * GET /armories/characters/{characterName}/profiles 응답 스키마.
 *
 * 필드 확정 근거: 공식 developer 포털(developer-lostark.game.onstove.com/usage-guide)에
 * endpoint 경로/curl 예시는 있으나 샘플 응답 JSON은 게시되어 있지 않다.
 * 아래 필드는 커뮤니티 문서(blog.loatodo.com/106 등)로 존재가 확인된 것만 required로 두고,
 * 그 외 실제 API가 내려주는 나머지 필드(길드, 칭호, 스탯 등)는 아직 확정 근거가 없어
 * 스키마에 포함하지 않았다 — Two-Layer 원칙상 "API 수집 계층" 확장은 실제 응답으로
 * 재검증 후 진행한다 (docs/API_NOTES.md 참고).
 *
 * partial failure 원칙(CLAUDE.md 섹션 5): 이 스키마 검증에 실패해도 상위 route에서
 * 사용자 친화적 에러로 변환하고, 계산 로직 전체가 죽지 않도록 한다.
 */
export const characterProfileSchema = z.object({
  CharacterName: z.string(),
  CharacterClassName: z.string(),
  CharacterLevel: z.number(),
  // 실제 API가 숫자/문자열(예: "1,620.00") 중 어떤 형태로 내려주는지 문서상 미확정.
  // 두 형태 모두 허용하고, 표시/계산 시점에 파싱한다.
  ItemAvgLevel: z.union([z.string(), z.number()]),
  CharacterImage: z.string().optional(),
  ServerName: z.string().optional(),
  // 확정되지 않은 나머지 필드는 버리지 않고 보존한다 (향후 검증 후 스키마 확장용).
}).passthrough();

export type CharacterProfile = z.infer<typeof characterProfileSchema>;
