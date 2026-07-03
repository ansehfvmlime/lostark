import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/utils/format";
import type { ValueOrigin, ValueSource } from "@/types/calculation";

const ORIGIN_LABEL: Record<ValueOrigin, string> = {
  API: "API 데이터",
  USER: "직접 입력",
  ADMIN: "관리자 설정값",
  RULE_TABLE: "룰 테이블",
};

/**
 * 계산기/조회 화면 공통 결과 카드 (CLAUDE.md 섹션 6, 11).
 * - 근거를 숨기지 않는다: sources/formula/assumptions는 "계산 근거 보기"로 접어두되 항상 존재한다.
 * - warnings는 접지 않고 바로 보여준다 (미반영 효과, 추정치 등 사용자가 놓치면 안 되는 정보).
 * - formula/assumptions가 없는 화면(예: 캐릭터 검색)에서도 재사용할 수 있도록 모두 optional이다.
 */
export type ResultCardProps = {
  title: string;
  description?: string;
  dataTimestamp?: string;
  sources?: ValueSource[];
  formula?: string;
  assumptions?: string[];
  warnings?: string[];
  children: ReactNode;
  footer?: ReactNode;
};

export function ResultCard({
  title,
  description,
  dataTimestamp,
  sources,
  formula,
  assumptions,
  warnings,
  children,
  footer,
}: ResultCardProps) {
  const hasEvidence = Boolean(
    formula || (assumptions && assumptions.length > 0) || (sources && sources.length > 0)
  );

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {(description || dataTimestamp) && (
          <CardDescription className="flex flex-col gap-0.5">
            {description && <span>{description}</span>}
            {dataTimestamp && (
              <span>기준 데이터: {formatDateTime(dataTimestamp)} 갱신</span>
            )}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {children}

        {warnings && warnings.length > 0 && (
          <Alert>
            <AlertTitle>참고할 점</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {hasEvidence && (
          <details className="group rounded-lg border px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none font-medium text-muted-foreground group-open:text-foreground">
              계산 근거 보기
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {formula && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    계산 방식
                  </p>
                  <code className="block rounded bg-muted px-2 py-1 text-xs">
                    {formula}
                  </code>
                </div>
              )}

              {assumptions && assumptions.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    가정
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-xs">
                    {assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                </div>
              )}

              {sources && sources.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    값 출처
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sources.map((source) => (
                      <Badge key={source.field} variant="outline">
                        {source.field}: {ORIGIN_LABEL[source.origin]}
                        {source.fetchedAt &&
                          ` (${formatDateTime(source.fetchedAt)})`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </CardContent>

      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
