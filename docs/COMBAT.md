# COMBAT.md — 치명타 전투 효율 계산 모델

이 문서는 CLAUDE.md 섹션 7("Combat (Critical) Calculation — Core Rules")이 참조하는
**상세 모델 문서**다. CLAUDE.md에는 절대 규칙(스태킹 순서, EffectRule 스키마, confidence
기본 동작 등)만 두고, 실제 게임 항목·수치·매핑은 이 문서에 둔다.

## 0. 데이터 출처와 신뢰도 원칙

- 이 문서의 항목 목록은 **사용자가 2026 시즌3 기준으로 직접 제공한 게임 지식**에서
  출발했다 (작성일 2026-07-04). CLAUDE.md 섹션 2 규칙상 "API 또는 사용자가 제공한
  데이터를 우선 사용"하는 경로에 해당하며, Claude가 기억만으로 단정한 수치가 아니다.
- 이후 실제 캐릭터로 armory API(`/armories/characters/{name}`)를 호출해 아크패시브
  진화 노드의 **실제 tooltip 원문을 확인**했다 (확인일 2026-07-04, 캐릭터: 유우시/
  스트라이커, 원본 응답은 `docs/API_NOTES.md`의 해당 절 참고). tooltip 원문으로 확인된
  항목은 `confidence: HIGH`로, 아직 tooltip을 직접 못 본 항목(정밀 단도, 팔찌 옵션 구간,
  남바절 수치 등)은 `MEDIUM`으로 구분한다.
- 각인/아크패시브 수치는 레벨(아크패시브 포인트 투자량)에 따라 달라진다. tooltip 원문에
  레벨별 정확한 수치가 그대로 나오므로, 구현 시 이 문서의 숫자를 코드/룰에 박지 않고
  **항상 `Element_002.value`(또는 Stats/Tripod tooltip) 파싱값을 우선 사용**한다
  (`valueFrom: "TOOLTIP"`, CLAUDE.md 섹션 7.2). 이 문서의 숫자는 "이 노드가 치명타
  확률에 해당한다"는 분류 근거이자 파서 회귀 테스트용 기준값으로 쓴다.
- 이 문서의 수치가 실제 게임과 달라지면(패치 등) 이 문서와 `data/rules/*.json`의
  `verifiedAt`을 함께 갱신한다.

## 1. Two-Layer 매핑 개요

API 구조는 2026-07-04에 실 API 호출로 확인을 마쳤다 (상세는 `docs/API_NOTES.md`의
"armory endpoint" 절). 남은 미확인은 "레벨별 정확한 수치표"와 "직업별 차이"뿐이다.

| 항목 | API로 직접 확인 가능? | 해석 방법 |
|---|---|---|
| 치명 특성(악세서리) | `ArmoryProfile.Stats[].Tooltip`에 최종 %가 이미 계산되어 있음 (Stage 1에서 사용 중) | tooltip 직접 파싱 |
| 아크패시브 진화 1~5티어 | `ArkPassive.Effects[]` (구조 확인됨, JSON-in-string tooltip) | JSON 파싱 → 태그 제거 → 룰 매칭 |
| 공용 각인(아드레날린/정밀 단도) | 아크패시브 도입 후 "진화" 트리 노드로 흡수된 것으로 보임 — `ArmoryEngraving.Engravings`는 이 계정에서 `null`이었다 | `ArkPassive.Effects[]`에서 이름으로 매칭 (아드레날린/정밀 단도를 낀 캐릭터로 재확인 필요) |
| 팔찌 옵션 | `ArmoryEquipment[].Tooltip` (JSON-in-string, 팔찌 타입 아이템) | JSON 파싱 → 룰 매칭 |
| 파티 시너지/도핑 | API로 알 수 없음 | 사용자 수동 입력(MANUAL) |
| 직업별 깨달음 효과 | `ArkPassive.Effects[]` (`Name: "깨달음"`) | JSON 파싱 + 직업별 룰 매칭 |
| 트라이포드 | `ArmorySkills[].Tripods[]` (구조 확인됨, 단순 태그 문자열 tooltip + `IsSelected`) | 기존 `extractPercentAfterKeyword` 재사용 |
| 스킬 자체 보정 | `ArmorySkills[].Tooltip` (JSON-in-string) | JSON 파싱 → 룰 매칭 |
| 백어택/헤드어택 | API로 알 수 없음(포지셔닝) | 사용자 유지율 입력(MANUAL) |
| 카드 세트 효과 | `ArmoryCard.Effects[]` (구조 확인됨, 태그 없는 순수 텍스트) | 세트 이름 + 각성합계 임계값 매칭 |

