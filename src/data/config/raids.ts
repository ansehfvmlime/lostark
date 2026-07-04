/**
 * 콘텐츠 수익 효율 계산기용 레이드 보상 데이터.
 *
 * ⚠️ 데이터 신뢰도 주의 (2026-07-04 기준):
 * - 입장 아이템레벨: 공식 게임 가이드에서 확인 (고신뢰).
 *   https://m-lostark.game.onstove.com/GameGuide/Pages/카제로스 레이드
 * - 귀속/거래가능 골드: 커뮤니티 사이트(lobal.kr) 1건에서만 확인했다. 검색 과정에서
 *   같은 레이드에 대해 출처마다 다른 골드 수치(패치로 여러 차례 조정된 것으로 보임)가
 *   나와 교차검증하지 못했다. **저신뢰(LOW) 데이터이며, 실제 게임 내 보상과 다를 수 있다.**
 *   https://www.lobal.kr/tips/raid/raid-reward (확인일 2026-07-04)
 * - 드랍 재료 개수(2026-07-04 확인, lobal.kr 관문별 표를 막/난이도 단위로 합산):
 *   lobal.kr의 관문별(1관문/2관문/3관문) 보상 표에서 "운명의 파괴석/수호석/돌파석"
 *   수량을 가져와 풀클리어(관문 합산) 기준으로 더했다. 표에 함께 나열된 나머지 항목
 *   (운명의 파편, 구원자의 팔찌, 위대한 비상의 돌, 운명의 돌, 카르마의 잔영,
 *   담금질 재료, 업화의 쐐기돌, 순환 돌파석, 클리어 메달 등)은 **실제 Markets API
 *   호출(POST /markets/items, CategoryCode=50010 및 50000/50020/51000/51100/230000
 *   전수 조회, 확인일 2026-07-04)로 전부 `TotalCount: 0`임을 확인해 거래 불가(귀속
 *   전용) 항목으로 판단하고 재료 목록에서 제외했다.** 운명의 파괴석/수호석/돌파석은
 *   같은 방법으로 실제 거래됨을 재확인했다(각각 categoryCode 50010, 기존
 *   `HONING_MATERIAL_CATALOG`에 등록되어 있음).
 * - **주의: 라이드 보상표의 "운명의 파괴석/수호석/돌파석"에는 "(귀속)" 표시가 있다.**
 *   즉 실제로 드랍되는 개체는 계정 귀속이라 재판매할 수 없다. 여기서 계산하는
 *   "재료 환산 골드"는 실제 판매 대금이 아니라, 동일 이름의 거래소 유통 재고로
 *   환산했을 때의 **추정 가치**다 (계산 결과 카드의 assumptions에도 명시한다).
 * - 서막(붉어진 백야의 나선)은 골드 보상이 없어(커뮤니티 소스 기준) 목록에서 제외했다.
 * - 그림자 레이드 세르카(노말/하드/나이트메어)는 입장레벨을 공식 가이드로 확인해 추가했다
 *   (https://m-lostark.game.onstove.com/GameGuide/Pages/그림자 레이드, 확인일 2026-07-04).
 *   골드/재료 수치는 카제로스와 동일하게 lobal.kr 저신뢰 소스를 사용했으며, 이 소스는
 *   하드/나이트메어를 노말과 구분해 표기하지 않아 3개 난이도에 동일 수치를 적용한다.
 * - 벨가르딘 등 다른 그림자 레이드는 신뢰할 수 있는 수치를 찾지 못해 이번 버전에서는
 *   제외했다. 추후 실제 수치 확인 후 추가한다.
 *
 * 게임 룰: 캐릭터당 주 3회까지만 레이드 클리어 골드 보상을 받을 수 있다 (공식 가이드
 * "엔드 콘텐츠 현황 확인" 페이지 확인, 2026-07-04). 계산기의 "가장 높은 레이드 3개
 * 자동 선택" 로직은 이 게임 규칙과 일치한다.
 */

export type RaidDifficulty = "NORMAL" | "HARD" | "NIGHTMARE";

export type RaidMaterialReward = {
  itemName: string;
  /** 클리어 1회당 드랍 개수. 확인된 수치가 없으면 0. */
  quantity: number;
};

export type RaidReward = {
  id: string;
  raidGroup: string;
  /**
   * 같은 주간 입장/보상 제한을 공유하는 단위 키 (예: 노말/하드가 같은 값을 가짐).
   * 로스트아크는 한 레이드에 대해 캐릭터당 한 난이도로만 주간 보상을 받을 수 있으므로,
   * "레이드 3개 자동 선택" 로직은 이 키 기준으로 중복 제거한다.
   */
  weeklyLockoutKey: string;
  raidName: string;
  difficulty: RaidDifficulty;
  /** 입장 최소 아이템 레벨 */
  minItemLevel: number;
  /** 귀속 골드 (풀클리어, 관문 분리 없음) */
  boundGold: number;
  /** 거래 가능 골드 (풀클리어, 관문 분리 없음) */
  tradableGold: number;
  materials: RaidMaterialReward[];
  gameVersion: string;
  verifiedAt: string;
  source: "OFFICIAL_PATCH_NOTE" | "COMMUNITY";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  notes?: string;
};

const GOLD_SOURCE_NOTE =
  "골드 수치 출처: lobal.kr (커뮤니티, 2026-07-04 확인). 출처 간 수치가 달라 교차검증하지 못한 저신뢰 데이터 — 실제 게임 내 보상과 다를 수 있다.";

