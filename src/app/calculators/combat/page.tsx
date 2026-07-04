"use client";

import { useState } from "react";

import { CharacterSearchForm } from "@/components/character/CharacterSearchForm";
import { CombatCritResultCard } from "@/components/combat/CombatCritResultCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateCombatCritResult } from "@/lib/calculators/combat/engine";
import type {
  CharacterApiErrorResponse,
  CharacterProfileResponse,
} from "@/types/character";
import type { CombatCritResult } from "@/types/combat";

type CalcState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; characterName: string; result: CombatCritResult }
  | { status: "error"; message: string };

export default function CombatCritCalculatorPage() {
  const [state, setState] = useState<CalcState>({ status: "idle" });

  async function handleSearch(characterName: string) {
    setState({ status: "loading" });

    try {
      const response = await fetch(
        `/api/lostark/character/${encodeURIComponent(characterName)}`
      );

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as CharacterApiErrorResponse | null;
        setState({
          status: "error",
          message:
            body?.error ?? "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        });
        return;
      }

      const data = (await response.json()) as CharacterProfileResponse;
      const result = calculateCombatCritResult(
        {
          characterName: data.character.CharacterName,
          className: data.character.CharacterClassName,
          stats: data.character.Stats,
        },
        data.dataTimestamp
      );
      setState({
        status: "success",
        characterName: data.character.CharacterName,
        result,
      });
    } catch {
      setState({
        status: "error",
        message: "네트워크 연결을 확인하고 다시 시도해주세요.",
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">치명타 전투 효율 계산기</h1>
        <p className="text-sm text-muted-foreground">
          캐릭터명을 입력하면 프로필의 치명 스탯을 기반으로 치명타 확률과 기대
          피해 배율을 계산합니다. 현재는 치명 스탯만 반영하는 기본(BASIC)
          단계입니다.
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
        <CombatCritResultCard
          result={state.result}
          characterName={state.characterName}
        />
      )}
    </div>
  );
}
