/**
 * 재료 구매 비용 계산기용 재련 재료 카탈로그.
 *
 * 출처: 실 API 호출(POST /markets/items, CategoryCode=50010 "재련 재료") 전수 조회로 확인.
 * 확인일: 2026-07-04. 게임 수치(가격)는 없고 이름/ID/카테고리 코드만 담는다 — 가격은
 * 항상 거래소 API로 그때그때 조회한다 (CLAUDE.md 섹션 5, 게임 수치 하드코딩 금지).
 *
 * 목록을 넓힐 때는 실제 API 조회로 재검증 후 추가한다 (docs/API_NOTES.md 참고).
 */

export const MARKET_CATEGORY_CODE = {
  /** 강화 재료 > 재련 재료 */
  HONING_MATERIAL: 50010,
} as const;

export type MaterialCatalogEntry = {
  itemId: number;
  itemName: string;
  categoryCode: number;
};

export const HONING_MATERIAL_CATALOG: MaterialCatalogEntry[] = [
  { itemId: 66102101, itemName: "수호석 조각", categoryCode: 50010 },
  { itemId: 66102103, itemName: "수호석 결정", categoryCode: 50010 },
  { itemId: 66102102, itemName: "수호석", categoryCode: 50010 },
  { itemId: 66102104, itemName: "수호강석", categoryCode: 50010 },
  { itemId: 66102105, itemName: "정제된 수호강석", categoryCode: 50010 },
  { itemId: 66102106, itemName: "운명의 수호석", categoryCode: 50010 },
  { itemId: 66102107, itemName: "운명의 수호석 결정", categoryCode: 50010 },
  { itemId: 66102001, itemName: "파괴석 조각", categoryCode: 50010 },
  { itemId: 66102003, itemName: "파괴석 결정", categoryCode: 50010 },
  { itemId: 66102002, itemName: "파괴석", categoryCode: 50010 },
  { itemId: 66102004, itemName: "파괴강석", categoryCode: 50010 },
  { itemId: 66102005, itemName: "정제된 파괴강석", categoryCode: 50010 },
  { itemId: 66102006, itemName: "운명의 파괴석", categoryCode: 50010 },
  { itemId: 66102007, itemName: "운명의 파괴석 결정", categoryCode: 50010 },
  { itemId: 6861008, itemName: "오레하 융화 재료", categoryCode: 50010 },
  { itemId: 6861009, itemName: "상급 오레하 융화 재료", categoryCode: 50010 },
  { itemId: 6861011, itemName: "최상급 오레하 융화 재료", categoryCode: 50010 },
  { itemId: 6861012, itemName: "아비도스 융화 재료", categoryCode: 50010 },
  { itemId: 6861013, itemName: "상급 아비도스 융화 재료", categoryCode: 50010 },
  { itemId: 66110204, itemName: "조화의 돌파석", categoryCode: 50010 },
  { itemId: 66110214, itemName: "생명의 돌파석", categoryCode: 50010 },
  { itemId: 66110221, itemName: "명예의 돌파석", categoryCode: 50010 },
  { itemId: 66110222, itemName: "위대한 명예의 돌파석", categoryCode: 50010 },
  { itemId: 66110223, itemName: "경이로운 명예의 돌파석", categoryCode: 50010 },
  { itemId: 66110224, itemName: "찬란한 명예의 돌파석", categoryCode: 50010 },
  { itemId: 66110225, itemName: "운명의 돌파석", categoryCode: 50010 },
  { itemId: 66110226, itemName: "위대한 운명의 돌파석", categoryCode: 50010 },
  { itemId: 66130131, itemName: "명예의 파편 주머니(소)", categoryCode: 50010 },
  { itemId: 66130132, itemName: "명예의 파편 주머니(중)", categoryCode: 50010 },
  { itemId: 66130133, itemName: "명예의 파편 주머니(대)", categoryCode: 50010 },
  { itemId: 66130141, itemName: "운명의 파편 주머니(소)", categoryCode: 50010 },
  { itemId: 66130142, itemName: "운명의 파편 주머니(중)", categoryCode: 50010 },
  { itemId: 66130143, itemName: "운명의 파편 주머니(대)", categoryCode: 50010 },
];
