# CLAUDE.md — Lost Ark Efficiency & Critical Calculator

이 문서는 이 프로젝트에서 Claude가 항상 지켜야 할 **규칙**만 담는다.
기획, 기능 상세, 로드맵은 `docs/` 아래 문서를 참고한다.

```txt
docs/
  PLAN.md            # 프로젝트 목표, 기능 모듈 상세, MVP 로드맵
  CALCULATORS.md     # 계산기별 입력/출력/공식 명세
  COMBAT.md          # 치명타/전투 계산 모델 상세 (룰 엔진 포함)
  API_NOTES.md       # 로스트아크 Open API endpoint/제약 정리
```

---

## 1. Project Summary

로스트아크 Open API 데이터를 활용해 유저의 게임 내 의사결정을 돕는 **계산형 웹 서비스**를 만든다.

- 캐릭터 조회, 거래소/경매장 시세 기반 비용 계산
- 강화/재련, 보석, 재료, 콘텐츠 수익 등 효율 계산
- 캐릭터 세팅(각인·스킬·트라이포드·아크패시브·카드·장비)을 해석한 **치명타 전투 효율 계산**
- 모든 계산 결과는 근거, 수식, 데이터 시점을 함께 표시한다

핵심 철학: **"왜 이 결과가 나왔는지 설명 가능한 계산기"**. 계산 결과는 "정답"이 아니라 "현재 입력값 기준 추정치"로 표현한다.

참고 사이트는 lopec.kr이다. UI/기능 방향은 참고하되 내부 계산식을 복제하지 않는다. 비교 검증용으로 특정 캐릭터의 lopec 결과와 우리 결과의 차이를 기록하는 것은 허용하지만, 차이가 난다는 이유로 lopec 결과에 맞춰 룰을 역산하지 않는다.

---

## 2. Claude Working Rules

너는 이 프로젝트의 시니어 풀스택 개발자이자 시스템 설계 보조자다.

### Before Coding

코드를 작성하기 전에 다음을 먼저 제시한다.

```txt
1. 구현할 기능
2. 변경할 파일
3. 필요한 데이터/API
4. 계산식 또는 비즈니스 로직 (적용 효과 목록 포함)
5. 테스트 방법
```

### During Coding

- 한 번에 너무 많은 파일을 만들지 않는다. 기능 단위로 작게 구현한다.
- 기존 코드 스타일을 우선 따른다. 임의로 스택을 바꾸지 않는다.
- 기존 파일을 수정할 때는 변경 이유를 설명한다.
- 명시적 지시가 없는 한 "추후 분리 예정" 구조를 미리 과설계하지 않는다.

### After Coding

```txt
변경 요약:
- ...
검증 방법:
- ...
주의할 점:
- ...
다음 작업 추천:
- ...
```

### Do Not

- 로스트아크 최신 수치(확률, 재료량, 효과 계수, 보상)를 기억만으로 단정하지 않는다.
- API 문서에 없는 endpoint를 있다고 가정하지 않는다.
- JWT를 클라이언트 코드에 넣지 않는다.
- 계산식을 숨기지 않는다. 계산 근거 없이 최종 수치만 보여주지 않는다.
- 테스트 없이 계산 로직을 변경하지 않는다.
- lopec의 계산 결과를 정답으로 간주하거나 내부 계산식을 복제하지 않는다.
- API에서 제공되지 않는 효과를 자동으로 안다고 가정하지 않는다.
- 특정 스킬 전용 효과(트라이포드 등)를 전역 치명타 확률에 잘못 더하지 않는다.
- 지원하지 않는 직업을 지원한다고 표시하지 않는다.

불확실한 패치 정보, 게임 수치, 보상 구조는 추측하지 않는다. API 또는 사용자가 제공한 데이터를 우선 사용하고, 부족한 값은 "사용자 입력값" 또는 "관리자 설정값"으로 분리한다.

---

## 3. Tech Stack

MVP 기준 스택. 명시적 합의 없이 변경하지 않는다.

