/**
 * 파티 시너지 중 치명타 적중률(치적)을 증가시키는 스킬 목록 (docs/COMBAT.md 섹션 2.9).
 *
 * API로는 파티 구성/시너지 적용 여부를 알 수 없으므로(CLAUDE.md 섹션 7.7), 사용자가
 * 체크박스로 "이 시너지를 받고 있다"를 직접 선택하게 한다. 이 카탈로그는 그 체크박스
 * 목록의 데이터다.
 *
 * 출처: daloa.xyz/synergy(커뮤니티 시너지 정리 사이트), 확인일 2026-07-04.
 * 배틀마스터 항목은 별도 웹 검색(인벤/에펨코리아)으로 "치적 10%"를 교차검증했으나,
 * 나머지 5개 직업은 daloa.xyz 표 1건에서만 확인했다 — 공식 patch note로 재검증하지
 * 못해 confidence를 MEDIUM으로 둔다. 수치가 실제 게임과 다르면 이 파일과
 * `verifiedAt`을 함께 갱신한다.
 */
export type PartySynergyOption = {
  id: string;
  className: string;
  skillName: string;
  critRatePercent: number;
  source: string;
  verifiedAt: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

const SOURCE_NOTE =
  "daloa.xyz/synergy(커뮤니티, 2026-07-04 확인). 공식 patch note로 재검증하지 못한 수치.";

export const CRIT_RATE_PARTY_SYNERGIES: PartySynergyOption[] = [
  {
    id: "battlemaster",
    className: "배틀마스터",
    skillName: "초심 / 오의 강화",
    critRatePercent: 10,
    source: `${SOURCE_NOTE} 인벤/에펨코리아 게시글로 "치적 10%"를 교차검증함.`,
    verifiedAt: "2026-07-04",
    confidence: "MEDIUM",
  },
  {
    id: "striker",
    className: "스트라이커",
    skillName: "오의난무 / 일격필살",
    critRatePercent: 10,
    source: SOURCE_NOTE,
    verifiedAt: "2026-07-04",
    confidence: "MEDIUM",
  },
  {
    id: "deadeye",
    className: "데빌헌터",
    skillName: "전술 탄환 / 핸드거너",
    critRatePercent: 10,
    source: SOURCE_NOTE,
    verifiedAt: "2026-07-04",
    confidence: "MEDIUM",
  },
  {
    id: "gunslinger",
    className: "건슬링어",
    skillName: "피스메이커 / 사냥의 시간",
    critRatePercent: 10,
    source: SOURCE_NOTE,
    verifiedAt: "2026-07-04",
    confidence: "MEDIUM",
  },
  {
    id: "arcana",
    className: "아르카나",
    skillName: "황후의 은총 / 황제의 칙령",
    critRatePercent: 10,
    source: SOURCE_NOTE,
    verifiedAt: "2026-07-04",
    confidence: "MEDIUM",
  },
  {
    id: "aeromancer",
    className: "기상술사",
    skillName: "질풍노도 / 이슬비",
    critRatePercent: 10,
    source: SOURCE_NOTE,
    verifiedAt: "2026-07-04",
    confidence: "MEDIUM",
  },
];
