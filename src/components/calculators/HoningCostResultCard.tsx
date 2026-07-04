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
import type { HoningCostResult } from "@/lib/calculators/honingCost";

type HoningCostResultCardProps = {
  result: HoningCostResult;
};

const DISTRIBUTION_ROW_LIMIT = 30;

export function HoningCostResultCard({ result }: HoningCostResultCardProps) {
  const { distribution } = result.result;
  const visibleRows = distribution.slice(0, DISTRIBUTION_ROW_LIMIT);
  const isTruncated = distribution.length > DISTRIBUTION_ROW_LIMIT;

  return (
    <ResultCard
      title="강화/재련 기대 비용 계산 결과"
      dataTimestamp={result.dataTimestamp}
      sources={result.sources}
      formula={result.formula}
      assumptions={result.assumptions}
      warnings={result.warnings}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">기대 비용</p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatGold(result.result.value)}
        </p>
        <p className="text-xs text-muted-foreground">
          기대 시도 횟수: {result.result.expectedAttempts.toFixed(2)}회
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <ScenarioStat
          label={`장인의 기운 천장 (${result.result.ceilingAttempt}회차 확정)`}
          value={formatGold(result.result.worstCaseCost)}
          description="최악의 경우에도 이 비용을 넘지 않습니다."
        />
        <ScenarioStat
          label={`상위 ${result.result.targetPercentile}% 시나리오 (${result.result.percentileAttempts}회차)`}
          value={formatGold(result.result.percentileCost)}
          description={`${result.result.targetPercentile}% 확률로 이 비용 이내에 성공합니다.`}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시도</TableHead>
              <TableHead className="text-right">성공 확률</TableHead>
              <TableHead className="text-right">이 시도에 처음 성공할 확률</TableHead>
              <TableHead className="text-right">누적 성공 확률</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.attempt}>
                <TableCell>{row.attempt}회차</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.successRatePercent.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {(row.firstSuccessProbability * 100).toFixed(2)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {(row.cumulativeProbability * 100).toFixed(2)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {isTruncated && (
        <p className="text-xs text-muted-foreground">
          시도별 표는 처음 {DISTRIBUTION_ROW_LIMIT}회차까지만 표시합니다. (전체{" "}
          {distribution.length.toLocaleString("ko-KR")}회차)
        </p>
      )}
    </ResultCard>
  );
}

function ScenarioStat({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </div>
  );
}
