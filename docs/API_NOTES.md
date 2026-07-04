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

### `POST /markets/items`

- 출처: `developer-lostark.game.onstove.com/usage-guide` curl 예시 (확인일 2026-07-04) +
  실 API 호출로 요청/응답 스키마 확정.
- 요청 바디: `{ CategoryCode: number, ItemName?: string, PageNo?: number, ... }`.
  - `CategoryCode`는 **필수**다. 누락 시 `400`을 반환함을 실측으로 확인했다
    (`{ ItemName: "파괴강석" }`만 보내면 400).
  - `ItemName`은 부분 일치 검색으로 동작한다 (`ItemName: "파괴강석"` → "파괴강석",
    "정제된 파괴강석" 둘 다 매칭).
  - 결과가 없으면 에러가 아니라 `HTTP 200` + `{ TotalCount: 0, Items: [] }`을 반환한다
    (캐릭터 endpoint의 `null` 응답과는 다른 패턴이므로 주의).
- **카테고리 코드 계층 확인**: `GET /markets/options`로 전체 카테고리 트리를 확인했다.
  강화 재료는 `50000`(강화 재료) 아래 `50010`(재련 재료), `50020`(재련 추가 재료),
  `51000`(기타 재료), `51100`(무기 진화 재료), `230000`(아크 그리드 재료) 서브카테고리로
  구성된다. **실측 결과, 상위 카테고리 코드(`50000`)로 검색해도 하위 카테고리 아이템이
  전부 매칭된다** (`CategoryCode: 50000, ItemName: "태양의 은총"`으로 50020 소속 아이템을
  찾음). 이 프로젝트에서는 재련 재료(`50010`)만 우선 다루므로 매핑 테이블에는 `50010`을
  명시적으로 기록해 두었다 (상위 코드로 뭉뚱그리지 않고 실제 소속 카테고리를 남긴다).
- **응답 필드**:

  | 필드 | 타입 | 비고 |
  |---|---|---|
  | `Id` | number | 아이템 고유 ID |
  | `Name` | string | |
  | `Grade` | string | 등급(일반/고급/희귀/영웅/전설/유물/고대/에스더) |
  | `Icon` | string | |
  | `BundleCount` | number | **묶음 판매 수량.** 재련 재료 대부분(파괴석/수호석 계열)은 100 단위 묶음으로 거래된다. `CurrentMinPrice`는 "묶음 1개(=BundleCount개)"의 최저가이며 개당 가격이 아니다. |
  | `TradeRemainCount` | number \| null | |
  | `YDayAvgPrice` | number | |
  | `RecentPrice` | number | |
  | `CurrentMinPrice` | number | 현재 거래소 최저가 (묶음 단위) |

  이 endpoint는 Auctions API처럼 "허위 매물로 최저가가 왜곡될 수 있는" 원시 목록이 아니라,
  API가 이미 집계한 `CurrentMinPrice`를 제공한다. 따라서 CLAUDE.md 섹션 5의
  "하위 N건 분포 기반 대표값" 규칙은 **Auctions API 전용**으로 해석하고, Markets API는
  `CurrentMinPrice`를 대표값으로 그대로 사용한다.
- 구현 위치: `src/lib/lostark/endpoints.ts`(`marketsSearchPath`),
  `src/lib/lostark/schemas.ts`(`marketItemSchema`, `marketSearchResponseSchema`),
  `src/lib/lostark/client.ts`(`searchMarketItems`).
- 재련 재료 카탈로그(이름/ID/카테고리 코드)는 `src/data/config/materialCategories.ts`에
  실 API 조회로 확인된 33개 아이템 전체를 기록했다 (`CategoryCode: 50010`).

### `GET /characters/{characterName}/siblings`

- 출처: 실 API 호출로 확정 (확인일 2026-07-04). 공식 문서 usage-guide 페이지에는
  샘플이 없었다.
- **`/armories/` 하위가 아니라 최상위 `/characters/` 경로**임에 주의 (armory profile과
  헷갈리기 쉽다).
- 같은 원정대(계정)의 전체 캐릭터 목록을 배열로 반환한다.
- **실제 동작**: 존재하지 않는 캐릭터명으로 요청해도 `armories/profiles`처럼 `null`을
  반환하지 않고, `HTTP 200` + **빈 배열 `[]`**을 반환한다 (실측 확인, 두 endpoint의
  "없음" 표현 방식이 서로 다르므로 각각 별도 처리했다).
- 응답 필드(배열 원소): `ServerName`(string), `CharacterName`(string),
  `CharacterLevel`(number), `CharacterClassName`(string),
  `ItemAvgLevel`(string, 콤마 포함 — armory profile과 동일 포맷).
- 구현 위치: `src/lib/lostark/endpoints.ts`(`characterSiblingsPath`),
  `src/lib/lostark/schemas.ts`(`characterSiblingSchema`),
  `src/lib/lostark/client.ts`(`getCharacterSiblings`),
  `src/app/api/lostark/character/[name]/siblings/route.ts`.

### `GET /armories/characters/{characterName}` 및 하위 armory endpoint들 (전투 계산 Stage 2 준비)