## 2. 전역(GLOBAL) 항목 — 모든 스킬에 동일하게 적용

### 2.1 치명 특성 (악세서리 연마 포함)

- **효과**: 치명 스탯 27.94당 치명타 적중률 1%.
- **비고**: 이 계수는 **API 응답(스탯 tooltip)에 이미 최종 % 형태로 계산되어 내려온다**
  (예: 치명 732 → "치명타 적중률이 26.19% 증가합니다"). 732 / 26.19 ≈ 27.95로, 사용자가
  제공한 27.94당 1% 계수와 사실상 일치한다 — 즉 tooltip 값과 이 계수가 서로 교차검증된다.
  **따라서 이 계수를 별도로 코드에 하드코딩하지 않는다.** Stage 1 구현(`buildCritRateContribution`)처럼
  항상 tooltip 파싱값을 우선 사용하고, 이 계수는 tooltip이 없을 때의 폴백이나 검증용으로만
  `data/config/combatConstants.ts`에 참고용 상수로 남겨둔다.
- **EffectRule 매핑**: 별도 규칙 불필요 (Stage 1에서 이미 처리). `sourceType: "STAT"`.
- **confidence**: HIGH (tooltip 직접 파싱값 기준).

### 2.2 아크패시브 진화 1티어

- **효과**: 치명 특성 수치를 직접 증가시킨다 (스탯 값 자체가 오르므로 위 2.1 tooltip
  값에 이미 반영되어 나온다).
- **EffectRule 매핑**: 별도 규칙 불필요 — 스탯 값 상승은 API가 이미 합산해서 준다.
- **비고**: 노드 활성 여부를 별도로 표시하고 싶다면 "감지됨/계산 미반영 아님, 이미
  스탯에 합산됨"으로 UI에 안내한다 (스탯과 별개로 이중 반영하지 않도록 주의).

### 2.3 아크패시브 진화 2티어 — 예리한 감각

- **효과 (tooltip 원문 확인, 2026-07-04, 유우시/스트라이커, Lv.1)**: "치명타 적중률이
  `4.0%` 증가하고, 진화형 피해가 `5.0%` 증가합니다." — 크리티컬 확률(CRIT_RATE)과
  진화형 피해(별도 DAMAGE_INCREASE 버킷) **두 스탯을 동시에** 올리는 노드다. 레벨이
  오르면 두 수치 모두 비례해서 오를 것으로 추정되나(Lv.1만 확인), 레벨별 전체 수치표는
  미확인 — 항상 tooltip에서 실측한다.
- **EffectRule 초안**:
  ```json
  {
    "id": "ark-passive-evolution-sharp-sense-crit-rate",
    "sourceType": "ARK_PASSIVE",
    "target": "GLOBAL",
    "match": { "nameIncludes": ["예리한 감각"] },
    "effect": { "stat": "CRIT_RATE", "operation": "ADD_PERCENT_POINT", "valueFrom": "TOOLTIP", "unit": "PERCENT" },
    "confidence": "HIGH",
    "source": "TOOLTIP_PARSED"
  }
  ```
  같은 노드에서 "진화형 피해" 부분은 별도 규칙(`effect.stat: "DAMAGE_INCREASE"`,
  `damageBucket: "EVOLUTION"`)으로 분리해야 한다 — 하나의 tooltip 문자열에서 두 개의
  EffectRule을 매칭해야 하는 사례다.

### 2.3a 아크패시브 진화 3티어 — 일격 (사용자 제공 목록에 없던 신규 발견 항목)

- **효과 (tooltip 원문 확인, 2026-07-04, Lv.2)**: "치명타 적중률이 `20.0%` 증가하고,
  방향성 공격 스킬의 치명타 피해가 `32.0%` 증가한다." — 전역 CRIT_RATE 기여 + **스킬
  조건부(방향성 공격 스킬 한정) 치명타 피해량** 기여를 함께 가진다.
- **주의**: "방향성 공격 스킬"이 어떤 스킬 태그(예: `SkillType`)로 판별되는지는 아직
  확인하지 못했다 — `ArmorySkills[]`의 스킬 메타데이터를 추가로 조사해야 한다
  (섹션 7 "미확인" 참고). 확인 전까지는 CRIT_RATE 부분만 반영하고, 치명타 피해량
  부분은 `applied: false`로 두고 warnings에 남긴다.
- **EffectRule 초안 (CRIT_RATE 부분만)**:
  ```json
  {
    "id": "ark-passive-evolution-decisive-blow-crit-rate",
    "sourceType": "ARK_PASSIVE",
    "target": "GLOBAL",
    "match": { "nameIncludes": ["일격"] },
    "effect": { "stat": "CRIT_RATE", "operation": "ADD_PERCENT_POINT", "valueFrom": "TOOLTIP", "unit": "PERCENT" },
    "confidence": "HIGH",
    "source": "TOOLTIP_PARSED"
  }
  ```

