"use client";

import { useState } from "react";

import { ResultCard } from "@/components/common/ResultCard";
import { MarketPriceTable } from "@/components/market/MarketPriceTable";
import { MarketSearchForm } from "@/components/market/MarketSearchForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MARKET_CATEGORY_CODE } from "@/data/config/materialCategories";
import type {
  MarketApiErrorResponse,
  MarketSearchApiResponse,
} from "@/types/market";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: MarketSearchApiResponse }
  | { status: "error"; message: string };

export default function MarketPricePage() {
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function handleSearch(itemName: string) {
    setState({ status: "loading" });
    try {
      const response = await fetch(
        `/api/lostark/markets/search?categoryCode=${MARKET_CATEGORY_CODE.HONING_MATERIAL}&itemName=${encodeURIComponent(itemName)}`
      );

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as MarketApiErrorResponse | null;
        setState({
          status: "error",
          message:
            body?.error ?? "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        });
        return;
      }

      const data = (await response.json()) as MarketSearchApiResponse;
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
        <h1 className="text-2xl font-semibold">거래소 시세 조회</h1>
        <p className="text-sm text-muted-foreground">
          재련 재료의 거래소 최저가를 조회합니다. 현재는 재련 재료 카테고리만
          지원합니다.
        </p>
      </div>

      <MarketSearchForm
        onSearch={handleSearch}
        isLoading={state.status === "loading"}
      />

      {state.status === "loading" && (
        <Skeleton className="h-40 w-full max-w-xl rounded-xl" />
      )}

      {state.status === "error" && (
        <Alert variant="destructive" className="w-full max-w-xl">
          <AlertTitle>조회 실패</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {state.status === "success" && (
        <ResultCard
          title="검색 결과"
          description={`총 ${state.data.totalCount.toLocaleString("ko-KR")}건 중 상위 ${state.data.items.length}건`}
          dataTimestamp={state.data.dataTimestamp}
          sources={state.data.sources}
          warnings={[
            "거래소 가격은 실시간으로 변동될 수 있습니다.",
            "개당 가격은 최저가를 묶음 수량으로 나눈 값이며, 실제 구매는 묶음 단위로만 가능할 수 있습니다.",
          ]}
        >
          <MarketPriceTable items={state.data.items} />
        </ResultCard>
      )}
    </div>
  );
}
