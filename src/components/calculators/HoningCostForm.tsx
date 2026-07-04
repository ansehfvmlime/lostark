"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  honingCostInputSchema,
  type HoningCostInput,
} from "@/lib/calculators/honingCost";

export type HoningCostFormValues = HoningCostInput;

const DEFAULT_VALUES: HoningCostFormValues = {
  baseSuccessRatePercent: 10,
  successRateIncreasePercent: 0,
  artisanEnergyPerAttemptPercent: 5,
  artisanEnergyThresholdPercent: 100,
  costPerAttempt: 0,
  targetPercentile: 90,
};

type FieldConfig = {
  name: keyof HoningCostFormValues;
  label: string;
  suffix: string;
  step?: string;
};

const FIELDS: FieldConfig[] = [
  {
    name: "baseSuccessRatePercent",
    label: "기본 성공 확률",
    suffix: "%",
    step: "0.01",
  },
  {
    name: "successRateIncreasePercent",
    label: "실패 시 확률 증가폭",
    suffix: "%p",
    step: "0.01",
  },
  {
    name: "artisanEnergyPerAttemptPercent",
    label: "시도당 장인의 기운 축적량",
    suffix: "%",
    step: "0.01",
  },
  {
    name: "artisanEnergyThresholdPercent",
    label: "장인의 기운 임계값 (천장)",
    suffix: "%",
    step: "0.01",
  },
  {
    name: "costPerAttempt",
    label: "시도 1회당 재료 비용",
    suffix: "골드",
    step: "1",
  },
  {
    name: "targetPercentile",
    label: "보수적 시나리오 백분위수",
    suffix: "%",
    step: "1",
  },
];

type HoningCostFormProps = {
  onSubmit: (values: HoningCostFormValues) => void;
};

export function HoningCostForm({ onSubmit }: HoningCostFormProps) {
  const form = useForm<HoningCostFormValues>({
    resolver: zodResolver(honingCostInputSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const handleSubmit = form.handleSubmit(onSubmit);

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((fieldConfig) => {
          const error = form.formState.errors[fieldConfig.name];
          return (
            <div key={fieldConfig.name}>
              <Label htmlFor={`honing-${fieldConfig.name}`}>
                {fieldConfig.label} ({fieldConfig.suffix})
              </Label>
              <Input
                id={`honing-${fieldConfig.name}`}
                type="number"
                step={fieldConfig.step ?? "1"}
                aria-invalid={Boolean(error)}
                {...form.register(fieldConfig.name, { valueAsNumber: true })}
              />
              {error && (
                <p className="mt-1 text-xs text-destructive" role="alert">
                  {error.message}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Button type="submit" className="w-full sm:w-40">
        계산하기
      </Button>
    </form>
  );
}
