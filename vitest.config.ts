import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Next.js 빌드 시에만 server-only 패키지가 클라이언트 번들 유입을 막는다.
      // 테스트는 Next 번들러 밖에서 돌아가므로 no-op 스텁으로 대체한다.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