- **Frontend**: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Zod
- **Backend**: Next.js Route Handler (API 프록시 및 서버 로직). 기능 확장 시 별도 백엔드 분리는 명시적 결정 후에만 진행.
- **Data**: PostgreSQL + Prisma ORM
- **Cache**: MVP는 DB 기반 캐시(`ApiCache` 테이블)만 사용한다. Redis 도입은 명시적 결정 후에만 진행하며, 도입 시 "Redis 우선, DB 폴백"으로 역할을 정의한다.
- **Testing**: Vitest, Playwright(주요 화면 E2E)

---

## 4. Architecture Rules

```txt
src/
  app/
    page.tsx
    character/
    calculators/
    api/
      lostark/
  components/
    common/
    character/
    calculators/
    market/
    combat/
  lib/
    lostark/
      client.ts
      endpoints.ts
      schemas.ts
      cache.ts
      tooltip.ts        # tooltip 파싱 전용
    calculators/
      materialCost.ts
      honingCost.ts
      gemEfficiency.ts
      contentProfit.ts
      combat/           # 치명타/전투 계산 도메인
        parser/
        rules/          # 룰 엔진 로직 (룰 데이터는 data/에)
        engine.ts
    db/
      prisma.ts
    utils/
      format.ts
      number.ts
  data/
    rules/              # EffectRule JSON 데이터 (코드와 분리)
    config/             # 치명 스탯 변환 계수 등 게임 상수 설정
  types/
  tests/
    fixtures/           # 실제 API 응답 raw JSON 스냅샷
```

원칙:

- UI, API 호출, 계산 로직을 분리한다. 계산 로직은 UI 컴포넌트 안에 넣지 않는다.
- API route는 외부 API와 클라이언트 사이의 안전한 프록시다.
- 계산 로직은 **순수 함수**로 작성한다. DB 저장, API 호출, 현재 시간 참조는 계산 함수 밖에서 처리한다.
- 게임 수치(룰 값, 변환 계수)는 코드가 아니라 `data/` 아래 데이터 파일 또는 관리자 설정으로 관리한다.

---

## 5. Lost Ark API Rules

### API Key / JWT

- API JWT는 절대 클라이언트 브라우저에 노출하지 않는다. `.env.local` 또는 서버 환경변수에만 저장한다.
- `.env` 파일을 git에 커밋하지 않는다.
- 클라이언트는 로스트아크 API를 직접 호출하지 않고, 우리 서버의 API route를 통해서만 요청한다.

```env
LOSTARK_API_BASE_URL=https://developer-lostark.game.onstove.com
LOSTARK_API_JWT=your_jwt_here
DATABASE_URL=postgresql://...
```

### Request Header

```ts
{
  accept: "application/json",
  authorization: `bearer ${process.env.LOSTARK_API_JWT}`
}
// POST 요청은 추가로:
{ "Content-Type": "application/json" }
```

### Rate Limit / Caching

로스트아크 API rate limit은 빡빡하다(분당 100회 수준). 다음을 지킨다.

- 응답 헤더 `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`을 확인한다.
- 429 응답 시 즉시 재시도하지 않는다.
- 동일 요청은 캐싱하고, debouncing과 request deduplication을 적용한다. 사용자가 검색창에 입력할 때마다 API를 호출하지 않는다.
- 경매장 검색은 명시적 "검색" 버튼으로만 트리거한다. 필터 조정마다 호출하지 않는다.
- 기본 캐시 TTL 정책 (변경 시 이 표를 갱신한다):

| 데이터 | 기본 TTL | 비고 |
|---|---|---|
| 거래소 시세 | 10분 | 사용자 명시 새로고침 시 강제 갱신 허용 |
| 캐릭터 armory 전체 | 30분 | 〃 |
| 경매장 검색 결과 | 10분 | 검색 조건을 캐시 키에 포함 |

### API 실제 제약 (구현 시 반드시 반영)