### 2.4 아크패시브 진화 4티어 — 달인 노드

- **효과 (tooltip 원문 확인, 2026-07-04, Lv.1)**: "받는 피해가 `4.0%` 감소하며, 이동기
  및 기상기를 제외한 스킬 사용 시 10초간 '달인' 효과를 얻는다. 달인: 치명타 적중률
  `+1.4%` / 추가 피해 `+1.7%`, 최대 **5중첩**." → 5중첩 풀스택 시 `1.4% × 5 = 7.0%`로,
  사용자가 제공한 "풀스택 기준 +7%"와 정확히 일치한다.
- **중요한 정정**: 이것은 상시 적용되는 고정 버프가 아니라 **스킬 사용으로 트리거되는
  10초 지속 스택형 버프**다. 0%/100% 이분법이 아니라 섹션 7.7 원칙대로 "달인 스택
  유지율(%)"을 사용자 입력으로 받아 기대값에 반영해야 한다 (풀스택 상시 가정 금지).
- **EffectRule 초안**:
  ```json
  {
    "id": "ark-passive-evolution-master-lv1",
    "sourceType": "ARK_PASSIVE",
    "target": "GLOBAL",
    "match": { "exactName": "달인" },
    "effect": { "stat": "CRIT_RATE", "operation": "ADD_PERCENT_POINT", "valueFrom": "TOOLTIP", "unit": "PERCENT" },
    "condition": { "manualToggleRequired": true },
    "confidence": "HIGH",
    "source": "TOOLTIP_PARSED",
    "notes": "5중첩 풀스택 기준 tooltip 수치를 그대로 쓰되, 스택 유지율(%) 사용자 입력을 곱해 기대값을 낮춘다."
  }
  ```

### 2.4a 아크패시브 진화 4티어 — 회심 (사용자 제공 목록에 없던 신규 발견 항목)

- **효과 (tooltip 원문 확인, 2026-07-04, Lv.1)**: "공격이 치명타로 적중 시 적에게 주는
  피해가 `12.0%` 증가하며, 받는 피해가 `4.0%` 감소합니다." — **치명타 확률(CRIT_RATE)에는
  기여하지 않는다.** 치명타가 "발생했을 때"의 피해량 보너스(조건부 DAMAGE_INCREASE)이므로,
  섹션 4.4(헤드어택)와 같은 이유로 **CRIT_RATE 룰을 절대 만들지 않는다.**
- **EffectRule 매핑**: `effect.stat: "DAMAGE_INCREASE"`, `condition`에 "직전 공격이
  치명타였음" 같은 조건 표현이 필요 — 스킬 단위 기대값 계산에서 "치명타 확률 × 이 보너스"
  형태로 반영해야 이중 계산을 피할 수 있다 (설계는 Stage 2 엔진 확장 시 결정).

### 2.5 아크패시브 진화 5티어 — 뭉툭한 가시 (계산 방식 변경 항목)

- **효과 (tooltip 원문 확인, 2026-07-04, Lv.2)**: "진화형 피해가 `15.0%` 증가합니다.
  치명타가 발생할 확률이 최대 `80.0%`로 제한됩니다. 공격 시, 초과한 모든 치명타가
  발생할 확률의 `150.0%`가 진화형 피해로 전환됩니다. 이 노드에 의한 진화형 피해는 최대
  `75.0%`까지 적용됩니다." — 섹션 6.3에서 "미확인"으로 남겼던 **초과분 전환 비율(150%)과
  전환 상한(75%)이 실 tooltip으로 확인되었다.** 아래 6.3절을 이 수치로 갱신했다.
- **이 항목은 일반 EffectRule(ADD_PERCENT_POINT)로 표현할 수 없다.** 계산 엔진 차원의
  "모드 스위치"로 다뤄야 한다 (6.3절 참고).
- **UI 요구사항**: 사용자가 이 노드를 켰는지 여부를 명시적으로 선택하게 해야 한다
  (자동 감지는 가능하다 — `ArkPassive.Effects[]`에서 `Name`에 "뭉툭한 가시"가 포함된
  항목이 있으면 자동으로 켤 수 있다. 단 레벨별 수치가 다를 수 있어 항상 tooltip에서
  15.0%/80.0%/150.0%/75.0% 네 수치를 각각 파싱해야 한다).

### 2.6 공용 각인 — 아드레날린

