import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { characterProfileSchema } from "./schemas";

// 실캐릭터 raw JSON fixture 기반 파서 회귀 테스트 (CLAUDE.md 섹션 13).
const fixturePath = path.resolve(
  __dirname,
  "../../../tests/fixtures/character-profile-example.json"
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("characterProfileSchema", () => {
  it("실제 API 응답 fixture를 검증에 통과시킨다", () => {
    const result = characterProfileSchema.safeParse(fixture.response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CharacterName).toBe(fixture.response.CharacterName);
      expect(result.data.CharacterClassName).toBe(
        fixture.response.CharacterClassName
      );
      // ItemAvgLevel은 실 API에서 "1,805.00" 형태의 문자열로 내려온다 (콤마 포함).
      expect(typeof result.data.ItemAvgLevel).toBe("string");
    }
  });

  it("fixture에 없던 미확인 필드도 유실 없이 보존한다 (passthrough)", () => {
    const result = characterProfileSchema.safeParse(fixture.response);
    expect(result.success).toBe(true);
    if (result.success) {
      // Stats, CombatPower 등은 스키마에 명시되지 않았지만 원본 응답에 존재한다.
      const parsedRecord = result.data as unknown as Record<string, unknown>;
      expect(parsedRecord.Stats).toBeDefined();
      expect(parsedRecord.CombatPower).toBeDefined();
    }
  });

  it("필수 필드가 없는 응답은 검증에 실패한다", () => {
    const result = characterProfileSchema.safeParse({
      CharacterClassName: "스트라이커",
    });
    expect(result.success).toBe(false);
  });

  it("null 응답(존재하지 않는 캐릭터)은 스키마 검증 대상이 아니다", () => {
    // client.ts에서 data === null은 스키마 검증 이전에 NOT_FOUND로 분기 처리한다.
    const result = characterProfileSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});
