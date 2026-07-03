import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 디렉터리에 별개의 package-lock.json이 있어 Next.js가 workspace root를
  // 잘못 추정하는 것을 방지한다.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