- **효과**: 풀스택(3레벨 기준) 시 치명타 적중률 +20%.
- **주의**: "풀스택"이 조건이다. 아드레날린은 특정 조건(연속 적중 등)에서 스택이 쌓이는
  각인으로 알려져 있어, 상시 100% 유지가 아닐 수 있다 — 이 계산기에서는 섹션 7.7
  원칙대로 **사용자 유지율(%) 입력**을 받아 기대값에 반영한다 (0%/100% 이분법 금지).
- **구조 정정 (2026-07-04 확인)**: 이 계정의 `ArmoryEngraving.Engravings`는 `null`이었고
  각인 효과는 `ArkPassive.Effects[]`(`Name: "진화"`)에 노드로 흡수되어 나타났다(예:
  섹션 2.4 "달인" 노드). **아드레날린/정밀 단도도 별도 "각인" endpoint가 아니라
  `ArkPassive.Effects[]`의 "진화" 노드 중 하나로 나타날 가능성이 높다** — 실제로
  이 각인들을 낀 캐릭터로 재확인이 필요하다 (이 문서 작성에 쓴 캐릭터는 두 각인을
  사용하지 않아 직접 확인하지 못했다). `sourceType`을 `"ENGRAVING"`으로 유지할지
  `"ARK_PASSIVE"`로 통일할지는 재확인 후 결정한다.
- **EffectRule 초안**:
  ```json
  {
    "id": "engraving-adrenaline-lv3",
    "sourceType": "ENGRAVING",
    "target": "GLOBAL",
    "match": { "nameIncludes": ["아드레날린"] },
    "effect": { "stat": "CRIT_RATE", "operation": "ADD_PERCENT_POINT", "valueFrom": "TOOLTIP", "unit": "PERCENT" },
    "condition": { "manualToggleRequired": true },
    "confidence": "MEDIUM",
    "source": "COMMUNITY",
    "notes": "3레벨(풀스택) 기준 수치는 사용자 제공값이며 tooltip으로 재확인 전. 스택 유지율은 사용자 입력값으로 기대값 반영."
  }
  ```

### 2.7 공용 각인 — 정밀 단도

- **효과**: 치명타 적중률 증가 (아드레날린의 하위 호환 각인).
- **비고**: 아드레날린과 동시 착용 여부, 정확한 레벨별 수치는 확인 필요. 2.6절과 동일한
  이유로 `ArkPassive.Effects[]`의 "진화" 노드로 나타날 가능성이 크다 — 재확인 필요.
  `data/rules/`에 각인 레벨별 수치를 넣을 때는 `gameVersion`/`verifiedAt`/`source`를
  반드시 함께 기록한다 (CLAUDE.md 섹션 7.2).
- **confidence**: MEDIUM.

### 2.8 팔찌 — 치명타 적중률 옵션 — ✅ 구현됨 (2026-07-05)

- **효과**: 팔찌에 붙는 고정/부여 옵션 중 치명타 적중률 옵션.
- **구조 확인**: 팔찌도 `ArmoryEquipment[]`의 한 원소이며, `Tooltip`은 다른 장비와
  동일하게 **문자열 안에 JSON(`Element_000`, `Element_001`, ...)이 있고 그 값 안에
  다시 HTML 태그가 섞인 구조**다. 다만 옵션 텍스트는 `MultiTextBox`가 아니라
  **`ItemPartBox` 타입 원소의 중첩된 `value.Element_001`(제목 `value.Element_000`이
  "팔찌 효과")**에 들어있다 — 실제 팔찌("찬란한 구원자의 팔찌")로 확인했다
  (`tests/fixtures/character-equipment-example.json`).
- **구현 위치**: `src/lib/lostark/tooltip.ts`(`extractItemPartBoxText`),
  `src/lib/calculators/combat/parser/equipment.ts`
  (`parseBraceletCritRateContribution`). `sourceType: "BRACELET"`, `target: "GLOBAL"`.
  팔찌 미착용 시 기여 자체를 만들지 않고, 착용했지만 치명타 옵션이 없으면
  `applied: false`로 이유를 남긴다.

### 2.9 파티 시너지 — ✅ 구현됨 (2026-07-05, 체크박스 방식)

- **효과**: 파티원의 시너지 스킬로 치명타 적중률 증가.
- API로 파티 구성/시너지 적용 여부를 알 수 없으므로 **사용자가 체크박스로 직접
  선택**하게 했다 (CLAUDE.md 섹션 7.7). 유지율(%) 입력 대신 on/off 체크박스로
  단순화했다 — 이 시너지들은 파티원이 유지만 하면 거의 상시 적용되는 종류라
  판단해, 달인 노드(스택형 자버프)와 달리 유지율 입력을 요구하지 않는다.