- 확인일 2026-07-04. 공식 usage-guide 페이지는 `/armories/characters/{characterName}/profiles`
  예시만 제공하고 나머지 하위 endpoint는 문서에 나열되어 있지 않아, 실 API를 직접
  호출해 존재 여부와 구조를 확인했다 (CLAUDE.md 섹션 5: "API 문서에 없는 endpoint를
  있다고 가정하지 않는다" — 가정이 아니라 실제로 호출해 200 응답을 받은 것만 기록한다).
- 캐릭터당 armory 전체를 한 번에 받는 **결합 endpoint**가 존재한다:
  `GET /armories/characters/{characterName}` (하위 경로 없음). 응답 최상위 키:

  | 키 | 내용 |
  |---|---|
  | `ArmoryProfile` | 기존 `/profiles`와 동일한 프로필 + Stats |
  | `ArmoryEquipment` | 장비 목록 (하위 endpoint `/equipment`와 동일) |
  | `ArmoryAvatars` | 아바타 목록 |
  | `ArmorySkills` | 스킬/트라이포드 목록 (하위 endpoint `/combat-skills`와 동일) |
  | `ArmoryEngraving` | 구 각인 시스템 잔재 필드. 이 계정에서는 `Engravings: null`, `Effects: null`이고 `ArkPassiveEffects`만 채워져 있었다 — 아크패시브 도입 이후 이 필드가 실질적으로 대체된 것으로 보인다. |
  | `ArmoryCard` | 카드 목록 + 세트 효과 (하위 endpoint `/cards`와 동일) |
  | `ArmoryGem` | 보석 목록 |
  | `ArkPassive` | **아크패시브 트리 전체** (진화/깨달음/도약 포인트 및 활성 노드 효과) — 전투(치명타) 계산의 핵심 데이터 |
  | `ArkGrid` | 아크 그리드 코어 (하위 endpoint `/arkgrid`와 동일) |
  | `ColosseumInfo` | PvP 전적 — 치명타 계산과 무관 |
  | `Collectibles` | 수집품 포인트 — 치명타 계산과 무관 |

  하위 endpoint(`/equipment`, `/avatars`, `/combat-skills`, `/engravings`, `/cards`,
  `/gems`, `/colosseums`, `/collectibles`, `/arkgrid`)도 각각 개별 호출 시 200을
  반환하며, 결합 endpoint의 해당 섹션과 동일한 형태를 반환한다. 캐릭터 검색 1회당
  여러 섹션이 필요하면 결합 endpoint 1번 호출이 rate limit(분당 100회) 관리에 유리하다.

- **`ArkPassive` 구조** (전투 계산 Stage 2에서 가장 중요):
  ```json
  {
    "Title": "오의난무",
    "IsArkPassive": true,
    "Points": [{ "Name": "진화|깨달음|도약", "Value": number, "Tooltip": "...", "Description": "6랭크 30레벨" }],
    "Effects": [
      {
        "Name": "진화|깨달음|도약",
        "Description": "<FONT ...>진화</FONT> 1티어 <FONT ...>치명 Lv.11</FONT>",
        "Icon": "...",
        "ToolTip": "{\"Element_000\": {...}, \"Element_002\": {\"type\":\"MultiTextBox\",\"value\":\"치명이 550 증가합니다.||<BR>\"}}"
      }
    ]
  }
  ```
  - `Effects[]`는 **현재 실제로 활성화된 노드만** 담겨 있다(트리 전체가 아니라 투자한
    노드만). `Description`에서 티어(1~5티어)와 노드 이름·레벨을 정규식으로 뽑을 수
    있다 (`"(\\d)티어"`, `"([가-힣 ]+) Lv\\.(\\d+)"`).
  - `ToolTip`은 **문자열 안에 JSON이 있고 그 값 안에 다시 HTML 태그가 섞인 구조**다
    (CLAUDE.md 섹션 8에서 예상한 패턴과 일치). `Element_002.value`(보통
    `MultiTextBox` 타입)에 실제 효과 설명 텍스트가 들어있다. 이 프로젝트의 기존
    `stripTooltipTags`로 태그 제거 후 `extractPercentAfterKeyword`로 재사용 가능하다
    — 다만 이 JSON을 먼저 `JSON.parse`해서 `Element_002.value`를 꺼내는 파서가
    별도로 필요하다 (Stats.Tooltip처럼 단순 문자열 배열이 아님).
  - 실 캐릭터(유우시, 스트라이커, 확인일 2026-07-04)로 확인한 "진화" 트리 활성 노드와
    치명타 관련 텍스트는 `docs/COMBAT.md` 섹션 2.2~2.5에 그대로 옮겨 기록했다.

- **`Equipment[].Tooltip`, `Cards[].Tooltip`, `ArmorySkills[].Tooltip`도 동일한
  "문자열 안의 JSON(Element_XXX) + 내부 HTML" 구조**를 쓴다. 반면 **`Tripods[].Tooltip`
  (스킬의 트라이포드 목록)과 `ArmoryProfile.Stats[].Tooltip`은 JSON이 아니라 단순
  태그 섞인 문자열(배열)** 이다 — 같은 API 안에서도 필드마다 tooltip 포맷이 다르므로,
  파서를 만들 때 매번 실제 응답으로 형식을 재확인해야 한다.

- **`Tripods[]` 구조** (스킬별 치명타 룰의 핵심):
  ```json
  { "Tier": 0, "Slot": 1, "Name": "암흑 공격", "IsSelected": false,
    "Tooltip": "<font ...>공격의 치명타 적중률이 <FONT COLOR='#99ff99'>40.0%</FONT> 증가한다...</font>" }
  ```
  `IsSelected`로 실제 장착 여부를 판별할 수 있다 — 미선택 트라이포드의 효과를 반영하면
  안 된다(CLAUDE.md 섹션 7.3 "특정 스킬 전용 효과는 해당 스킬의 계산에만 반영"의
  전제조건). `Tooltip`은 단순 태그 문자열이라 기존 `extractPercentAfterKeyword`를
  그대로 재사용할 수 있다.

- **`ArmoryCard.Effects[]` 구조** (카드 세트 매칭의 핵심):
  ```json
  { "Index": 0, "CardSlots": [0,1,2],
    "Items": [
      { "Name": "세 우마르가 오리라 3세트", "Description": "가디언 토벌 시 ... 7.5% 감소" },
      { "Name": "세 우마르가 오리라 3세트 (6각성합계)", "Description": "..." }
    ]
  }
  ```
  `Items[].Name`에 세트 이름과 "(N각성합계)" 임계값이 함께 들어있고, `Description`은
  태그 없는 순수 텍스트다. 세트 효과 룰은 "세트 이름 + 필요 각성합계 이하 중 가장 높은
  단계"로 매칭해야 한다 (예: 실제 각성합계가 8이면 "(6각성합계)"까지만 적용, "(9각성합계)"는
  미적용).

