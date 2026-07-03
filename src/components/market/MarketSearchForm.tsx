"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const marketSearchFormSchema = z.object({
  itemName: z
    .string()
    .trim()
    .min(1, "검색할 재료명을 입력해주세요.")
    .max(50, "검색어가 너무 깁니다."),
});

export type MarketSearchFormValues = z.infer<typeof marketSearchFormSchema>;

type MarketSearchFormProps = {
  onSearch: (itemName: string) => void;
  isLoading?: boolean;
};

/**
 * 시세 조회 검색 폼. 입력할 때마다 API를 호출하지 않고, 명시적 제출로만 검색한다
 * (CLAUDE.md 섹션 5 — 경매장/거래소 검색은 명시적 버튼으로만 트리거).
 */
export function MarketSearchForm({
  onSearch,
  isLoading = false,
}: MarketSearchFormProps) {
  const form = useForm<MarketSearchFormValues>({
    resolver: zodResolver(marketSearchFormSchema),
    defaultValues: { itemName: "" },
  });

  const onSubmit = form.handleSubmit(({ itemName }) => {
    onSearch(itemName);
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-xl flex-col items-start gap-2 sm:flex-row"
      noValidate
    >
      <div className="w-full flex-1">
        <Label htmlFor="market-item-name" className="sr-only">
          재료명
        </Label>
        <Input
          id="market-item-name"
          placeholder="재료명을 입력하세요 (예: 파괴강석)"
          autoComplete="off"
          aria-invalid={Boolean(form.formState.errors.itemName)}
          {...form.register("itemName")}
        />
        {form.formState.errors.itemName && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {form.formState.errors.itemName.message}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isLoading} className="w-full sm:w-28">
        {isLoading ? "조회 중..." : "시세 조회"}
      </Button>
    </form>
  );
}