- **데이터**: `src/data/config/partySynergies.ts`에 치적 10% 시너지 6개(배틀마스터/
  스트라이커/데빌헌터/건슬링어/아르카나/기상술사)를 등록했다. 출처는
  daloa.xyz/synergy(커뮤니티, 확인일 2026-07-05) — 배틀마스터 항목만 별도 검색으로
  교차검증했고 나머지 5개는 단일 출처라 `confidence: MEDIUM`이다.
- **구현 위치**: `src/lib/calculators/combat/engine.ts`
  (`buildPartySynergyContributions`). `sourceType: "MANUAL"`, `target: "GLOBAL"`.

### 2.10 도핑/버프 (물약, 음식 등)

- **효과**: 소모품으로 인한 일시적 치명타 적중률 증가.
- **EffectRule 매핑**: `sourceType: "MANUAL"`, `sourceType: "ELIXIR"`와 구분 필요 시
  세분화. 항상 사용자 입력.

## 3. 직업별(CLASS) 항목 — 깨달음(직업 각인 계승) 효과

- 직업마다 "깨달음" 아크패시브(직업 각인을 계승하는 효과) 중 자체적으로 치명타
  적중률을 올리는 노드가 있을 수 있다.
- **구조는 확인됨**: `ArkPassive.Effects[]` 중 `Name: "깨달음"`인 원소들이 여기 해당한다
  (섹션 1의 Two-Layer 표, `docs/API_NOTES.md` 참고). 형식은 진화 트리와 동일
  (JSON-in-string tooltip, `Element_002.value`에 효과 텍스트).
- **실측 예시 (2026-07-04, 유우시/스트라이커)**: 이 캐릭터의 "깨달음" 노드 5개는 전부
  "오의 스킬"(스트라이커 각성기 계열) 관련 피해량/쿨다운/게이지 효과였고, **치명타
  적중률에 기여하는 노드는 없었다** — 즉 모든 직업이 깨달음 트리에 치명타 노드를
  갖는 것은 아니며, 직업별로 개별 확인이 반드시 필요하다는 사용자 제공 전제가 실측으로도
  확인되었다.
- 직업별로 각각 확인이 필요하므로, MVP 단계(CLAUDE.md 섹션 7.8)에서는 1~2개 직업만
  `ClassBuildProfile.critRelatedArkPassiveRules`에 정밀 채우고, 나머지 직업은
  `unsupportedWarnings`에 "직업별 깨달음 효과 미반영"을 기록한다.
- 확인 불가능한 직업/노드는 룰을 만들지 않고 **warnings로만 남긴다** (추측 금지,
  CLAUDE.md 섹션 2).

## 4. 스킬별(SKILL) 항목 — 특정 스킬에만 적용

**공통 원칙(CLAUDE.md Do Not 규칙)**: 이 섹션의 효과는 절대 전역(GLOBAL) 치명타 확률에
더하지 않는다. 반드시 `target: "SKILL"` 또는 `target: "SKILL_TYPE"`으로 한정하고,
스킬별 치명타 확률을 별도로 계산한다 (섹션 7.3).

### 4.1 트라이포드 — 스킬별 치명타 적중률 증가 — ✅ 구현됨 (2026-07-05)

- **효과**: 특정 스킬의 특정 트라이포드 선택 시 그 스킬에만 치명타 적중률 증가.
- **구조 확인**: `ArmorySkills[].Tripods[]` 배열. 원소 구조:
  ```json
  { "Tier": 0, "Slot": 1, "Name": "암흑 공격", "IsSelected": false,
    "Tooltip": "<font ...>공격의 치명타 적중률이 <FONT COLOR='#99ff99'>40.0%</FONT> 증가한다...</font>" }
  ```
  - **`IsSelected: false`인 트라이포드의 효과는 절대 반영하지 않는다** — 실제로 이
    캐릭터도 "암흑 공격"(치적 +40%)을 선택하지 않은 상태였다. 트라이포드는 같은
    `Slot`(보통 1~3단계, 단계별 3택1) 안에서 하나만 선택 가능하므로, `IsSelected`
    필터링이 없으면 미선택 트라이포드까지 전부 합산하는 심각한 오류가 난다.
  - `Tooltip`은 **단순 태그 문자열**이라(JSON-in-string이 아님) 기존
    `extractPercentAfterKeyword(tooltip, "치명타 적중률")`을 그대로 재사용할 수 있다.
