/**
 * 시설 설명은 "이름 · 운영시간 · 안내 · …" 한 줄로 온다. 한 문단으로 그리면 읽기 어려워(이름·시간·안내가 섞인다)
 * 첫 조각은 이름으로 굵게, 나머지는 한 줄씩 나눠 쓴다. "학기 중 …(…), 방학 중 …" 처럼 쉼표로 이어진 기간도 줄을 나눈다.
 */
export function splitFacilityNote(note: string): { title: string; lines: string[] } {
  const parts = note
    .split(/\s+·\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const [title = note, ...rest] = parts;
  const lines = rest.flatMap((p) => p.split(/(?<=\)),\s+/).map((l) => l.trim()));
  return { title, lines };
}
