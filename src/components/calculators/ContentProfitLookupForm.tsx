"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { characterNameSchema } from "@/lib/lostark/schemas";

const lookupFormSchema = z.object({ characterName: characterNameSchema });
export type ContentProfitLookupFormValues = z.infer<typeof lookupFormSchema>;

type ContentProfitLookupFormProps = {
  onLookup: (characterName: string) => void;
  isLoading?: boolean;
};

/** 원정대 조회 폼. 입력할 때마다 API를 호출하지 않고 명시적 제출로만 조회한다. */
export function ContentProfitLookupForm({
  onLookup,
  isLoading = false,
}: ContentProfitLookupFormProps) {
  const form = useForm<ContentProfitLookupFormValues>({
    resolver: zodResolver(lookupFormSchema),
    defaultValues: { characterName: "" },
  });

  const onSubmit = form.handleSubmit(({ characterName }) => {
    onLookup(characterName);
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-xl flex-col items-start gap-2 sm:flex-row"
      noValidate
    >
      <div className="w-full flex-1">
        <Label htmlFor="content-profit-character-name" className="sr-only">
          캐릭터명
        </Label>
        <Input
          id="content-profit-character-name"
          placeholder="원정대의 아무 캐릭터명이나 입력하세요"
          autoComplete="off"
          aria-invalid={Boolean(form.formState.errors.characterName)}
          {...form.register("characterName")}
        />
        {form.formState.errors.characterName && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {form.formState.errors.characterName.message}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isLoading} className="w-full sm:w-40">
        {isLoading ? "불러오는 중..." : "원정대 불러오기"}
      </Button>
    </form>
  );
}