- **구현 위치**: `src/lib/calculators/combat/parser/tripods.ts`
  (`parseTripodCritRateContributions`, `groupSkillCritBonusByName`). `sourceType:
  "TRIPOD"`, `target: "SKILL"`. 전역 치명타 확률에는 절대 섞이지 않고, 엔진이
  "GLOBAL 합계 + 그 스킬의 SKILL 기여"로 스킬별 최종 치명타 확률을 별도 계산해
  `skillCritRates[]`로 반환한다(섹션 6.2 참고). UI는 트라이포드를 선택한 스킬만
  표로 보여준다(전체 스킬 목록을 다 보여주지 않음).

### 4.2 스킬 자체 치명타 보정

- **효과**: 트라이포드 선택과 무관하게 스킬 자체 설명에 치명타 보정이 명시된 경우.
- **구조 확인 (2026-07-04)**: `ArmorySkills[].Tooltip`은 트라이포드와 달리 **문자열
  안에 JSON(`Element_XXX`)이 있고 그 값 안에 다시 HTML이 섞인 구조**다 — 스킬 자체
  tooltip을 파싱하려면 트라이포드용 파서와는 별도로 JSON 파싱 단계가 필요하다.
- **EffectRule 매핑**: `sourceType: "SKILL"`, `target: "SKILL"`. 어느 `Element_XXX`에
  치명타 관련 설명이 들어가는지는 실제로 치명타 보정이 있는 스킬을 찾아 확인해야
  한다(이 문서에 쓴 캐릭터의 스킬에서는 발견하지 못했다).

### 4.3 백어택 조건

- **효과**: 해당 스킬이 백어택 판정 스킬일 경우 치명타 적중률 +10%p.
- **처리 방식**: 0%/100% 이분법이 아니라 **사용자가 입력한 유지율(%)**을 기대값에
  반영한다 (CLAUDE.md 섹션 7.7). 예: 유지율 70% 입력 시 기대 기여분 = 10% × 0.7 = 7%p.
- **EffectRule 매핑**: `target: "SKILL"`, `condition.requiresBackAttack: true`,
  `condition.manualToggleRequired`가 아니라 유지율 입력 필드와 결합.

### 4.4 헤드어택 조건 — ⚠️ 치명타 적중률에는 기여하지 않음