- 거래소(Markets) API는 아이템명 단건 조회가 아니라 **카테고리 코드 + 검색 조건** 기반이다. 자주 쓰는 재료의 카테고리 코드/아이템명 매핑 테이블을 `data/config/`에 미리 정의한다.
- 경매장(Auctions) API는 페이지네이션과 PageNo 상한이 있으며, 허위 매물로 최저가가 왜곡될 수 있다. 최저가 1건이 아니라 **하위 N건 분포 기반 대표값**을 사용한다.
- 캐릭터명은 URL encoding을 적용한다. 한글 + 특수문자 캐릭터명은 테스트 대상이다.
- endpoint 경로는 구현 착수 시 공식 developer 포털 문서와 대조하여 `docs/API_NOTES.md`에 확정 기록한다.

### Error Handling

401, 403, 404, 415, 429, 500, 502/503/504를 구분해서 처리한다. 사용자에게는 기술적 에러 원문을 그대로 노출하지 않고 이해 가능한 메시지로 변환한다.

```txt
현재 로스트아크 API 서버가 점검 중이거나 응답하지 않습니다. 잠시 후 다시 시도해주세요.
```

**Partial failure 원칙**: armory의 특정 섹션(특히 아크패시브/아크그리드)이 Zod 검증에 실패하거나 누락되어도 전체 계산이 죽지 않는다. 해당 섹션만 "미반영" 처리하고 warnings에 기록한다.

---

## 6. Common Calculation Result Contract

모든 계산기(경제 계산기, 전투 계산기 포함)는 다음 공통 구조를 기반으로 한다.

```ts
type ValueOrigin = "API" | "USER" | "ADMIN" | "RULE_TABLE";

type ValueSource = {
  field: string;
  origin: ValueOrigin;
  fetchedAt?: string;   // API/시세 기반 값의 기준 시점
};

type CalculationResult<TInput, TValue = { value: number; unit: string }> = {
  title: string;
  input: TInput;               // 계산기별 구체 타입으로 좁힌다. Record<string, unknown> 금지
  assumptions: string[];
  formula: string;
  sources: ValueSource[];      // 어떤 값이 어디서 왔는지
  result: TValue;
  warnings: string[];
  dataTimestamp: string;
};
```

규칙:

- 모든 결과에 단위를 붙인다. 골드/실링/크리스탈/재료 수량 단위를 명확히 분리한다.
- 금액/비율 계산에서 부동소수점 오차가 문제되는 경우 Decimal 라이브러리를 사용한다.
- 확률 계산은 기대값과 실제 결과가 다를 수 있음을 표시한다.
- API 제공 값과 사용자 입력값을 `sources`로 구분하고, UI에서 색상/라벨로 표시한다.
- 전투(치명타) 계산 결과 타입은 이 구조를 확장한 특수화로 정의한다 (섹션 8 참조).

### 강화/재련 기대 비용 계산 — 수학 규칙

- 단순 기하분포(기대 시도 = 1/p)로 계산하지 않는다. 로스트아크 재련은 **실패 시 확률 증가(누적 보정)와 장인의 기운 100% 천장**이 있으므로, 단계별 상태를 갖는 **마르코프 체인 또는 점화식/시뮬레이션**으로 기대 비용을 계산한다.
- "보수적 시나리오"는 정의를 명시한다: 장인의 기운 천장 도달 비용(최악 확정 비용)과 percentile 기반 비용(예: 90% 분위)을 구분해서 표시한다.
- 성공 확률과 재료 요구량은 하드코딩하지 않는다. 초기 버전은 사용자 직접 입력, 추후 관리자 설정 테이블로 관리한다.

---

## 7. Combat (Critical) Calculation — Core Rules

상세 모델은 `docs/COMBAT.md`에 두고, 여기에는 절대 규칙만 적는다.

### 7.1 Two-Layer Principle

API는 "무엇을 착용했는지"를 알려줄 뿐, "최종 치명타 확률에 몇 %p 더해지는지"를 항상 구조화해서 주지 않는다. 따라서:

```txt
1. API 수집 계층: 프로필/장비/각인/카드/보석/스킬/트라이포드/아크패시브/아크그리드
2. 효과 해석 계층: tooltip 파싱 → 룰 매칭 → 치명타 확률/피해량 계산
```

Claude는 항상 "API에서 직접 얻을 수 있는 값"과 "룰 테이블로 해석해야 하는 값"을 구분해서 설명한 뒤 구현한다.

### 7.2 Rule Engine

각인, 트라이포드, 카드, 장비, 아크패시브 효과를 if문으로 흩뿌리지 않는다. 모든 효과는 `EffectRule`로 관리한다.

```ts
type EffectRule = {
  id: string;
  sourceType: "STAT" | "ENGRAVING" | "SKILL" | "TRIPOD" | "EQUIPMENT"
    | "BRACELET" | "ELIXIR" | "CARD" | "ARK_PASSIVE" | "ARK_GRID" | "MANUAL";
  target: "GLOBAL" | "SKILL" | "SKILL_TYPE" | "CLASS" | "CONDITION";
  className?: string;
  skillName?: string;
  skillType?: string;
  match: {
    nameIncludes?: string[];
    descriptionIncludes?: string[];
    exactName?: string;
  };
  effect: {
    stat: "CRIT_RATE" | "CRIT_DAMAGE" | "DAMAGE_INCREASE"
      | "ATTACK_POWER" | "WEAPON_POWER" | "COOLDOWN_REDUCTION";
    operation: "ADD_PERCENT_POINT" | "MULTIPLY" | "SET" | "CONDITIONAL";
    value?: number;              // tooltip 파싱값을 우선 사용하는 경우 생략 가능
    valueFrom?: "TOOLTIP";       // 수치는 tooltip에서, 분류(의미)는 룰에서
    unit: "PERCENT" | "MULTIPLIER" | "POINT";
    damageBucket?: string;       // DAMAGE_INCREASE 계열의 곱연산 버킷 식별자
  };
  condition?: {
    requiresBackAttack?: boolean;
    requiresHeadAttack?: boolean;
    requiresSkillName?: string;
    requiresSkillType?: string;
    requiresEngraving?: string;
    requiresArkPassiveNode?: string;
    manualToggleRequired?: boolean;
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  // 버전 관리 메타데이터 (필수)
  gameVersion?: string;                                            // 작성 기준 패치/시즌
  verifiedAt: string;                                              // 마지막 검증일
  source: "TOOLTIP_PARSED" | "OFFICIAL_PATCH_NOTE" | "COMMUNITY" | "MANUAL";
};
```

룰 관리 원칙:

- 룰은 코드가 아니라 `data/rules/` 아래 **데이터 파일(JSON)** 로 관리하며, 패치 시 코드 배포 없이 갱신 가능해야 한다.
- 가능하면 수치는 tooltip 파싱값(`valueFrom: "TOOLTIP"`)을 우선 사용하고, 룰은 "이 효과가 어떤 스탯에 해당하는가"라는 **분류** 를 담당한다. 각인처럼 레벨별 수치가 있는 효과는 특히 룰에 수치를 박지 않는다.
- 게임 수치를 룰에 직접 넣어야 하는 경우 `gameVersion`, `verifiedAt`, `source`를 반드시 기록한다.

### 7.3 Stacking & Application Order (절대 규칙)

계산 파이프라인은 항상 다음 순서를 따른다. 구현 순서에 따라 결과가 달라져서는 안 된다.

```txt
1. SET 룰 적용 (조건 충족 시 다른 보정보다 우선, 충돌 시 warnings 기록)
2. ADD_PERCENT_POINT 합산
3. MULTIPLY 적용
4. clamp (치명타 확률은 0% ~ 100%)
```

