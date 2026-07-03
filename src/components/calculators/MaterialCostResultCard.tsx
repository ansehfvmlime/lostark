import { ResultCard } from "@/components/common/ResultCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatGold, formatQuantity } from "@/lib/utils/format";
import type { MaterialCostResult } from "@/lib/calculators/materialCost";

type MaterialCostResultCardProps = {
  result: MaterialCostResult;
};

export function MaterialCostResultCard({ result }: MaterialCostResultCardProps) {
  return (
    <ResultCard
      title="재료 구매 비용 계산 결과"
      dataTimestamp={result.dataTimestamp}
      sources={result.sources}
      formula={result.formula}
      assumptions={result.assumptions}
      warnings={result.warnings}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">예상 총 비용</p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatGold(result.result.value)}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>재료</TableHead>
              <TableHead className="text-right">필요</TableHead>
              <TableHead className="text-right">보유</TableHead>
              <TableHead className="text-right">부족</TableHead>
              <TableHead className="text-right">비용</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.result.lines.map((line) => (
              <TableRow key={line.itemName}>
                <TableCell>{line.itemName}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(line.requiredQuantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(line.ownedQuantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(line.shortageQuantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatGold(line.cost)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ResultCard>
  );
}
