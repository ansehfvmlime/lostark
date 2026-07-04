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
/**
 * Stats[] 항목 스키마. 실 API 응답(tests/fixtures/character-profile-example.json,
 * 수집일 2026-07-03)으로 구조를 확인했다. Tooltip은 Flash 스타일 태그
 * (<textformat>/<font>)가 섞인 일반 문자열 배열이며, 장비/스킬 tooltip처럼
 * "문자열 안의 JSON"은 아니다. 예: "치명" 스탯의 Tooltip 첫 줄에는 이미
 * "치명타 적중률이 26.19% 증가합니다." 처럼 게임이 직접 변환한 최종 퍼센트가
 * 들어있다 — 별도의 스탯→확률 변환 계수 없이 이 문구를 파싱해서 쓴다
 * (src/lib/lostark/tooltip.ts, CLAUDE.md 섹션 7 Two-Layer 원칙).
 */
export const characterStatSchema = z
  .object({
    Type: z.string(),
    Value: z.string(),
    Tooltip: z.array(z.string()).optional(),
  })
  .passthrough();

export type CharacterStat = z.infer<typeof characterStatSchema>;

export const characterProfileSchema = z.object({
  CharacterName: z.string(),
  CharacterClassName: z.string(),
  CharacterLevel: z.number(),
  // 실제 API가 숫자/문자열(예: "1,620.00") 중 어떤 형태로 내려주는지 문서상 미확정.
  // 두 형태 모두 허용하고, 표시/계산 시점에 파싱한다.
  ItemAvgLevel: z.union([z.string(), z.number()]),
  CharacterImage: z.string().optional(),
  ServerName: z.string().optional(),
  Stats: z.array(characterStatSchema).optional(),
  // 확정되지 않은 나머지 필드는 버리지 않고 보존한다 (향후 검증 후 스키마 확장용).
}).passthrough();

export type CharacterProfile = z.infer<typeof characterProfileSchema>;

/**
 * 캐릭터명 입력 검증. API route(서버)와 검색 폼(클라이언트) 양쪽에서 공유해서 쓴다
 * (CLAUDE.md 섹션 12: 사용자 입력값은 Zod로 validation).
 */
export const characterNameSchema = z
  .string()
  .trim()
  .min(1, "캐릭터명을 입력해주세요.")
  .max(30, "캐릭터명이 너무 깁니다.");

export type CharacterNameInput = z.infer<typeof characterNameSchema>;

/**
 * POST /markets/items 응답 스키마. 실 API 호출로 필드를 확정했다 (docs/API_NOTES.md 참고,
 * 확인일 2026-07-04).
 *
 * BundleCount: 묶음 판매 수량. CurrentMinPrice는 "묶음 1개(=BundleCount개)"의 최저가이며
 * 개당 가격이 아니다 — 계산기에서 개당 가격으로 환산할 때 반드시 나눠야 한다.
 */
export const marketItemSchema = z
  .object({
    Id: z.number(),
    Name: z.string(),
    Grade: z.string(),
    Icon: z.string().optional(),
    BundleCount: z.number(),
    TradeRemainCount: z.number().nullable().optional(),
    YDayAvgPrice: z.number(),
    RecentPrice: z.number(),
    CurrentMinPrice: z.number(),
  })
  .passthrough();

export type MarketItem = z.infer<typeof marketItemSchema>;

export const marketSearchResponseSchema = z
  .object({
    PageNo: z.number(),
    PageSize: z.number(),
    TotalCount: z.number(),
    Items: z.array(marketItemSchema),
  })
  .passthrough();

export type MarketSearchResponse = z.infer<typeof marketSearchResponseSchema>;

/**
 * GET /characters/{characterName}/siblings 응답 스키마. 실 API 호출로 확정했다
 * (docs/API_NOTES.md 참고, 확인일 2026-07-04). armories 하위가 아니라 최상위
 * /characters/ 경로임에 주의.
 */
export const characterSiblingSchema = z
  .object({
    ServerName: z.string(),
    CharacterName: z.string(),
    CharacterLevel: z.number(),
    CharacterClassName: z.string(),
    ItemAvgLevel: z.union([z.string(), z.number()]),
  })
  .passthrough();

export type CharacterSibling = z.infer<typeof characterSiblingSchema>;

export const characterSiblingsResponseSchema = z.array(characterSiblingSchema);

/**
 * GET /armories/characters/{characterName}/arkpassive 응답 스키마. 실 API 호출로
 * 확정했다 (docs/API_NOTES.md, docs/COMBAT.md 참고, 확인일 2026-07-04).
 *
 * `Effects[]`는 캐릭터가 실제로 투자한(활성화된) 노드만 담고 있다 — 트리 전체가 아니다.
 * `ToolTip`은 Stats.Tooltip과 달리 **문자열 안에 JSON(Element_XXX)이 있고 그 값 안에
 * 다시 HTML이 섞인 구조**다 (CLAUDE.md 섹션 8 패턴). `Element_002`(보통 MultiTextBox
 * 타입)의 `value`에 실제 효과 설명 텍스트가 들어있으며, `src/lib/lostark/tooltip.ts`의
 * `parseElementTooltip`으로 파싱한다.
 */
