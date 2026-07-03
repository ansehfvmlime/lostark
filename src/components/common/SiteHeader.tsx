import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold">
          로스트아크 효율 계산기
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/character" className="hover:text-foreground">
            캐릭터 검색
          </Link>
        </nav>
      </div>
    </header>
  );
}