function kazerosAct(params: {
  act: number;
  raidName: string;
  normalItemLevel: number;
  hardItemLevel: number;
  totalGold: number;
  materials: RaidMaterialReward[];
}): RaidReward[] {
  const { act, raidName, normalItemLevel, hardItemLevel, totalGold, materials } =
    params;
  const boundGold = Math.round(totalGold / 2);
  const tradableGold = totalGold - boundGold;

  const base = {
    raidGroup: "카제로스 레이드",
    materials,
    gameVersion: "2026 시즌 (확인일 2026-07-04 기준 최신 패치)",
    verifiedAt: "2026-07-04",
    source: "COMMUNITY" as const,
    confidence: "LOW" as const,
    notes: GOLD_SOURCE_NOTE,
  };

  const weeklyLockoutKey = `kazeros-act${act}`;

  return [
    {
      id: `kazeros-act${act}-normal`,
      weeklyLockoutKey,
      raidName: `${raidName} (노말)`,
      difficulty: "NORMAL",
      minItemLevel: normalItemLevel,
      boundGold,
      tradableGold,
      ...base,
    },
    {
      id: `kazeros-act${act}-hard`,
      weeklyLockoutKey,
      raidName: `${raidName} (하드)`,
      difficulty: "HARD",
      minItemLevel: hardItemLevel,
      boundGold,
      tradableGold,
      ...base,
    },
  ];
}

function shadowRaidSerka(): RaidReward[] {
  const totalGold = 32_000;
  const boundGold = Math.round(totalGold / 2);
  const tradableGold = totalGold - boundGold;
  const weeklyLockoutKey = "shadow-serka";

  const base = {
    raidGroup: "그림자 레이드",
    weeklyLockoutKey,
    boundGold,
    tradableGold,
    materials: [
      { itemName: "운명의 파괴석", quantity: 1980 },
      { itemName: "운명의 수호석", quantity: 3960 },
      { itemName: "운명의 돌파석", quantity: 27 },
    ] as RaidMaterialReward[],
    gameVersion: "2026 시즌 (확인일 2026-07-04 기준 최신 패치)",
    verifiedAt: "2026-07-04",
    source: "COMMUNITY" as const,
    confidence: "LOW" as const,
    notes: GOLD_SOURCE_NOTE,
  };

  return [
    {
      id: "shadow-serka-normal",
      raidName: "그림자 레이드 세르카 (노말)",
      difficulty: "NORMAL",
      minItemLevel: 1710,
      ...base,
    },
    {
      id: "shadow-serka-hard",
      raidName: "그림자 레이드 세르카 (하드)",
      difficulty: "HARD",
      minItemLevel: 1730,
      ...base,
    },
    {
      id: "shadow-serka-nightmare",
      raidName: "그림자 레이드 세르카 (나이트메어)",
      difficulty: "NIGHTMARE",
      minItemLevel: 1740,
      ...base,
    },
  ];
}

export const RAID_REWARDS: RaidReward[] = [
  ...kazerosAct({
    act: 1,
    raidName: "카제로스 레이드 1막: 대지를 부수는 업화의 궤적",
    normalItemLevel: 1660,
    hardItemLevel: 1680,
    totalGold: 11_500,
    materials: [
      { itemName: "운명의 파괴석", quantity: 1060 },
      { itemName: "운명의 수호석", quantity: 2120 },
      { itemName: "운명의 돌파석", quantity: 9 },
    ],
  }),
  ...kazerosAct({
    act: 2,
    raidName: "카제로스 레이드 2막: 부유하는 악몽의 진혼곡",
    normalItemLevel: 1670,
    hardItemLevel: 1690,
    totalGold: 16_500,
    materials: [
      { itemName: "운명의 파괴석", quantity: 1180 },
      { itemName: "운명의 수호석", quantity: 2360 },
      { itemName: "운명의 돌파석", quantity: 11 },
    ],
  }),
  ...kazerosAct({
    act: 3,
    raidName: "카제로스 레이드 3막: 칠흑, 폭풍의 밤",
    normalItemLevel: 1680,
    hardItemLevel: 1700,
    totalGold: 21_000,
    materials: [
      { itemName: "운명의 파괴석", quantity: 1240 },
      { itemName: "운명의 수호석", quantity: 2480 },
      { itemName: "운명의 돌파석", quantity: 14 },
    ],
  }),
  ...kazerosAct({
    act: 4,
    raidName: "카제로스 레이드 4막: 파멸의 성채",
    normalItemLevel: 1700,
    hardItemLevel: 1720,
    totalGold: 27_000,
    materials: [
      { itemName: "운명의 파괴석", quantity: 1780 },
      { itemName: "운명의 수호석", quantity: 3560 },
      { itemName: "운명의 돌파석", quantity: 21 },
    ],
  }),
  ...kazerosAct({
    act: 5,
    raidName: "카제로스 레이드 종막: 최후의 날",
    normalItemLevel: 1710,
    hardItemLevel: 1730,
    totalGold: 32_000,
    materials: [
      { itemName: "운명의 파괴석", quantity: 1980 },
      { itemName: "운명의 수호석", quantity: 3960 },
      { itemName: "운명의 돌파석", quantity: 27 },
    ],
  }),
  ...shadowRaidSerka(),
];

/** 캐릭터당 주간 골드 보상 획득 가능 레이드 수 (공식 가이드 확인, 2026-07-04). */
export const WEEKLY_GOLD_REWARD_LIMIT = 3;