- 치명타 확률(CRIT_RATE): %p **합연산** 후 100% 상한 클램프.
- DAMAGE_INCREASE 계열: 동일 `damageBucket` 내 **합연산**, 버킷 간 **곱연산**. 버킷 분류가 불확실한 효과는 `confidence: "LOW"`로 격리한다.
- 특정 스킬 전용 효과는 해당 스킬의 계산에만 반영한다. 전역 확률에 더하지 않는다. 가능한 경우 스킬별 치명타 확률을 따로 계산한다.

기대 피해 배율 기본 공식:

```txt
스킬 기대 피해 배율 = (최종 치명타 확률 × 최종 치명타 피해 배율) + (비치명 확률 × 1)
```

### 7.4 Game Constants

- **치명 스탯 → 치명타 확률 변환 계수**와 **기본 치명타 피해 배율**은 API가 주지 않는 값이며 패치로 바뀔 수 있다. 코드 상수가 아니라 `data/config/`의 설정 파일로 관리하고, 출처와 기준일을 함께 기록한다.

### 7.5 Confidence 레벨별 기본 동작

| 레벨 | 기본 동작 |
|---|---|
| HIGH | 계산에 기본 반영 |
| MEDIUM | 반영하되, 결과에 "추정 반영" 표시 |
| LOW | 기본 미반영. 사용자가 토글로 켤 수 있음 |

`EffectContribution.applied`는 이 규칙과 사용자 토글 상태로 결정된다.

### 7.6 Effect Contribution

계산 결과에는 반영/미반영 효과를 모두 남긴다.

```ts
type EffectContribution = {
  sourceType: string;
  sourceName: string;
  target: "GLOBAL" | "SKILL";
  targetSkillName?: string;
  stat: string;
  value: number;
  unit: string;
  applied: boolean;
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};
```

### 7.7 Conditional / Positional Effects

- 백어택/헤드어택 등 포지셔널 조건부 효과는 0%/100% 이분법으로 처리하지 않는다. 사용자가 입력한 **유지율(%)** 을 기대값에 반영한다. 기본값을 임의로 정하지 않고 명시 입력을 요구한다.
- 파티 시너지, 도핑, 버프 유지율은 수동 입력값(MANUAL)으로만 반영하고 `sources`에 표시한다.

### 7.8 Class Build Profile & Accuracy Level

```ts
type ClassBuildProfile = {
  className: string;
  supported: boolean;
  knownClassEngravings: string[];
  mainDamageSkills: string[];
  defaultSkillWeights?: {
    weights: Record<string, number>;
    source: string;        // 출처 필수 (커뮤니티 통계 등)
    verifiedAt: string;
  };
  critRelatedSkillRules: EffectRule[];
  critRelatedEngravingRules: EffectRule[];
  critRelatedArkPassiveRules: EffectRule[];
  unsupportedWarnings: string[];
};

type CalculationAccuracyLevel =
  | "BASIC"                // 치명 스탯 기반 계산만
  | "PARTIAL_CLASS_RULES"  // 일부 룰 반영, 미반영 항목 warnings 표시
  | "FULL_CLASS_RULES"     // 주요 각인/스킬/트라이포드/아크패시브 반영
  | "MANUAL_ASSISTED";     // 조건부 효과를 사용자 입력으로 보정
```

- 모든 직업을 처음부터 완벽 지원하지 않는다. MVP는 1~2개 직업만 정밀 지원하고, 나머지는 "기본 분석 모드"로 처리한다.
- `defaultSkillWeights`는 API로 얻을 수 없는 값이다. 제공 시 출처와 신뢰도를 반드시 표시하며, 이 값에 의존한 최종 수치는 "추정치"임을 UI에 명시한다.

---

## 8. Parser Strategy

외부 API 응답 처리 순서:

```txt
1. Raw API JSON 저장
2. Zod schema로 최소 구조 검증 (섹션 단위 partial failure 허용)
3. 캐릭터 직업 확인
4. 전투 스탯 파싱
5. tooltip 파싱: 문자열 → JSON 파싱 → HTML 태그 제거 → 텍스트 정규화
6. 치명타 관련 키워드 후보 추출
7. 룰 엔진 매칭
8. 반영/미반영 효과 분리
9. 계산 결과 생성 (근거 + warnings 포함)
```

