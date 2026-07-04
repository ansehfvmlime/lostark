/**
 * 전투(치명타) 계산에 필요한 게임 상수. API가 제공하지 않고 패치로 바뀔 수 있는
 * 값이므로 코드 상수로 박지 않고 출처/확인일과 함께 데이터 파일로 관리한다
 * (CLAUDE.md 섹션 7.4).
 */
export type GameConstant = {
  value: number;
  source: string;
  verifiedAt: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  notes?: string;
};

/**
 * 기본 치명타 피해 배율 (치명타 적중 시 피해량이 몇 배가 되는지).
 *
 * 웹 검색으로 로스트아크 공식 patch note/도움말 문서에서 명시적 수치를 찾지
 * 못했다 — 인벤/디시 등 다수 커뮤니티 게시글에서 "치명타 발생 시 기본 피해의
 * 2배(200%)"라는 값이 공통적으로 통용되고 있어 이를 사용하되, confidence를
 * MEDIUM으로 낮춰 표시한다 (확인일 2026-07-04).
 *
 * 트라이포드/각인/카드 등으로 추가되는 치명타 피해량 상승분은 이 상수에
 * 포함되지 않으며, 이후 룰 엔진 단계에서 별도의 EffectContribution으로
 * 반영한다.
 */
export const BASE_CRIT_DAMAGE_MULTIPLIER: GameConstant = {
  value: 2.0,
  source:
    "커뮤니티 통용 지식(인벤 등 다수 게시글). 공식 patch note/도움말 문서에서 명시적 수치를 찾지 못함.",
  verifiedAt: "2026-07-04",
  confidence: "MEDIUM",
  notes:
    "트라이포드/각인/카드 등으로 추가 상승하는 치명타 피해량은 포함하지 않은 기본값만 다룬다.",
};
