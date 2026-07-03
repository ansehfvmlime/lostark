"use client";

import { useState } from "react";

import { MaterialCostForm } from "@/components/calculators/MaterialCostForm";
import { MaterialCostResultCard } from "@/components/calculators/MaterialCostResultCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { HONING_MATERIAL_CATALOG } from "@/data/config/materialCategories";
import {
  calculateMaterialCost,
  resolveUnitPriceFromMarketItem,
  type MaterialCostInput,
  type MaterialCostResult,
} from "@/lib/calculators/materialCost";
import type { MarketSearchApiResponse } from "@/types/market";

type CalcState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: MaterialCostResult }
  | { status: "error"; message: string };

async function resolveMaterialPrice(
  itemName: string
): Promise<MaterialCostInput["materials"][number]> {
  const catalogEntry = HONING_MATERIAL_CATALOG.find(
    (entry) => entry.itemName === itemName
  );
  const categoryCode = catalogEntry?.categoryCode ?? 50010;

  try {
    const response = await fetch(
      `/api/lostark/markets/search?categoryCode=${categoryCode}&itemName=${encodeURIComponent(itemName)}`
    );

    if (!response.ok) {
      return {
        itemName,
        requiredQuantity: 0,
        ownedQuantity: 0,
        unitPrice: 0,
        priceOrigin: "API",
        priceUnavailable: true,
      };
    }

    const data = (await response.json()) as MarketSearchApiResponse;
    const matched = data.items.find((item) => item.Name === itemName);

    if (!matched) {
      return {
        itemName,
        requiredQuantity: 0,
        ownedQuantity: 0,
        unitPrice: 0,
        priceOrigin: "API",
        priceUnavailable: true,
      };
    }

    return {
      itemName,
      requiredQuantity: 0,
      ownedQuantity: 0,
      unitPrice: resolveUnitPriceFromMarketItem(matched),
      priceOrigin: "API",
      priceFetchedAt: data.dataTimestamp,
    };
  } catch {
    return {
      itemName,
      requiredQuantity: 0,
      ownedQuantity: 0,
      unitPrice: 0,
      priceOrigin: "API",
      priceUnavailable: true,
    };
  }
}

export default function MaterialCostCalculatorPage() {
  const [state, setState] = useState<CalcState>({ status: "idle" });

  async function handleSubmit(values: { rows: { itemName: string; requiredQuantity: number; ownedQuantity: number }[] }) {
    setState({ status: "loading" });

    try {
      const priceLookups = await Promise.all(
        values.rows.map((row) => resolveMaterialPrice(row.itemName))
      );

      const materials: MaterialCostInput["materials"] = values.rows.map(
        (row, index) => ({
          ...priceLookups[index]!,
          requiredQuantity: row.requiredQuantity,
          ownedQuantity: row.ownedQuantity,
        })
      );

      const result = calculateMaterialCost(
        { materials },
        new Date().toISOString()
      );
      setState({ status: "success", result });
    } catch {
      setState({
        status: "error",
        message: "계산 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">재료 구매 비용 계산기</h1>
        <p className="text-sm text-muted-foreground">
          필요한 재련 재료와 보유 수량을 입력하면 거래소 최저가 기준으로 부족분
          구매 비용을 계산합니다.
        </p>
      </div>

      <MaterialCostForm
        onSubmit={handleSubmit}
        isLoading={state.status === "loading"}
      />

      {state.status === "loading" && (
        <Skeleton className="h-48 w-full max-w-xl rounded-xl" />
      )}

      {state.status === "error" && (
        <Alert variant="destructive" className="w-full max-w-xl">
          <AlertTitle>계산 실패</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {state.status === "success" && (
        <MaterialCostResultCard result={state.result} />
      )}
    </div>
  );
}
