import type {
  ArkPassive,
  ArmoryCard,
  CharacterProfile,
  CharacterSibling,
  CombatSkill,
  EquipmentItem,
} from "@/lib/lostark/schemas";
import type { ValueSource } from "@/types/calculation";

/** GET /api/lostark/character/[name] 성공 응답 (src/app/api/lostark/character/[name]/route.ts) */
export type CharacterProfileResponse = {
  character: CharacterProfile;
  dataTimestamp: string;
  cacheHit: boolean;
  sources: ValueSource[];
};

/** GET /api/lostark/character/[name] 실패 응답 */
export type CharacterApiErrorResponse = {
  error: string;
};

/** GET /api/lostark/character/[name]/siblings 성공 응답 */
export type CharacterSiblingsResponse = {
  siblings: CharacterSibling[];
  dataTimestamp: string;
  cacheHit: boolean;
  sources: ValueSource[];
};

/** GET /api/lostark/character/[name]/arkpassive 성공 응답 */
export type CharacterArkPassiveResponse = {
  arkPassive: ArkPassive;
  dataTimestamp: string;
  cacheHit: boolean;
  sources: ValueSource[];
};

/** GET /api/lostark/character/[name]/cards 성공 응답 */
export type CharacterCardsResponse = {
  armoryCard: ArmoryCard;
  dataTimestamp: string;
  cacheHit: boolean;
  sources: ValueSource[];
};

/** GET /api/lostark/character/[name]/equipment 성공 응답 */
export type CharacterEquipmentResponse = {
  equipment: EquipmentItem[];
  dataTimestamp: string;
  cacheHit: boolean;
  sources: ValueSource[];
};

/** GET /api/lostark/character/[name]/combat-skills 성공 응답 */
export type CharacterCombatSkillsResponse = {
  skills: CombatSkill[];
  dataTimestamp: string;
  cacheHit: boolean;
  sources: ValueSource[];
};
