/** ISO 문자열을 "YYYY-MM-DD HH:mm" 형식(로컬 타임존)으로 표시한다. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/**
 * 아이템 레벨 표시용 포맷.
 * 실 API(GET /armories/characters/{name}/profiles)는 ItemAvgLevel을 "1,805.00" 같은
 * 콤마 포함 문자열로 내려준다 (docs/API_NOTES.md 참고). 문자열은 그대로 쓰고,
 * 숫자로 오는 경우에만 콤마를 붙인다.
 */
export function formatItemLevel(value: string | number): string {
  if (typeof value === "string") return value;
  return value.toLocaleString("ko-KR");
}