export const arkPassiveEffectSchema = z
  .object({
    Name: z.string(),
    Description: z.string(),
    Icon: z.string().optional(),
    ToolTip: z.string(),
  })
  .passthrough();

export type ArkPassiveEffect = z.infer<typeof arkPassiveEffectSchema>;

export const arkPassivePointSchema = z
  .object({
    Name: z.string(),
    Value: z.number(),
    Tooltip: z.string().optional(),
    Description: z.string().optional(),
  })
  .passthrough();

export const arkPassiveSchema = z
  .object({
    Title: z.string().optional(),
    IsArkPassive: z.boolean(),
    Points: z.array(arkPassivePointSchema).optional(),
    Effects: z.array(arkPassiveEffectSchema).optional(),
  })
  .passthrough();

export type ArkPassive = z.infer<typeof arkPassiveSchema>;

/**
 * GET /armories/characters/{characterName}/cards 응답 스키마. 실 API 호출로 확정했다
 * (docs/API_NOTES.md, docs/COMBAT.md 참고, 확인일 2026-07-04).
 *
 * `Effects[].Items[].Name`은 "세트이름" 또는 "세트이름 (N각성합계)" 형태다. 실 캐릭터로
 * 검증한 결과, `Items[]`에는 **캐릭터의 현재 각성 합계 기준으로 이미 활성화된 임계값만**
 * 나열된다(예: 카드 3장 각각 5각성 완료 → 합계 15 → "(15각성합계)"까지만 표시). 즉
 * 이 계산기는 `Items[]`를 별도 필터링 없이 전부 "현재 적용 중"으로 취급하면 된다.
 * `Description`은 태그 없는 순수 텍스트다.
 */
export const cardSetEffectItemSchema = z
  .object({
    Name: z.string(),
    Description: z.string(),
  })
  .passthrough();

export const cardSetEffectSchema = z
  .object({
    Index: z.number(),
    CardSlots: z.array(z.number()),
    Items: z.array(cardSetEffectItemSchema),
  })
  .passthrough();

export const cardItemSchema = z
  .object({
    Slot: z.number(),
    Name: z.string(),
    Icon: z.string().optional(),
    AwakeCount: z.number(),
    AwakeTotal: z.number(),
    Grade: z.string(),
    Tooltip: z.string().optional(),
  })
  .passthrough();

export const armoryCardSchema = z
  .object({
    Cards: z.array(cardItemSchema).nullable().optional(),
    Effects: z.array(cardSetEffectSchema).nullable().optional(),
  })
  .passthrough();

export type ArmoryCard = z.infer<typeof armoryCardSchema>;

/**
 * GET /armories/characters/{characterName}/equipment 응답 스키마. 실 API 호출로
 * 확정했다 (docs/API_NOTES.md, docs/COMBAT.md 참고, 확인일 2026-07-04).
 *
 * `Tooltip`은 "문자열 안의 JSON(Element_XXX)" 구조다. 팔찌(`Type: "팔찌"`)의 옵션은
 * 다른 장비처럼 `MultiTextBox` 타입이 아니라, `ItemPartBox` 타입 원소의 중첩된
 * `value.Element_001`(제목 "팔찌 효과")에 들어있다 — `src/lib/lostark/tooltip.ts`의
 * `extractItemPartBoxText`로 뽑는다.
 */
export const equipmentItemSchema = z
  .object({
    Type: z.string(),
    Name: z.string(),
    Icon: z.string().optional(),
    Grade: z.string(),
    Tooltip: z.string(),
  })
  .passthrough();

export type EquipmentItem = z.infer<typeof equipmentItemSchema>;

export const equipmentResponseSchema = z.array(equipmentItemSchema);

/**
 * GET /armories/characters/{characterName}/combat-skills 응답 스키마. 실 API 호출로
 * 확정했다 (docs/API_NOTES.md, docs/COMBAT.md 참고, 확인일 2026-07-04).
 *
 * `Tripods[].Tooltip`은 Stats.Tooltip과 같은 단순 태그 문자열이다(JSON-in-string이
 * 아님). `IsSelected: false`인 트라이포드의 효과는 절대 반영하면 안 된다 — 같은
 * 슬롯(Tier/Slot)에서 하나만 선택 가능하므로, 필터링하지 않으면 미선택 효과까지
 * 전부 합산하는 오류가 난다.
 */
export const tripodSchema = z
  .object({
    Tier: z.number(),
    Slot: z.number(),
    Name: z.string(),
    Icon: z.string().optional(),
    IsSelected: z.boolean(),
    Tooltip: z.string().optional(),
  })
  .passthrough();

export const combatSkillSchema = z
  .object({
    Name: z.string(),
    Icon: z.string().optional(),
    Level: z.number(),
    Type: z.string(),
    SkillType: z.number().optional(),
    Tripods: z.array(tripodSchema).nullable().optional(),
    Tooltip: z.string().optional(),
  })
  .passthrough();

export type CombatSkill = z.infer<typeof combatSkillSchema>;
export type Tripod = z.infer<typeof tripodSchema>;

export const combatSkillsResponseSchema = z.array(combatSkillSchema);
