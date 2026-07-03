import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // tests/e2e는 @playwright/test 전용 스펙이라 vitest 실행 대상에서 제외한다.
    exclude: ["**/node_modules/**", "tests/e2e/**"],
  },
  resolve: {
    alias: {
      // Next.js 빌드 시에만 server-only 패키지가 클라이언트 번들 유입을 막는다.
      // 테스트는 Next 번들러 밖에서 돌아가므로 no-op 스텁으로 대체한다.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
