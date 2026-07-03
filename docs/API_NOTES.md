# API_NOTES.md — 로스트아크 Open API 확정 내역

이 문서는 CLAUDE.md 섹션 5 규칙("endpoint 경로는 구현 착수 시 공식 developer 포털 문서와
대조하여 docs/API_NOTES.md에 확정 기록한다")에 따라, 실제로 대조/검증한 내용만 기록한다.
불확실한 항목은 "미확인"으로 명시하고 추측하지 않는다.

---

## 공통 정보

- Base URL: `https://developer-lostark.game.onstove.com`
- 인증 헤더: `authorization: bearer <JWT>`, `accept: application/json`
- Rate limit: 분당 100회 수준. 초과 시 `429`.
  응답 헤더 `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` 제공.
  (출처: `developer-lostark.game.onstove.com/getting-started`, 확인일 2026-07-03)

## 확정된 endpoint

### `GET /armories/characters/{characterName}/profiles`

- 출처: `developer-lostark.game.onstove.com/usage-guide` (확인일 2026-07-03)
- `characterName`은 path parameter이며, 한글/특수문자는 URL encoding 필요
  (`encodeURIComponent`). Next.js dynamic route(`[name]`)에서 받는 `params.name`은 이미
  디코딩된 상태이므로, `src/lib/lostark/endpoints.ts`의 `characterProfilePath`에서
  다시 인코딩해 로스트아크 API로 보낸다.
- 구현 위치: `src/lib/lostark/endpoints.ts`, `src/lib/lostark/client.ts`
  (`getCharacterProfile`).

#### 실제 동작 확인 (문서에 명시되지 않음, 실 API 호출로 검증)

- **존재하지 않는 캐릭터명으로 요청하면 `404`가 아니라 `HTTP 200` + body `null`을
  반환한다.** 공식 문서/curl 예시에는 이 동작이 나와 있지 않으며, 개발 서버를 띄우고
  실제로 다수의 존재/미존재 캐릭터명으로 호출해 확인했다 (확인일 2026-07-03).
  - `client.ts`의 `getCharacterProfile`에서 `data === null`을 스키마 검증 이전에
    가로채 `LostArkApiError("NOT_FOUND", ...)`로 변환한다.
  - 검증 테스트: `src/lib/lostark/client.test.ts` — "존재하지 않는 캐릭터(HTTP 200 + null
    body)는 NOT_FOUND로 처리한다".

#### 응답 필드 (실 API 응답으로 확인, 확인일 2026-07-03)

공개 아이템레벨 랭킹(kloa.gg)에 노출된 실제 캐릭터로 라이브 호출하여 확인했다. 원본
전체 응답은 `tests/fixtures/character-profile-example.json`에 수집일/출처 메타데이터와
함께 저장되어 있다.

Zod 스키마(`src/lib/lostark/schemas.ts`)에 반영한 필드:

| 필드 | 타입 | 비고 |
|---|---|---|
| `CharacterName` | string | |
| `CharacterClassName` | string | |
| `CharacterLevel` | number | |
| `ItemAvgLevel` | string \| number | 실 응답에서는 `"1,805.00"`처럼 콤마 포함 문자열로 내려옴. 표시/계산 시점에 별도 파싱 필요 (아직 구현 안 함). |
| `CharacterImage` | string (optional) | |
| `ServerName` | string (optional) | |

스키마는 `.passthrough()`로 선언되어 있어, 아래처럼 실 응답에 존재하지만 아직 검증/반영
전인 필드도 유실 없이 통과시킨다. 이 필드들은 "감지되었으나 계산에는 아직 미반영" 상태이며,
향후 전투(치명타) 계산 기능(CLAUDE.md 섹션 7)에서 필요해지는 시점에 각각 재검증 후
스키마에 정식으로 편입한다:

- `ExpeditionLevel`, `TownLevel`, `TownName`, `Title`, `GuildMemberGrade`, `GuildName`,
  `UsingSkillPoint`, `TotalSkillPoint`, `Stats`(치명/특화/신속 등 스탯 배열, tooltip 포함),
  `Tendencies`, `CombatPower`, `Decorations`, `HonorPoint`

미확인 사항:

- 캐릭터가 존재하지만 armory 조회 자체가 비공개 설정된 경우의 응답 형태는 아직 확인하지
  못했다 (별도 필드로 구분되는지, 역시 `null`인지 등). 추후 실제 사례로 검증 필요.
- 이 endpoint가 제공하는 게임 버전/패치 시점을 응답에서 직접 알 수 있는 필드는 발견하지
  못했다.

## 아직 대조하지 않은 endpoint

Markets, Auctions, News, Characters(형제 캐릭터 목록), Gamecontents 등은 Phase 1
범위(캐릭터 기본 정보 조회)에 포함되지 않아 아직 착수하지 않았다. 착수 시 이 문서에
동일한 형식으로 추가한다.
