import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveUnitPriceFromMarketItem } from "@/lib/calculators/materialCost";
import { formatGold } from "@/lib/utils/format";
import type { MarketItem } from "@/lib/lostark/schemas";

type MarketPriceTableProps = {
  items: MarketItem[];
};

export function MarketPriceTable({ items }: MarketPriceTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        검색 결과가 없습니다. 재료명을 다시 확인해주세요.
      </p>
    );
  }

  return (
    <div className="w-full max-w-xl overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>재료</TableHead>
            <TableHead className="text-right">최저가(묶음)</TableHead>
            <TableHead className="text-right">묶음 수량</TableHead>
            <TableHead className="text-right">개당 가격</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.Id}>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span>{item.Name}</span>
                  <Badge variant="outline">{item.Grade}</Badge>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatGold(item.CurrentMinPrice)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {item.BundleCount.toLocaleString("ko-KR")}개
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatGold(resolveUnitPriceFromMarketItem(item))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
