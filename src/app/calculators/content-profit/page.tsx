"use client";

import { useState } from "react";

import { ContentProfitCharacterList } from "@/components/calculators/ContentProfitCharacterList";
import { ContentProfitLookupForm } from "@/components/calculators/ContentProfitLookupForm";
import { ContentProfitSummaryCard } from "@/components/calculators/ContentProfitSummaryCard";
import type {
  CharacterRosterEntry,
  RaidSelectionState,
} from "@/components/calculators/contentProfitTypes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RAID_REWARDS } from "@/data/config/raids";
import {
  calculateContentProfit,
  filterEligibleRaids,
  parseItemLevel,
  selectTopRaids,
  type ContentProfitInput,
  type ContentProfitResult,
} from "@/lib/calculators/contentProfit";
import type { CharacterSibling } from "@/lib/lostark/schemas";
import { resolveMarketPrice } from "@/lib/utils/marketPrice";
import type {
  CharacterApiErrorResponse,
  CharacterSiblingsResponse,
} from "@/types/character";

type RosterState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded" };

type CalcState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; result: ContentProfitResult };

function buildRosterEntry(sibling: CharacterSibling): CharacterRosterEntry {
  const itemLevel = parseItemLevel(sibling.ItemAvgLevel);
  const eligibleRaids = filterEligibleRaids(RAID_REWARDS, itemLevel);
  const topRaidIds = new Set(selectTopRaids(eligibleRaids).map((raid) => raid.id));

  const eligibleRaidSelections: RaidSelectionState[] = eligibleRaids.map(
    (raid) => ({
      raid,
      checked: topRaidIds.has(raid.id),
      materials: raid.materials.map((material) => ({
        itemName: material.itemName,
        quantity: material.quantity,
        checked: true,
      })),
    })
  );

  return {
    sibling,
    itemLevel,
    checked: topRaidIds.size > 0,
    eligibleRaidSelections,
  };
}

