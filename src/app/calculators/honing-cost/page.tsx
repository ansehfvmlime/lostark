"use client";

import { useState } from "react";

import { HoningCostForm } from "@/components/calculators/HoningCostForm";
import { HoningCostResultCard } from "@/components/calculators/HoningCostResultCard";
import {
  calculateHoningCost,
  type HoningCostInput,
  type HoningCostResult,
} from "@/lib/calculators/honingCost";

type CalcState =
  | { status: "idle" }
  | { status: "success"; result: HoningCostResult };

export default function HoningCostCalculatorPage() {
  const [state, setState] = useState<CalcState>({ status: "idle" });

  function handleSubmit(values: HoningCostInput) {
    const result = calculateHoningCost(values, new Date().toISOString());
    setState({ status: "success", result });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">강화/재련 기대 비용 계산기</h1>
        <p className="text-sm text-muted-foreground">
          실패 시 확률 증가와 장인의 기운 천장을 반영해 기대 비용, 최악 확정
          비용, 보수적 시나리오 비용을 점화식으로 계산합니다. 확률/비용 수치는
          직접 입력한 값을 사용합니다.
        </p>
      </div>

      <HoningCostForm onSubmit={handleSubmit} />

      {state.status === "success" && (
        <HoningCostResultCard result={state.result} />
      )}
    </div>
  );
}
