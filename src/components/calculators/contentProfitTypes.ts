import type { RaidReward } from "@/data/config/raids";
import type { CharacterSibling } from "@/lib/lostark/schemas";

/** 콘텐츠 수익 계산기 화면 전용 상태 타입. 계산 로직 자체의 입력 타입과는 다르다
 * (이건 체크박스 UI 상태를 다루고, 계산 직전에 ContentProfitInput으로 변환한다). */

export type MaterialSelectionState = {
  itemName: string;
  quantity: number;
  checked: boolean;
};

export type RaidSelectionState = {
  raid: RaidReward;
  /** 이 레이드를 캐릭터 합계에 포함할지 여부 (기본은 상위 3개 자동 선택, 수동 변경 가능) */
  checked: boolean;
  materials: MaterialSelectionState[];
};

export type CharacterRosterEntry = {
  sibling: CharacterSibling;
  itemLevel: number;
  /** 이 캐릭터를 계산 대상에 포함할지 여부 */
  checked: boolean;
  eligibleRaidSelections: RaidSelectionState[];
};
