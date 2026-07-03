import { z } from "zod";

import { WEEKLY_GOLD_REWARD_LIMIT, type RaidReward } from "@/data/config/raids";
import type { CalculationResult, ValueOrigin, ValueSource } from "@/types/calculation";

/**
 * 콘텐츠 수익 효율 계산기 (레이드 골드).
 *
 * 순수 함수 원칙(CLAUDE.md 섹션 4): API 호출/현재 시간 참조를 하지 않는다.
 * 레이드 보상 데이터 자체(gold/materials)는 src/data/config/raids.ts에서 가져오며,
 * 이 파일은 그 데이터를 입력받아 필터링·선택·합산만 담당한다.
 */

/** "1,805.00" 같은 콤마 포함 문자열도 숫자로 파싱한다. */
export function parseItemLevel(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 캐릭터 아이템 레벨로 입장 가능한 레이드만 남긴다. */
export function filterEligibleRaids(
  raids: RaidReward[],
  itemLevel: number
): RaidReward[] {
  return raids.filter((raid) => itemLevel >= raid.minItemLevel);
}

function raidTotalGold(raid: RaidReward): number {
  return raid.boundGold + raid.tradableGold;
}

/**
 * 같은 weeklyLockoutKey(노말/하드 등 동일 레이드) 중 가장 골드가 높은 난이도만 남기고,
 * 골드 기준 내림차순 정렬 후 상위 `limit`개를 고른다.
 * 로스트아크는 캐릭터당 주 3회까지만 레이드 골드 보상을 받을 수 있다는 실제 게임 규칙과
 * 일치하도록 기본 limit을 WEEKLY_GOLD_REWARD_LIMIT(3)으로 둔다.
 */
export function selectTopRaids(
  eligibleRaids: RaidReward[],
  limit: number = WEEKLY_GOLD_REWARD_LIMIT
): RaidReward[] {
  const bestPerGroup = new Map<string, RaidReward>();
  for (const raid of eligibleRaids) {
    const current = bestPerGroup.get(raid.weeklyLockoutKey);
    if (!current || raidTotalGold(raid) > raidTotalGold(current)) {
      bestPerGroup.set(raid.weeklyLockoutKey, raid);
    }
  }

  return Array.from(bestPerGroup.values())
    .sort((a, b) => raidTotalGold(b) - raidTotalGold(a))
    .slice(0, limit);
}

export const contentProfitMaterialSelectionSchema = z.object({
  itemName: z.string().min(1),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  /** 체크박스 상태 — 꺼져 있으면 합계에서 제외한다. */
  included: z.boolean(),
  priceOrigin: z.enum(["API", "USER", "ADMIN", "RULE_TABLE"]),
  priceFetchedAt: z.string().optional(),
  priceUnavailable: z.boolean().optional(),
});

export const contentProfitRaidSelectionSchema = z.object({
  raidId: z.string().min(1),
  raidName: z.string().min(1),
  boundGold: z.number().nonnegative(),
  tradableGold: z.number().nonnegative(),
  materials: z.array(contentProfitMaterialSelectionSchema),
});

export const contentProfitCharacterSelectionSchema = z.object({
  characterName: z.string().min(1),
  className: z.string().min(1),
  itemLevel: z.number().nonnegative(),
  raids: z.array(contentProfitRaidSelectionSchema),
});

export const contentProfitInputSchema = z.object({
  characters: z.array(contentProfitCharacterSelectionSchema),
});

export type ContentProfitMaterialSelection = z.infer<
  typeof contentProfitMaterialSelectionSchema
>;
export type ContentProfitRaidSelection = z.infer<
  typeof contentProfitRaidSelectionSchema
>;
export type ContentProfitCharacterSelection = z.infer<
  typeof contentProfitCharacterSelectionSchema
>;
export type ContentProfitInput = z.infer<typeof contentProfitInputSchema>;

export type ContentProfitRaidLine = {
  raidId: string;
  raidName: string;
  boundGold: number;
  tradableGold: number;
  materialGold: number;
  totalGold: number;
};

export type ContentProfitCharacterLine = {
  characterName: string;
  boundGold: number;
  tradableGold: number;
  materialGold: number;
  totalGold: number;
  raidLines: ContentProfitRaidLine[];
};

export type ContentProfitResultValue = {
  value: number;
  unit: "골드";
  characterCount: number;
  boundGoldTotal: number;
  tradableGoldTotal: number;
  materialGoldTotal: number;
  characterLines: ContentProfitCharacterLine[];
};

export type ContentProfitResult = CalculationResult<
  ContentProfitInput,
  ContentProfitResultValue
>;

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function resolveDataTimestamp(
  characters: ContentProfitCharacterSelection[],
  now: string
): string {
  const fetchedAtList = characters
    .flatMap((character) => character.raids)
    .flatMap((raid) => raid.materials)
    .map((material) => material.priceFetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return fetchedAtList.at(-1) ?? now;
}

/**
 * 선택된 캐릭터 × 선택된 레이드 × 체크된 재료를 합산한다.
 * 총 기대 골드 = Σ 캐릭터별(귀속 + 거래가능 + 체크된 재료 환산 골드)
 * 재료 환산 골드 = Σ (체크된 재료 개수 × 개당 시세)
 *
 * 입장 비용/소모 재화/소요 시간은 스펙상 없음 — 계산에 포함하지 않는다.
 */
export function calculateContentProfit(
  input: ContentProfitInput,
  now: string
): ContentProfitResult {
  const sources: ValueSource[] = [];
  let hadUnavailablePrice = false;

  const characterLines: ContentProfitCharacterLine[] = input.characters.map(
    (character) => {
      const raidLines: ContentProfitRaidLine[] = character.raids.map((raid) => {
        const boundGold = clampNonNegative(raid.boundGold);
        const tradableGold = clampNonNegative(raid.tradableGold);

        const materialGold = raid.materials.reduce((sum, material) => {
          if (material.priceUnavailable) hadUnavailablePrice = true;
          if (!material.included) return sum;

          const quantity = clampNonNegative(material.quantity);
          const unitPrice = clampNonNegative(material.unitPrice);
          sources.push({
            field: `${raid.raidName} · ${material.itemName}`,
            origin: material.priceOrigin as ValueOrigin,
            fetchedAt: material.priceFetchedAt,
          });
          return sum + Math.round(quantity * unitPrice);
        }, 0);

        return {
          raidId: raid.raidId,
          raidName: raid.raidName,
          boundGold,
          tradableGold,
          materialGold,
          totalGold: boundGold + tradableGold + materialGold,
        };
      });

      const totals = raidLines.reduce(
        (acc, line) => ({
          boundGold: acc.boundGold + line.boundGold,
          tradableGold: acc.tradableGold + line.tradableGold,
          materialGold: acc.materialGold + line.materialGold,
          totalGold: acc.totalGold + line.totalGold,
        }),
        { boundGold: 0, tradableGold: 0, materialGold: 0, totalGold: 0 }
      );

      return {
        characterName: character.characterName,
        ...totals,
        raidLines,
      };
    }
  );

  const grandTotals = characterLines.reduce(
    (acc, line) => ({
      boundGold: acc.boundGold + line.boundGold,
      tradableGold: acc.tradableGold + line.tradableGold,
      materialGold: acc.materialGold + line.materialGold,
      totalGold: acc.totalGold + line.totalGold,
    }),
    { boundGold: 0, tradableGold: 0, materialGold: 0, totalGold: 0 }
  );

  const warnings: string[] = [];
  if (input.characters.length === 0) {
    warnings.push("선택된 캐릭터가 없습니다.");
  }
  if (hadUnavailablePrice) {
    warnings.push("일부 재료의 거래소 시세를 가져오지 못해 0골드로 계산되었습니다.");
  }
  warnings.push(
    `캐릭터당 주 ${WEEKLY_GOLD_REWARD_LIMIT}회까지만 레이드 골드 보상을 받을 수 있는 게임 규칙을 반영해, 기본으로는 레이드를 최대 ${WEEKLY_GOLD_REWARD_LIMIT}개까지만 자동 선택합니다.`
  );
  warnings.push(
    "레이드 골드 수치는 커뮤니티 소스 1건 기준 저신뢰(LOW) 데이터입니다. 패치로 자주 바뀌므로 실제 게임 내 보상과 다를 수 있습니다."
  );
  warnings.push("거래소 가격은 실시간으로 변동될 수 있습니다.");
  warnings.push(
    "막 전용 제작 재료(아크 그리드 코어 등 귀속 재료)는 거래소 시세가 없어 재료 환산 골드에 포함되지 않습니다."
  );

  return {
    title: "콘텐츠 수익 효율 계산",
    input,
    assumptions: [
      "귀속 골드/거래 가능 골드는 레이드 풀클리어(관문 분리 없음) 기준입니다.",
      "재료 환산 골드 = 체크된 재료 개수 × 거래소 개당 시세이며, 체크 해제한 재료는 합계에서 제외됩니다.",
      "입장 비용, 소모 재화, 소요 시간은 계산에 포함하지 않습니다.",
    ],
    formula:
      "캐릭터별 합계 = Σ 레이드(귀속골드 + 거래가능골드 + Σ 체크된 재료(개수 × 개당시세)), 총 기대 골드 = Σ 선택된 캐릭터",
    sources,
    result: {
      value: grandTotals.totalGold,
      unit: "골드",
      characterCount: characterLines.length,
      boundGoldTotal: grandTotals.boundGold,
      tradableGoldTotal: grandTotals.tradableGold,
      materialGoldTotal: grandTotals.materialGold,
      characterLines,
    },
    warnings,
    dataTimestamp: resolveDataTimestamp(input.characters, now),
  };
}
