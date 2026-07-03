import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        로스트아크 효율 계산기
      </h1>
      <p className="max-w-md text-muted-foreground">
        로스트아크 Open API 데이터를 바탕으로 강화·재련·보석·콘텐츠 수익, 그리고
        치명타 전투 효율까지 근거와 함께 계산합니다. 모든 결과는 &ldquo;정답&rdquo;이
        아니라 현재 입력값 기준 추정치이며, 계산 근거를 항상 확인할 수 있습니다.
      </p>
      <Button size="lg" nativeButton={false} render={<Link href="/character" />}>
        캐릭터 검색으로 시작하기
      </Button>
    </main>
  );
}
