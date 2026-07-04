import { ResultCard } from "@/components/common/ResultCard";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CombatCritResult } from "@/types/combat";

type CombatCritResultCardProps = {
  result: CombatCritResult;
  characterName: string;
};

const ACCURACY_LABEL: Record<CombatCritResult["result"]["accuracyLevel"], string> = {
  BASIC: "기본(치명 스탯만)",
  PARTIAL_CLASS_RULES: "일부 룰 반영",
  FULL_CLASS_RULES: "아크패시브/카드/팔찌/트라이포드 반영",
  MANUAL_ASSISTED: "수동 보정 반영",
};

export function CombatCritResultCard({
  result,
  characterName,
}: CombatCritResultCardProps) {
  return (
    <ResultCard
      title={`${characterName} 치명타 전투 효율`}
      dataTimestamp={result.dataTimestamp}
      sources={result.sources}
      formula={result.formula}
      assumptions={result.assumptions}
      warnings={result.warnings}
    >
      <div className="flex items-center gap-2">
        <Badge variant="secondary">
          정확도: {ACCURACY_LABEL[result.result.accuracyLevel]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label={
            result.result.critRateCapPercent < 100
              ? `최종 치명타 확률 (상한 ${result.result.critRateCapPercent}%)`
              : "최종 치명타 확률"
          }
          value={`${result.result.finalCritRatePercent.toFixed(2)}%`}
        />
        <Stat
          label="치명타 피해 배율"
          value={`${(result.result.critDamageMultiplier * 100).toFixed(0)}%`}
        />
        <Stat
          label="기대 피해 배율"
          value={`${(result.result.value * 100).toFixed(2)}%`}
          emphasize
        />
      </div>

      {result.result.evolutionDamageFromOverflowPercent > 0 && (
        <Stat
          label="진화형 피해 (뭉툭한 가시 전환분, 기대 피해 배율 미포함)"
          value={`+${result.result.evolutionDamageFromOverflowPercent.toFixed(2)}%`}
        />
      )}

      {result.result.skillCritRates.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            스킬별 최종 치명타 확률 (선택된 치명타 트라이포드가 있는 스킬만 표시)
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>스킬</TableHead>
                  <TableHead className="text-right">트라이포드 보너스</TableHead>
                  <TableHead className="text-right">최종 치명타 확률</TableHead>
                  <TableHead className="text-right">기대 피해 배율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.result.skillCritRates.map((skillRate) => (
                  <TableRow key={skillRate.skillName}>
                    <TableCell>{skillRate.skillName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      +{skillRate.tripodBonusPercent.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {skillRate.finalCritRatePercent.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(skillRate.expectedDamageMultiplier * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          효과 기여 내역
        </p>
        {result.result.contributions.map((contribution) => (
          <div
            key={`${contribution.sourceType}-${contribution.sourceName}`}
            className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-sm"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{contribution.sourceName}</span>
              <span className="text-xs text-muted-foreground">
                {contribution.reason}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={contribution.applied ? "default" : "outline"}>
                {contribution.applied ? "반영됨" : "미반영"}
              </Badge>
              <span className="text-xs tabular-nums text-muted-foreground">
                {contribution.value.toFixed(2)}
                {contribution.unit === "PERCENT" ? "%p" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ResultCard>
  );
}

function Stat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          emphasize
            ? "text-xl font-semibold tabular-nums"
            : "text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}
