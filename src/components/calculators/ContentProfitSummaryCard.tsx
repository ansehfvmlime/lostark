import { ResultCard } from "@/components/common/ResultCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatGold } from "@/lib/utils/format";
import type { ContentProfitResult } from "@/lib/calculators/contentProfit";

type ContentProfitSummaryCardProps = {
  result: ContentProfitResult;
};

export function ContentProfitSummaryCard({
  result,
}: ContentProfitSummaryCardProps) {
  return (
    <ResultCard
      title="콘텐츠 수익 효율 계산 결과"
      dataTimestamp={result.dataTimestamp}
      sources={result.sources}
      formula={result.formula}
      assumptions={result.assumptions}
      warnings={result.warnings}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryStat label="선택 캐릭터" value={`${result.result.characterCount}명`} />
        <SummaryStat label="귀속 합계" value={formatGold(result.result.boundGoldTotal)} />
        <SummaryStat
          label="거래가능 합계"
          value={formatGold(result.result.tradableGoldTotal)}
        />
        <SummaryStat label="재료 합계" value={formatGold(result.result.materialGoldTotal)} />
        <SummaryStat
          label="총 기대 골드"
          value={formatGold(result.result.value)}
          emphasize
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>캐릭터</TableHead>
              <TableHead className="text-right">귀속</TableHead>
              <TableHead className="text-right">거래가능</TableHead>
              <TableHead className="text-right">재료</TableHead>
              <TableHead className="text-right">합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.result.characterLines.map((line) => (
              <TableRow key={line.characterName}>
                <TableCell>{line.characterName}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatGold(line.boundGold)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatGold(line.tradableGold)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatGold(line.materialGold)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatGold(line.totalGold)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ResultCard>
  );
}

function SummaryStat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={emphasize ? "text-xl font-semibold tabular-nums" : "text-sm tabular-nums"}>
        {value}
      </span>
    </div>
  );
}
