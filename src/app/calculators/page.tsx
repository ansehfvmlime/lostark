import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CalculatorEntry = {
  title: string;
  description: string;
  href?: string;
  status: "available" | "planned";
};

// CLAUDE.md 섹션 14 MVP 로드맵 순서를 따른다. href가 있는 항목만 실제로 구현된 계산기다 —
// 구현되지 않은 계산기를 "제공 중"으로 표시하지 않는다 (CLAUDE.md 섹션 2 Do Not 원칙).
const CALCULATORS: CalculatorEntry[] = [
  {
    title: "재료 구매 비용 계산기",
    description:
      "필요한 재련 재료의 부족분을 거래소 최저가 기준으로 계산합니다.",
    href: "/calculators/material-cost",
    status: "available",
  },
  {
    title: "강화/재련 기대 비용 계산기",
    description:
      "장인의 기운 천장을 반영한 마르코프 체인 기반 기대 비용 계산 (준비 중)",
    status: "planned",
  },
  {
    title: "보석 효율 계산기",
    description: "보석 구매 vs 합성 비용 비교 (준비 중)",
    status: "planned",
  },
  {
    title: "콘텐츠 수익 효율 계산기",
    description:
      "원정대 캐릭터별 입장 가능한 레이드의 귀속·거래가능 골드와 재료 환산 골드를 계산합니다.",
    href: "/calculators/content-profit",
    status: "available",
  },
  {
    title: "치명타 전투 효율 계산기",
    description:
      "각인·트라이포드·장비·아크패시브를 반영한 치명타 확률/기대 피해 계산 (준비 중)",
    status: "planned",
  },
];

export default function CalculatorsIndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">계산기 목록</h1>
        <p className="text-sm text-muted-foreground">
          모든 계산 결과는 근거·수식·데이터 시점과 함께 표시됩니다.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        {CALCULATORS.map((calculator) => (
          <Card key={calculator.title}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{calculator.title}</CardTitle>
                <Badge variant={calculator.status === "available" ? "default" : "secondary"}>
                  {calculator.status === "available" ? "제공 중" : "준비 중"}
                </Badge>
              </div>
              <CardDescription>{calculator.description}</CardDescription>
            </CardHeader>
            <CardContent />
            <CardFooter>
              {calculator.href ? (
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={<Link href={calculator.href} />}
                >
                  계산기 열기
                </Button>
              ) : (
                <Button className="w-full" variant="outline" disabled>
                  준비 중
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
