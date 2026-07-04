"use client";

import { useState } from "react";

import { CharacterSearchForm } from "@/components/character/CharacterSearchForm";
import { CombatCritResultCard } from "@/components/combat/CombatCritResultCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateCombatCritResult } from "@/lib/calculators/combat/engine";
import type { ArkPassiveEffect, CharacterStat } from "@/lib/lostark/schemas";
import type {
  CharacterApiErrorResponse,
  CharacterArkPassiveResponse,
  CharacterProfileResponse,
} from "@/types/character";
import type { CombatCritResult } from "@/types/combat";

type CharacterContext = {
  characterName: string;
  className: string;
  stats: CharacterStat[] | undefined;
  arkPassiveEffects: ArkPassiveEffect[] | undefined;
  dataTimestamp: string;
};

type CalcState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      context: CharacterContext;
      masterNodeUptimePercent: number;
      result: CombatCritResult;
    }
  | { status: "error"; message: string };

function hasMasterNodeContribution(result: CombatCritResult): boolean {
  return result.result.contributions.some((c) => c.sourceName.includes("달인"));
}

function recompute(
  context: CharacterContext,
  masterNodeUptimePercent: number
): CombatCritResult {
  return calculateCombatCritResult(
    {
      characterName: context.characterName,
      className: context.className,
      stats: context.stats,
      arkPassiveEffects: context.arkPassiveEffects,
      masterNodeUptimePercent,
    },
    context.dataTimestamp
  );
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

      // 아크패시브 조회 실패는 전체 계산을 막지 않고 BASIC 단계로 폴백한다
      // (CLAUDE.md 섹션 5 partial failure 원칙).
      let arkPassiveEffects: ArkPassiveEffect[] | undefined;
      try {
        const arkPassiveResponse = await fetch(
          `/api/lostark/character/${encodeURIComponent(characterName)}/arkpassive`
        );
        if (arkPassiveResponse.ok) {
          const arkPassiveData =
            (await arkPassiveResponse.json()) as CharacterArkPassiveResponse;
          arkPassiveEffects = arkPassiveData.arkPassive.Effects;
        }
      } catch {
        // 무시하고 BASIC으로 진행
      }

      const context: CharacterContext = {
        characterName: profileData.character.CharacterName,
        className: profileData.character.CharacterClassName,
        stats: profileData.character.Stats,
        arkPassiveEffects,
        dataTimestamp: profileData.dataTimestamp,
      };
      const masterNodeUptimePercent = 0;

      setState({
        status: "success",
        context,
        masterNodeUptimePercent,
        result: recompute(context, masterNodeUptimePercent),
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
      result: recompute(state.context, clamped),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">치명타 전투 효율 계산기</h1>
        <p className="text-sm text-muted-foreground">
          캐릭터명을 입력하면 프로필의 치명 스탯과 아크패시브 진화 트리를
          기반으로 치명타 확률과 기대 피해 배율을 계산합니다. 트라이포드/카드/
          팔찌/파티 시너지 등은 아직 반영되지 않습니다.
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