export default function ContentProfitCalculatorPage() {
  const [rosterState, setRosterState] = useState<RosterState>({ status: "idle" });
  const [roster, setRoster] = useState<CharacterRosterEntry[]>([]);
  const [calcState, setCalcState] = useState<CalcState>({ status: "idle" });

  async function handleLookup(characterName: string) {
    setRosterState({ status: "loading" });
    setCalcState({ status: "idle" });
    setRoster([]);

    try {
      const response = await fetch(
        `/api/lostark/character/${encodeURIComponent(characterName)}/siblings`
      );

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as CharacterApiErrorResponse | null;
        setRosterState({
          status: "error",
          message:
            body?.error ?? "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        });
        return;
      }

      const data = (await response.json()) as CharacterSiblingsResponse;
      if (data.siblings.length === 0) {
        setRosterState({
          status: "error",
          message: "원정대를 찾을 수 없습니다. 캐릭터명을 확인해주세요.",
        });
        return;
      }

      setRoster(data.siblings.map(buildRosterEntry));
      setRosterState({ status: "loaded" });
    } catch {
      setRosterState({
        status: "error",
        message: "네트워크 연결을 확인하고 다시 시도해주세요.",
      });
    }
  }

  function toggleCharacter(characterIndex: number, checked: boolean) {
    setRoster((prev) =>
      prev.map((entry, index) =>
        index === characterIndex ? { ...entry, checked } : entry
      )
    );
  }

  function toggleRaid(characterIndex: number, raidId: string, checked: boolean) {
    setRoster((prev) =>
      prev.map((entry, index) => {
        if (index !== characterIndex) return entry;
        return {
          ...entry,
          eligibleRaidSelections: entry.eligibleRaidSelections.map((raidSel) =>
            raidSel.raid.id === raidId ? { ...raidSel, checked } : raidSel
          ),
        };
      })
    );
  }

  function toggleMaterial(
    characterIndex: number,
    raidId: string,
    itemName: string,
    checked: boolean
  ) {
    setRoster((prev) =>
      prev.map((entry, index) => {
        if (index !== characterIndex) return entry;
        return {
          ...entry,
          eligibleRaidSelections: entry.eligibleRaidSelections.map((raidSel) => {
            if (raidSel.raid.id !== raidId) return raidSel;
            return {
              ...raidSel,
              materials: raidSel.materials.map((material) =>
                material.itemName === itemName
                  ? { ...material, checked }
                  : material
              ),
            };
          }),
        };
      })
    );
  }

  async function handleCalculate() {
    setCalcState({ status: "loading" });

    try {
      const selectedCharacters = roster.filter((entry) => entry.checked);

      const materialNames = new Set<string>();
      for (const character of selectedCharacters) {
        for (const raidSel of character.eligibleRaidSelections) {
          if (!raidSel.checked) continue;
          for (const material of raidSel.materials) {
            materialNames.add(material.itemName);
          }
        }
      }

      const priceEntries = await Promise.all(
        Array.from(materialNames).map((itemName) => resolveMarketPrice(itemName))
      );
      const priceMap = new Map(priceEntries.map((entry) => [entry.itemName, entry]));

      const input: ContentProfitInput = {
        characters: selectedCharacters.map((character) => ({
          characterName: character.sibling.CharacterName,
          className: character.sibling.CharacterClassName,
          itemLevel: character.itemLevel,
          raids: character.eligibleRaidSelections
            .filter((raidSel) => raidSel.checked)
            .map((raidSel) => ({
              raidId: raidSel.raid.id,
              raidName: raidSel.raid.raidName,
              boundGold: raidSel.raid.boundGold,
              tradableGold: raidSel.raid.tradableGold,
              materials: raidSel.materials.map((material) => {
                const price = priceMap.get(material.itemName);
                return {
                  itemName: material.itemName,
                  quantity: material.quantity,
                  unitPrice: price?.unitPrice ?? 0,
                  included: material.checked,
                  priceOrigin: "API" as const,
                  priceFetchedAt: price?.priceFetchedAt,
                  priceUnavailable: price?.priceUnavailable,
                };
              }),
            })),
        })),
      };

      const result = calculateContentProfit(input, new Date().toISOString());
      setCalcState({ status: "success", result });
    } catch {
      setCalcState({
        status: "error",
        message: "계산 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  }

  const hasSelectedCharacter = roster.some((entry) => entry.checked);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">콘텐츠 수익 효율 계산기</h1>
        <p className="text-sm text-muted-foreground">
          원정대를 불러오면 캐릭터별 입장 가능한 레이드를 자동으로 찾고, 아이템
          레벨 기준 가장 높은 레이드 3개를 기본 선택합니다.
        </p>
      </div>

      <ContentProfitLookupForm
        onLookup={handleLookup}
        isLoading={rosterState.status === "loading"}
      />

      {rosterState.status === "loading" && (
        <Skeleton className="h-32 w-full max-w-2xl rounded-xl" />
      )}

      {rosterState.status === "error" && (
        <Alert variant="destructive" className="w-full max-w-xl">
          <AlertTitle>원정대 조회 실패</AlertTitle>
          <AlertDescription>{rosterState.message}</AlertDescription>
        </Alert>
      )}

      {rosterState.status === "loaded" && (
        <>
          <ContentProfitCharacterList
            roster={roster}
            onToggleCharacter={toggleCharacter}
            onToggleRaid={toggleRaid}
            onToggleMaterial={toggleMaterial}
          />

          <Button
            onClick={handleCalculate}
            disabled={!hasSelectedCharacter || calcState.status === "loading"}
            className="w-full max-w-xl"
          >
            {calcState.status === "loading" ? "계산 중..." : "선택한 캐릭터 계산하기"}
          </Button>
        </>
      )}

      {calcState.status === "error" && (
        <Alert variant="destructive" className="w-full max-w-xl">
          <AlertTitle>계산 실패</AlertTitle>
          <AlertDescription>{calcState.message}</AlertDescription>
        </Alert>
      )}

      {calcState.status === "success" && (
        <ContentProfitSummaryCard result={calcState.result} />
      )}
    </div>
  );
}
