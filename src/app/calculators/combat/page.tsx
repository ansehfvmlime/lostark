"use client";

import { useState } from "react";

import { CharacterSearchForm } from "@/components/character/CharacterSearchForm";
import { CombatCritResultCard } from "@/components/combat/CombatCritResultCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CRIT_RATE_PARTY_SYNERGIES } from "@/data/config/partySynergies";
import { calculateCombatCritResult } from "@/lib/calculators/combat/engine";
import type {
  ArkPassiveEffect,
  ArmoryCard,
  CharacterStat,
  CombatSkill,
  EquipmentItem,
} from "@/lib/lostark/schemas";
import type {
  CharacterApiErrorResponse,
  CharacterArkPassiveResponse,
  CharacterCardsResponse,
  CharacterCombatSkillsResponse,
  CharacterEquipmentResponse,
  CharacterProfileResponse,
} from "@/types/character";
import type { CombatCritResult } from "@/types/combat";

type CharacterContext = {
  characterName: string;
  className: string;
  stats: CharacterStat[] | undefined;
  arkPassiveEffects: ArkPassiveEffect[] | undefined;
  armoryCard: ArmoryCard | undefined;
  equipment: EquipmentItem[] | undefined;
  skills: CombatSkill[] | undefined;
  dataTimestamp: string;
};

type CalcState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      context: CharacterContext;
      masterNodeUptimePercent: number;
      partySynergyIds: string[];
      result: CombatCritResult;
    }
  | { status: "error"; message: string };

function hasMasterNodeContribution(result: CombatCritResult): boolean {
  return result.result.contributions.some((c) => c.sourceName.includes("달인"));
}

function recompute(
  context: CharacterContext,
  masterNodeUptimePercent: number,
  partySynergyIds: string[]
): CombatCritResult {
  return calculateCombatCritResult(
    {
      characterName: context.characterName,
      className: context.className,
      stats: context.stats,
      arkPassiveEffects: context.arkPassiveEffects,
      armoryCard: context.armoryCard,
      equipment: context.equipment,
      skills: context.skills,
      masterNodeUptimePercent,
      partySynergyIds,
    },
    context.dataTimestamp
  );
}

/** armory 하위 endpoint 하나를 조회한다. 실패해도 undefined를 반환할 뿐 throw하지
 * 않는다 — 각 섹션의 실패가 전체 계산을 막지 않는다(CLAUDE.md 섹션 5 partial failure). */
async function fetchArmorySection<TResponse>(
  characterName: string,
  path: string
): Promise<TResponse | undefined> {
  try {
    const response = await fetch(
      `/api/lostark/character/${encodeURIComponent(characterName)}${path}`
    );
    if (!response.ok) return undefined;
    return (await response.json()) as TResponse;
  } catch {
    return undefined;
  }
}