- **효과**: 피해량 +20%, 무력화 +10%만 적용되며 **치명타 적중률 보정은 없다.**
- **왜 여기에 적는가**: 백어택과 세트로 다뤄지기 쉬워 실수로 헤드어택에도 치명타
  적중률을 더하는 버그가 나기 쉽다. CLAUDE.md Do Not 규칙("특정 스킬 전용 효과를 전역
  치명타 확률에 잘못 더하지 않는다")과 별개로, **헤드어택은 애초에 CRIT_RATE 스탯이
  아니라 DAMAGE_INCREASE 스탯으로만 룰을 만들어야 한다.** 치명타 계산기(이 문서 범위)
  구현 시 헤드어택 관련 EffectRule을 만들지 않거나, 만들더라도 `effect.stat`을
  `"DAMAGE_INCREASE"`로만 지정한다.

## 5. 카드 세트

### 5.1 세구빛 (세계수의 구원 + 빛의 수호자)

- **효과**: 현재 딜러 표준 카드 세트. **치명타 적중률을 직접 증가시키지 않는다.**
- **EffectRule 매핑**: 불필요 (치명타 계산에는 기여 없음). 다른 계산기(피해량 등)에서
  다룰 항목이며 이 문서 범위 밖.

### 5.2 남바절 (군주의 지배)

- **효과**: 12각성 시 치명타 적중률 증가 효과가 있으나, **현재 딜러 표준 채용 추세가
  아니다**.
- **EffectRule 매핑**: `sourceType: "CARD"`, `target: "GLOBAL"`. 아래 5.3절에서 확인된
  구조상 "남바절 세트 (12각성합계)"라는 이름의 `Items[]` 원소로 나타날 것으로 예상되나,
  이 문서에 쓴 캐릭터는 남바절을 채용하지 않아 정확한 `Name`/`Description` 문자열을
  직접 확인하지 못했다.
- **confidence**: LOW (비주류 채용, 실 tooltip 미확인).

### 5.3 카드 세트 일반 원칙 — ✅ 구현됨 (2026-07-05)

- 카드 세트 효과는 `ArmoryCard.Effects[]`에 있다. 구조:
  ```json
  {
    "Index": 0,
    "CardSlots": [0, 1, 2],
    "Items": [
      { "Name": "세 우마르가 오리라 3세트", "Description": "가디언 토벌 시 ... 7.5% 감소" },
      { "Name": "세 우마르가 오리라 3세트 (6각성합계)", "Description": "..." },
      { "Name": "세 우마르가 오리라 3세트 (9각성합계)", "Description": "..." }
    ]
  }
  ```
  - **각성 합계 임계값 필터링 방식이 확정됐다**: `Items[]`에는 캐릭터의 현재 각성
    합계 기준으로 **이미 활성화된 임계값만** 나열된다 — 실 캐릭터(카드 3장, 각 5/5
    각성, 합계 15)로 "(15각성합계)"까지 정확히 표시됨을 확인했다. 즉 별도의 각성 합계
    계산/필터링 없이 `Items[]` 전체를 "현재 적용 중"으로 취급하면 된다(낮은 단계가
    누적 포함되는지 개별 대체되는지는 확인할 필요가 없어졌다 — API가 이미 계산해서
    준다).
  - `Description`은 **태그가 전혀 없는 순수 텍스트**다 — `stripTooltipTags` 없이 바로
    `extractPercentAfterKeyword` 적용 가능.
- **구현 위치**: `src/lib/calculators/combat/parser/cards.ts`
  (`parseCardCritRateContributions`). `Items[]`를 전부 스캔해 "치명타 적중률" 문구가
  있는 항목만 `sourceType: "CARD"`, `target: "GLOBAL"` 기여로 만든다. 남바절 등
  실제 크리티컬 카드 세트로 검증하지 못한 것은 구조만 준비되어 있고, 실제 그런
  카드를 낀 캐릭터가 나타나면 자동으로 잡힌다(이름을 미리 등록해 둘 필요가 없다 —
  섹션 5.2와 달리 이름 매칭이 아니라 "치명타 적중률" 키워드 스캔이기 때문).

## 6. 스태킹 규칙

### 6.1 기본 규칙 (CLAUDE.md 섹션 7.3 재확인)

1. **SET 룰 적용** — 이 문서 작성 중 실제 SET 사례를 발견했다: 어빌리티 스톤 각인
   "선수필승"(`ArmoryEngraving.ArkPassiveEffects`, 확인일 2026-07-04) tooltip 원문은
   "생명력이 최대인 시드 등급 이하 몬스터에게 공격 적중 시 **치명타 적중률이 100%로
   적용된다.** 또한 이 치명타는 170.00%의 추가 치명타 배율을 가진다."다. 이건
   `operation: "SET"` + 조건(대상 등급·체력 100%)이 있는 전형적인 사례이며, 이런
   룰은 조건 충족 시 다른 ADD_PERCENT_POINT 합산보다 **먼저** 적용되어야 한다
   (CLAUDE.md 섹션 7.3 원칙 그대로). 다만 이 효과는 콘텐츠 난이도가 낮은 특정 몬스터
   한정이라 일반 레이드 딜사이클 계산에는 실효성이 낮을 수 있다 — Stage 2에서 이런
   "특정 조건부 SET" 효과를 계산에 포함할지 여부는 UI에서 사용자가 토글하게 한다.
2. ADD_PERCENT_POINT 합산 — 2~5절의 대부분 항목이 여기 해당 (뭉툭한 가시 제외).
3. MULTIPLY 적용 (아직 실제 사례 미확인 — 치명타 확률을 곱연산으로 올리는 항목은
   발견하지 못했다. 발견되면 이 절에 추가한다).
4. clamp: 기본 상한 100%. **단, 2.5(뭉툭한 가시) 노드를 사용 중이면 상한이 80%로
   낮아지고, 80%를 초과하는 계산값은 치명타 확률이 아니라 "진화형 피해"라는 별도
   `DAMAGE_INCREASE` 버킷으로 전환한다 (전환 비율 150%, 이 노드로 인한 전환 상한 75% —
   6.3절 참고).**

### 6.2 스킬별 vs 전역 분리

- 전역(GLOBAL) 기여 합계 + 해당 스킬의 SKILL 기여 합계를 더한 뒤 클램프해서
  "스킬별 최종 치명타 확률"을 계산한다 (섹션 7.3, 7.6).
- 스킬 지정이 없는 화면(예: Stage 1의 "기본 계산")에서는 GLOBAL 합계만으로 전체
  기대 피해 배율을 계산하고, 스킬별 계산 기능이 추가되면(Stage 2 후반) 그때부터
  SKILL 기여를 얹는다.

### 6.3 뭉툭한 가시 처리 (계산 모드 스위치) — 실 tooltip으로 확정 (2026-07-04)

실 tooltip 원문(2.5절): "치명타가 발생할 확률이 최대 **80.0%**로 제한됩니다. 공격 시,
초과한 모든 치명타가 발생할 확률의 **150.0%**가 진화형 피해로 전환됩니다. 이 노드에
의한 진화형 피해는 최대 **75.0%**까지 적용됩니다." (Lv.2 기준 — 레벨이 다르면 세
수치가 달라질 수 있으므로 항상 tooltip에서 파싱한다).

