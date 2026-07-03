"use client";

import { useState } from "react";

import { CharacterProfileCard } from "@/components/character/CharacterProfileCard";
import { CharacterSearchForm } from "@/components/character/CharacterSearchForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CharacterApiErrorResponse,
  CharacterProfileResponse,
} from "@/types/character";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: CharacterProfileResponse }
  | { status: "error"; message: string };

export default function CharacterSearchPage() {
  const [state, setState] = useState<SearchState>({ status: "idle" });

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
          message: body?.error ?? "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        });
        return;
      }

      const data = (await response.json()) as CharacterProfileResponse;
      setState({ status: "success", data });
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
        <h1 className="text-2xl font-semibold">캐릭터 검색</h1>
        <p className="text-sm text-muted-foreground">
          캐릭터명을 입력하면 로스트아크 Open API 기준 기본 정보를 조회합니다.
        </p>
      </div>

      <CharacterSearchForm
        onSearch={handleSearch}
        isLoading={state.status === "loading"}
      />

      {state.status === "loading" && (
        <Skeleton className="h-28 w-full max-w-xl rounded-xl" />
      )}

      {state.status === "error" && (
        <Alert variant="destructive" className="w-full max-w-xl">
          <AlertTitle>조회 실패</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {state.status === "success" && (
        <CharacterProfileCard
          profile={state.data.character}
          dataTimestamp={state.data.dataTimestamp}
          sources={state.data.sources}
          cacheHit={state.data.cacheHit}
        />
      )}
    </div>
  );
}
