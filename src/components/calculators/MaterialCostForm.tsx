"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HONING_MATERIAL_CATALOG } from "@/data/config/materialCategories";

const materialRowSchema = z.object({
  itemName: z.string().min(1, "재료를 선택해주세요."),
  // 숫자 <input>은 register(..., { valueAsNumber: true })로 이미 number를 넘겨주므로
  // z.coerce가 필요 없다 (z.coerce.number()는 react-hook-form resolver의 입력/출력 타입을
  // 어긋나게 만들어 타입 에러를 일으킨다).
  requiredQuantity: z
    .number({ error: "숫자를 입력해주세요." })
    .int()
    .nonnegative("0 이상 입력해주세요."),
  ownedQuantity: z
    .number({ error: "숫자를 입력해주세요." })
    .int()
    .nonnegative("0 이상 입력해주세요."),
});

export const materialCostFormSchema = z.object({
  rows: z.array(materialRowSchema).min(1, "재료를 1개 이상 추가해주세요."),
});

export type MaterialCostFormValues = z.infer<typeof materialCostFormSchema>;

const EMPTY_ROW: MaterialCostFormValues["rows"][number] = {
  itemName: "",
  requiredQuantity: 0,
  ownedQuantity: 0,
};

type MaterialCostFormProps = {
  onSubmit: (values: MaterialCostFormValues) => void;
  isLoading?: boolean;
};

export function MaterialCostForm({
  onSubmit,
  isLoading = false,
}: MaterialCostFormProps) {
  const form = useForm<MaterialCostFormValues>({
    resolver: zodResolver(materialCostFormSchema),
    defaultValues: { rows: [EMPTY_ROW] },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rows",
  });

  const handleSubmit = form.handleSubmit(onSubmit);

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-3">
        {fields.map((field, index) => {
          const rowErrors = form.formState.errors.rows?.[index];
          return (
            <div
              key={field.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start"
            >
              <div className="flex-1">
                <Label className="sr-only">재료</Label>
                <Controller
                  control={form.control}
                  name={`rows.${index}.itemName`}
                  render={({ field: selectField }) => (
                    <Select
                      value={selectField.value || null}
                      onValueChange={(value) => selectField.onChange(value ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="재료 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {HONING_MATERIAL_CATALOG.map((material) => (
                          <SelectItem key={material.itemId} value={material.itemName}>
                            {material.itemName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {rowErrors?.itemName && (
                  <p className="mt-1 text-xs text-destructive">
                    {rowErrors.itemName.message}
                  </p>
                )}
              </div>

              <div className="w-full sm:w-28">
                <Label className="sr-only">필요 수량</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="필요 수량"
                  {...form.register(`rows.${index}.requiredQuantity`, {
                    valueAsNumber: true,
                  })}
                />
                {rowErrors?.requiredQuantity && (
                  <p className="mt-1 text-xs text-destructive">
                    {rowErrors.requiredQuantity.message}
                  </p>
                )}
              </div>

              <div className="w-full sm:w-28">
                <Label className="sr-only">보유 수량</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="보유 수량"
                  {...form.register(`rows.${index}.ownedQuantity`, {
                    valueAsNumber: true,
                  })}
                />
                {rowErrors?.ownedQuantity && (
                  <p className="mt-1 text-xs text-destructive">
                    {rowErrors.ownedQuantity.message}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={fields.length <= 1}
                onClick={() => remove(index)}
              >
                삭제
              </Button>
            </div>
          );
        })}
      </div>

      {form.formState.errors.rows?.root && (
        <p className="text-sm text-destructive" role="alert">
          {form.formState.errors.rows.root.message}
        </p>
      )}
      {form.formState.errors.rows?.message && (
        <p className="text-sm text-destructive" role="alert">
          {form.formState.errors.rows.message}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => append(EMPTY_ROW)}
        >
          재료 추가
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "시세 조회 중..." : "시세 조회 후 계산"}
        </Button>
      </div>
    </form>
  );
}
