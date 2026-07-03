import Image from "next/image";

import { ResultCard } from "@/components/common/ResultCard";
import { Badge } from "@/components/ui/badge";
import { formatItemLevel } from "@/lib/utils/format";
import type { CharacterProfile } from "@/lib/lostark/schemas";
import type { ValueSource } from "@/types/calculation";

type CharacterProfileCardProps = {
  profile: CharacterProfile;
  dataTimestamp: string;
  sources: ValueSource[];
  cacheHit: boolean;
};

export function CharacterProfileCard({
  profile,
  dataTimestamp,
  sources,
  cacheHit,
}: CharacterProfileCardProps) {
  return (
    <ResultCard
      title={profile.CharacterName}
      description={cacheHit ? "캐시된 데이터입니다." : undefined}
      dataTimestamp={dataTimestamp}
      sources={sources}
      warnings={[
        "장비/각인/보석 등 세부 세팅은 아직 반영되지 않은 기본 프로필 정보입니다.",
      ]}
    >
      <div className="flex items-center gap-4">
        {profile.CharacterImage && (
          <Image
            src={profile.CharacterImage}
            alt={`${profile.CharacterName} 캐릭터 이미지`}
            width={72}
            height={72}
            className="rounded-lg border object-cover"
          />
        )}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{profile.CharacterClassName}</Badge>
            {profile.ServerName && (
              <Badge variant="outline">{profile.ServerName}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Lv.{profile.CharacterLevel} · 아이템 레벨{" "}
            {formatItemLevel(profile.ItemAvgLevel)}
          </p>
        </div>
      </div>
    </ResultCard>
  );
}
