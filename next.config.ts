import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 디렉터리에 별개의 package-lock.json이 있어 Next.js가 workspace root를
  // 잘못 추정하는 것을 방지한다.
  turbopack: {
    root: __dirname,
  },
  images: {
    // 캐릭터 프로필 이미지(CharacterImage)와 장식(Decorations) 아이콘이 내려오는
    // 로스트아크 공식 CDN 도메인. 실 API 응답으로 확인함 (docs/API_NOTES.md 참고).
    remotePatterns: [
      { protocol: "https", hostname: "img.lostark.co.kr" },
      { protocol: "https", hostname: "cdn-lostark.game.onstove.com" },
    ],
  },
};

export default nextConfig;