## 게임 데이터 리서치 (콘텐츠 수익 계산기, Phase 5)

`src/data/config/raids.ts`에 하드코딩한 카제로스 레이드 보상 데이터의 출처/신뢰도:

- **입장 아이템레벨** (1~4막, 종막의 노말/하드): 공식 게임 가이드
  `m-lostark.game.onstove.com/GameGuide/Pages/카제로스 레이드`에서 확인 (확인일
  2026-07-04, `source: OFFICIAL_PATCH_NOTE` 수준 신뢰도).
- **캐릭터당 주 3회 골드 보상 제한**: 공식 게임 가이드 "엔드 콘텐츠 현황 확인" 페이지에서
  확인 (확인일 2026-07-04). 계산기의 "레이드 3개 자동 선택" 로직이 이 규칙과 일치하도록
  구현했다.
- **귀속/거래가능 골드 수치**: `lobal.kr/tips/raid/raid-reward` (커뮤니티) 1건에서만
  확인했다. 리서치 중 다른 출처(공식 검색 요약, 영문 커뮤니티 등)에서 같은 레이드에 대해
  서로 다른 골드 수치가 나왔다 — 패치로 여러 차례 조정된 이력이 있는 것으로 보이며,
  어느 수치가 "현재" 값인지 자동화된 검색으로는 교차검증하지 못했다. **`confidence: LOW`로
  명시했고, 사용자에게도 이 사실을 알리고 진행 여부를 확인받았다.**
- **드랍 재료 수량**: 운명의 파괴석/수호석/파편/돌파석 등이 거래소에서 실제로 거래 가능함은
  Markets API로 확인했지만(막·난이도별 정확한 드랍 개수는 모든 출처가 이미지 표라서 텍스트로
  확인하지 못했다. `raids.ts`에는 빈 배열로 남겨두었다 (CLAUDE.md 섹션 2: 불확실한 게임
  수치를 추측하지 않는다 — 저신뢰 추정치조차 없이 아예 비워둠).
- 아크 그리드 코어, 업화의 쐐기돌, 카르마의 잔영, 고통의 가시 등 막/레이드 전용 제작
  재료는 Markets API로 검색되지 않았다 (귀속/비거래 아이템으로 판단) — 재료 환산 골드
  대상에서 제외했다.
- 서막(붉어진 백야의 나선), 벨가르딘 등은 신뢰할 수 있는 수치를 찾지 못해 이번 버전
  범위에서 제외했다.
- **그림자 레이드 세르카** (노말 1710 / 하드 1730 / 나이트메어 1740): 입장 레벨은 공식
  게임 가이드 `m-lostark.game.onstove.com/GameGuide/Pages/그림자 레이드`에서 확인
  (확인일 2026-07-04, 고신뢰). 골드 수치는 카제로스와 동일하게 `lobal.kr` 저신뢰
  소스(난이도 무관 32,000G 동일)를 사용했다 — 실제로는 나이트메어가 하드보다 높을
  가능성이 크지만 교차검증하지 못했다.

## 아직 대조하지 않은 endpoint

Auctions, News, Gamecontents 등은 아직 착수하지 않았다. 착수 시 이 문서에 동일한 형식으로
추가한다.