- 장비/스킬 tooltip은 문자열 안에 JSON이 들어 있고 그 안에 HTML 태그가 섞인 구조다. 파싱 로직은 `lib/lostark/tooltip.ts`에 격리한다.
- **키워드는 후보 탐지 전용이다.** 확정 반영은 rule table 매칭만 한다. 매칭은 "치명타 적중률"처럼 긴 구문 우선으로 하고, "적중률", "치명" 같은 짧은 단어는 후보 플래그 전용으로만 쓴다 (오탐 위험).
- 미등록 효과는 "감지됨 / 계산 미반영"으로 표시하고 반드시 사용자에게 보여준다.
- 파싱 실패 항목은 계산에서 제외하고 warnings에 기록한다.

---

## 9. Data Modeling

초기 모델: `User`, `CharacterSnapshot`, `ItemPriceSnapshot`, `CalculationPreset`, `CalculationHistory`, `ApiCache`. 상세 필드는 `docs/PLAN.md` 참조.

- 로그인은 후순위(Phase 6)이므로, 그 전까지 `userId`는 **nullable**로 두고 익명 세션 키(`sessionKey`)를 병행한다. 스키마 마이그레이션을 미리 고려한다.
- 캐시는 `ApiCache` 테이블(cacheKey, responseJson, expiresAt)로 통일한다 (섹션 3 참조).
- 룰 데이터(`data/rules/`)와 게임 상수(`data/config/`)는 DB가 아니라 버전 관리되는 데이터 파일로 시작하고, 관리자 기능 도입 시 DB 이관을 검토한다.

---

## 10. Code Style Rules

### TypeScript

- `any` 사용을 피한다. `Record<string, unknown>`으로 얼버무리지 않고 도메인 타입으로 좁힌다.
- 외부 API 응답은 반드시 Zod schema로 검증한다.
- 계산 함수는 `src/lib/calculators`, API client는 `src/lib/lostark`, 공통 타입은 `src/types` 또는 도메인 폴더에 둔다.

### Naming

- 컴포넌트: PascalCase / 함수: camelCase / 타입: PascalCase / 상수: UPPER_SNAKE_CASE
- API route 파일은 Next.js convention을 따른다.

### Comments

주석은 다음 경우에만 작성한다: 계산 수식 설명, API 응답 구조상 헷갈리는 부분, rate limit/cache 정책, 게임 수치의 출처 또는 가정, 성능 최적화 이유.

---

## 11. UI/UX Rules

- 숫자를 크게 보여주되 근거를 숨기지 않는다. 결과 카드 아래 "계산 근거 보기"를 제공한다.
- 시세/데이터 갱신 시점을 명확히 표시한다.
- 직접 입력값과 API 기반 값을 색상 또는 라벨로 구분한다 (`sources` 기반).
- 계산 정확도 레벨과 미반영 효과 개수를 대시보드에 표시한다.
- 검색 결과, 계산 결과, 경고 메시지를 분리해서 보여준다.
- 모바일에서도 계산기 입력이 편해야 한다.

예시 결과 카드 (날짜는 실제 데이터 시점을 렌더링):

```txt
예상 총 비용: 128,430 골드
기준 시세: {dataTimestamp} 갱신
계산 방식: 부족 재료 수량 × 현재 최저가
주의: 거래소 가격은 실시간으로 변동될 수 있습니다.
```

치명타 대시보드는 스탯/각인/트라이포드/카드/장비/아크패시브/수동입력의 기여를 항목별로 분해해서 표시한다. 합산 표시는 섹션 7.3의 스태킹 규칙을 따른다.

### Warnings Policy

다음 상황에서는 반드시 경고를 표시한다:

- 직업이 정밀 지원되지 않는 경우
- 트라이포드/각인/아크패시브 효과를 해석하지 못한 경우
- 스킬별 딜 지분 데이터가 없거나 출처가 커뮤니티 추정인 경우
- 백어택/헤드어택 조건이 필요한 경우
- 파티 시너지/도핑이 수동 입력값인 경우
- API 응답 누락 또는 동기화 지연 가능성이 있는 경우

---

## 12. Security Rules

- API JWT를 절대 클라이언트에 노출하지 않는다. `.env`를 커밋하지 않는다.
- 사용자 입력값(캐릭터명, 아이템명, 검색 조건, 계산 입력)은 Zod로 validation한다.
- 서버 API route에도 자체 rate limit을 둔다.
- 외부 API 오류 메시지를 그대로 사용자에게 노출하지 않는다.
- 관리자 기능 도입 시 인증/권한을 분리한다.

---

## 13. Testing Rules

계산 로직은 반드시 테스트와 함께 작성/변경한다.

### Unit Test Required

- 재료 비용, 기대 비용(마르코프/점화식 검증 포함), 보석 구매 vs 합성, 시간당 수익
- 치명타 스태킹 순서: SET → ADD → MULTIPLY → clamp 검증
- 스킬 전용 효과가 전역에 새지 않는지 검증
- confidence 레벨별 applied 동작 검증
- 입력값 0/누락, 음수 입력 방지, 소수점 반올림, 치명타 확률 100% 클램프

### API / Parser Test Required

- 정상 응답, 401, 429, 503, 응답 구조 변경 mock
- 캐시 hit/miss 테스트
- **실캐릭터 raw JSON fixture** 기반 파서 회귀 테스트. fixture에는 수집일과 게임 버전을 기록한다 (`tests/fixtures/`).
- tooltip 파싱: JSON-in-string, HTML 태그 제거, 파싱 실패 시 미반영 처리
- 한글 + 특수문자 캐릭터명 URL encoding

### UI Test Recommended

- 캐릭터 검색, 계산기 입력, 결과 표시, 계산 근거 펼치기, API 장애 메시지, 미반영 효과 표시

---

## 14. MVP Roadmap (요약)

상세는 `docs/PLAN.md` 참조.

1. **Phase 1**: 프로젝트 세팅, API client, 캐릭터 검색/거래소 조회 route, rate limit/에러 처리, endpoint 공식 문서 대조
2. **Phase 2**: 기본 화면 (메인, 캐릭터 검색, 시세 조회, 계산기 목록, 공통 결과 카드)
3. **Phase 3**: 첫 계산기 — 재료 구매 비용 계산기 + 단위 테스트
4. **Phase 4**: 가격 캐싱, 스냅샷 저장, 갱신 시점 표시
5. **Phase 5**: 강화/재련 기대 비용, 보석 효율, 콘텐츠 수익, 세팅 비용 계산기
6. **전투 계산 MVP**: (1) 프로필/치명 스탯 기반 기본 계산 → (2) 직업 1개 정밀 지원 + 룰 테이블 + 스킬별 치명타 → (3) 지원 직업 확대 + 아크패시브/장비 파싱 강화 + 수동 보정 UI → (4) 딜 지분 입력 + 전체 기대 피해 + 세팅 전후 비교
7. **Phase 6**: 로그인, 즐겨찾기, 프리셋, 히스토리, 대시보드

### First Implementation Target

```txt
MVP 1차 목표:
캐릭터명을 입력하면 서버 API route를 통해 로스트아크 Open API를 호출하고,
캐릭터 기본 정보를 화면에 표시한다.
동시에 JWT 보안, 에러 처리, 응답 타입 검증, 캐싱 구조의 기반을 만든다.
```

완료 기준:

- 브라우저에 JWT가 노출되지 않는다.
- 캐릭터 검색 성공/실패/점검/rate limit이 구분된다.
- API 장애 메시지가 사용자 친화적으로 표시된다.
- 응답 데이터 타입(Zod schema)이 정의되어 있다.
- 추후 계산기에서 재사용 가능한 API client + 캐시 구조가 만들어져 있다.