```txt
if (hasBluntThornEvolution) {
  // capPercent(80), conversionRate(150%), conversionCap(75%)는 모두 tooltip에서 파싱한 값
  cappedCritRate = min(rawCritRate, capPercent)
  overflowCritRate = max(0, rawCritRate - capPercent)
  evolutionDamageFromOverflow = min(overflowCritRate * (conversionRate / 100), conversionCap)
  // evolutionDamageFromOverflow(%)는 치명타 확률이 아니라 진화형 피해(DAMAGE_INCREASE) 버킷에 가산
} else {
  cappedCritRate = min(rawCritRate, 100)
}
```

- 예시: `rawCritRate = 95%`일 때 → `cappedCritRate = 80%`, `overflowCritRate = 15%`,
  `evolutionDamageFromOverflow = min(15% × 1.5, 75%) = 22.5%`(진화형 피해 버킷에 가산).
- `conversionCap(75%)`은 "이 노드로 인해 전환되는 진화형 피해"의 상한이며, 예리한
  감각(2.3절)·최적화 훈련 등 **다른 노드가 주는 진화형 피해와는 별도로 합산**되는지,
  아니면 전체 진화형 피해 버킷에 공통 상한이 있는지는 확인하지 못했다 — Stage 2에서
  진화형 피해 버킷을 실제로 구현할 때 재확인한다.

### 6.4 백어택/포지셔널 조건부 항목

- 0%/100% 이분법 금지. 사용자가 입력한 유지율(%)을 항상 곱해서 기대값에 반영한다.
- 기본값(예: "보통 70% 유지")을 임의로 정하지 않는다 — 명시적 입력을 요구한다
  (CLAUDE.md 섹션 7.7).

## 7. 아직 확인되지 않은 항목

2026-07-04~05 armory API 실측 + 구현으로 섹션 2.8(팔찌), 2.9(파티 시너지),
4.1(트라이포드), 5.3(카드)까지 반영을 마쳤다 (`docs/API_NOTES.md` 참고). 남은
미확인은 다음과 같다.

- **아드레날린/정밀 단도**를 착용한 캐릭터로 재확인 — `ArkPassive.Effects[]`의 "진화"
  노드로 나타나는지, 여전히 별도 각인 시스템으로 존재하는지 확정 필요 (2.6/2.7절).
  아직 EffectRule/구현 모두 없음 — 확인되면 `data/rules/arkPassiveCrit.json`에
  추가한다.
- **직업별 "깨달음" 트리의 치명타 관련 노드** (섹션 3) — 구조는 확인됐지만 실제
  구현(파싱/룰 매칭)은 아직 하지 않았다. 직업별로 개별 확인 후 1~2개 직업부터
  추가한다.
- **스킬 자체 치명타 보정** (섹션 4.2, `ArmorySkills[].Tooltip`) — 트라이포드와
  별개로 스킬 자체 설명에 치명타 보정이 있는 스킬을 아직 발견하지 못해 미구현.
- **아크패시브 진화 2/3/4티어 노드들의 레벨별 전체 수치표** — tooltip을 그때그때
  파싱하므로 우선순위는 낮다.
- **"방향성 공격 스킬"(일격 노드, 2.3a절)을 스킬 메타데이터로 판별하는 방법** —
  `ArmorySkills[]`의 `Type`/`SkillType` 필드와 "방향성 공격"의 대응 관계 확인 필요.
  현재는 CRIT_RATE 부분만 반영하고 스킬 조건부 치명타 피해량 부분은 미반영.
- **뭉툭한 가시의 진화형 피해 상한(75%)이 다른 진화형 피해 원천과 공유되는 버킷인지,
  이 노드 전용 상한인지** (6.3절). 현재 구현은 이 노드 하나의 초과분만 계산한다.
- **남바절 카드 세트 12각성 치명타 적중률 수치** — 카드 파서는 이름을 미리 몰라도
  "치명타 적중률" 키워드로 스캔하므로 남바절을 낀 캐릭터가 조회되면 자동으로 잡힌다.
- **"선수필승" 같은 조건부 SET 효과를 딜사이클 계산에 포함할지 결정하는 UI 방식**
  (6.1절) — 아직 구현하지 않았다.
- **파티 시너지 6개 항목(배틀마스터 제외)의 공식 수치 재검증** (2.9절) — daloa.xyz
  단일 출처, MEDIUM confidence.
