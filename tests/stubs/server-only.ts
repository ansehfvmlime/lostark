// Vitest용 스텁. 실제 Next.js 빌드에서는 npm의 `server-only` 패키지가
// 클라이언트 번들에 섞이면 throw하여 JWT 노출을 막아준다.
// Vitest는 Next의 서버/클라이언트 번들 분리 로직이 없어 원본 패키지를 그대로
// import하면 항상 throw하므로, 테스트 환경에서만 no-op으로 대체한다.
export {};