export default function CombatCritCalculatorPage() {
  const [state, setState] = useState<CalcState>({ status: "idle" });

  async function handleSearch(characterName: string) {
    setState({ status: "loading" });

    try {
      const profileResponse = await fetch(
        `/api/lostark/character/${encodeURIComponent(characterName)}`
      );

      if (!profileResponse.ok) {
        const body = (await profileResponse
          .json()
          .catch(() => null)) as CharacterApiErrorResponse | null;
        setState({
          status: "error",
          message:
            body?.error ?? "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        });
        return;
      }

      const profileData = (await profileResponse.json()) as CharacterProfileResponse;

      const [arkPassiveData, cardsData, equipmentData, combatSkillsData] =
        await Promise.all([
          fetchArmorySection<CharacterArkPassiveResponse>(
            characterName,
            "/arkpassive"
          ),
          fetchArmorySection<CharacterCardsResponse>(characterName, "/cards"),
          fetchArmorySection<CharacterEquipmentResponse>(
            characterName,
            "/equipment"
          ),
          fetchArmorySection<CharacterCombatSkillsResponse>(
            characterName,
            "/combat-skills"
          ),
        ]);

      const context: CharacterContext = {
        characterName: profileData.character.CharacterName,
        className: profileData.character.CharacterClassName,
        stats: profileData.character.Stats,
        arkPassiveEffects: arkPassiveData?.arkPassive.Effects ?? undefined,
        armoryCard: cardsData?.armoryCard,
        equipment: equipmentData?.equipment,
        skills: combatSkillsData?.skills,
        dataTimestamp: profileData.dataTimestamp,
      };
      const masterNodeUptimePercent = 0;
      const partySynergyIds: string[] = [];

      setState({
        status: "success",
        context,
        masterNodeUptimePercent,
        partySynergyIds,
        result: recompute(context, masterNodeUptimePercent, partySynergyIds),
      });
    } catch {
      setState({
        status: "error",
        message: "네트워크 연결을 확인하고 다시 시도해주세요.",
      });
    }
  }

  function handleMasterNodeUptimeChange(value: number) {
    if (state.status !== "success") return;
    const clamped = Math.min(100, Math.max(0, value));
    setState({
      ...state,
      masterNodeUptimePercent: clamped,
      result: recompute(state.context, clamped, state.partySynergyIds),
    });
  }

  function handlePartySynergyToggle(id: string, checked: boolean) {
    if (state.status !== "success") return;
    const nextIds = checked
      ? [...state.partySynergyIds, id]
      : state.partySynergyIds.filter((existing) => existing !== id);
    setState({
      ...state,
      partySynergyIds: nextIds,
      result: recompute(state.context, state.masterNodeUptimePercent, nextIds),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">치명타 전투 효율 계산기</h1>
        <p className="text-sm text-muted-foreground">
          캐릭터명을 입력하면 치명 스탯, 아크패시브 진화 트리, 카드 세트, 팔찌,
          선택된 트라이포드를 종합해 치명타 확률과 기대 피해 배율을 계산합니다.
          파티 시너지는 API로 알 수 없어 아래에서 직접 선택해야 합니다.
        </p>
      </div>

      <CharacterSearchForm
        onSearch={handleSearch}
        isLoading={state.status === "loading"}
      />

      {state.status === "loading" && (
        <Skeleton className="h-48 w-full max-w-xl rounded-xl" />
      )}

      {state.status === "error" && (
        <Alert variant="destructive" className="w-full max-w-xl">
          <AlertTitle>조회 실패</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {state.status === "success" && (
        <>
          <div className="flex w-full max-w-xl flex-col gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">파티 시너지 (치명타 적중률)</p>
            <p className="text-xs text-muted-foreground">
              파티에서 아래 시너지를 받고 있다면 체크하세요. 수치는 커뮤니티
              자료 기준이며 공식 문서로 확인되지 않았습니다.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CRIT_RATE_PARTY_SYNERGIES.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={state.partySynergyIds.includes(option.id)}
                    onCheckedChange={(checked) =>
                      handlePartySynergyToggle(option.id, checked)
                    }
                  />
                  <span>
                    {option.className} · {option.skillName} (+
                    {option.critRatePercent}%)
                  </span>
                </label>
              ))}
            </div>
          </div>

          {hasMasterNodeContribution(state.result) && (
            <div className="w-full max-w-xl">
              <Label htmlFor="master-node-uptime">
                달인 스택 유지율 (%) — tooltip 수치는 5중첩 풀스택 기준이며, 실제
                전투 중 유지되는 비율을 입력하세요.
              </Label>
              <Input
                id="master-node-uptime"
                type="number"
                min={0}
                max={100}
                step="1"
                value={state.masterNodeUptimePercent}
                onChange={(event) =>
                  handleMasterNodeUptimeChange(Number(event.target.value))
                }
              />
            </div>
          )}

          <CombatCritResultCard
            result={state.result}
            characterName={state.context.characterName}
          />
        </>
      )}
    </div>
  );
}
