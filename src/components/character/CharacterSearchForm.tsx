"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { characterNameSchema } from "@/lib/lostark/schemas";

const searchFormSchema = z.object({ name: characterNameSchema });
export type CharacterSearchFormValues = z.infer<typeof searchFormSchema>;

type CharacterSearchFormProps = {
  onSearch: (characterName: string) => void;
  isLoading?: boolean;
};

/**
 * 캐릭터 검색 폼. 입력할 때마다 API를 호출하지 않고, 명시적 제출(버튼/Enter)로만
 * 검색을 트리거한다 (CLAUDE.md 섹션 5 rate limit 원칙).
 */
export function CharacterSearchForm({
  onSearch,
  isLoading = false,
}: CharacterSearchFormProps) {
  const form = useForm<CharacterSearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = form.handleSubmit(({ name }) => {
    onSearch(name);
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-xl flex-col items-start gap-2 sm:flex-row"
      noValidate
    >
      <div className="w-full flex-1">
        <Label htmlFor="character-name" className="sr-only">
          캐릭터명
        </Label>
        <Input
          id="character-name"
          placeholder="캐릭터명을 입력하세요 (예: 유우시)"
          autoComplete="off"
          aria-invalid={Boolean(form.formState.errors.name)}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isLoading} className="w-full sm:w-28">
        {isLoading ? "검색 중..." : "검색"}
      </Button>
    </form>
  );
}
