import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatGold, formatQuantity } from "@/lib/utils/format";
import type { CharacterRosterEntry } from "./contentProfitTypes";

type ContentProfitCharacterListProps = {
  roster: CharacterRosterEntry[];
  onToggleCharacter: (characterIndex: number, checked: boolean) => void;
  onToggleRaid: (
    characterIndex: number,
    raidId: string,
    checked: boolean
  ) => void;
  onToggleMaterial: (
    characterIndex: number,
    raidId: string,
    itemName: string,
    checked: boolean
  ) => void;
};

export function ContentProfitCharacterList({
  roster,
  onToggleCharacter,
  onToggleRaid,
  onToggleMaterial,
}: ContentProfitCharacterListProps) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      {roster.map((entry, characterIndex) => (
        <Card key={entry.sibling.CharacterName}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={entry.checked}
                onCheckedChange={(checked) =>
                  onToggleCharacter(characterIndex, checked)
                }
                aria-label={`${entry.sibling.CharacterName} 포함`}
              />
              <span className="font-medium">{entry.sibling.CharacterName}</span>
              <Badge variant="secondary">{entry.sibling.CharacterClassName}</Badge>
              <span className="text-sm text-muted-foreground">
                아이템 레벨 {entry.itemLevel.toLocaleString("ko-KR")}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {entry.eligibleRaidSelections.length === 0 && (
              <p className="text-sm text-muted-foreground">
                입장 가능한 레이드가 없습니다.
              </p>
            )}
            {entry.eligibleRaidSelections.map((raidSelection) => (
              <div
                key={raidSelection.raid.id}
                className="flex flex-col gap-1.5 rounded-lg border p-2.5"
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={raidSelection.checked}
                    onCheckedChange={(checked) =>
                      onToggleRaid(characterIndex, raidSelection.raid.id, checked)
                    }
                  />
                  <span className="text-sm font-medium">
                    {raidSelection.raid.raidName}
                  </span>
                </label>
                <div className="flex flex-wrap gap-3 pl-6 text-xs text-muted-foreground">
                  <span>귀속 {formatGold(raidSelection.raid.boundGold)}</span>
                  <span>거래가능 {formatGold(raidSelection.raid.tradableGold)}</span>
                </div>
                {raidSelection.materials.length > 0 ? (
                  <div className="flex flex-col gap-1 pl-6">
                    {raidSelection.materials.map((material) => (
                      <label
                        key={material.itemName}
                        className="flex cursor-pointer items-center gap-2 text-xs"
                      >
                        <Checkbox
                          checked={material.checked}
                          onCheckedChange={(checked) =>
                            onToggleMaterial(
                              characterIndex,
                              raidSelection.raid.id,
                              material.itemName,
                              checked
                            )
                          }
                        />
                        <span>
                          {material.itemName} {formatQuantity(material.quantity)}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="pl-6 text-xs text-muted-foreground">
                    확인된 드랍 재료 정보가 없습니다.
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
