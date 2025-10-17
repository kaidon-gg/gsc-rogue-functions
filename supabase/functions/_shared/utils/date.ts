/**
 * Helper: format a naive timestamp as Europe/Dublin local time
 * @param naiveIsoLike - A timestamp string that should be interpreted as Europe/Dublin local time
 * @returns Formatted date string or "TBA" if input is null/undefined
 */
export function formatDublinLocal(naiveIsoLike: string | null | undefined): string {
  if (!naiveIsoLike) return "TBA";
  // Interpret the DB naive timestamp as if it were in Europe/Dublin local time.
  // We construct a Date using the parts to avoid timezone shifts.
  const parts = naiveIsoLike.replace(" ", "T").replace(/(\.\d+)?$/, "") // strip fractional seconds if present
    .split(/[-T:]/).map(Number);
  // parts: [YYYY, MM, DD, hh, mm, ss?]
  const [y, m, d, hh = 0, mm = 0, ss = 0] = parts;
  // Create a Date in the Europe/Dublin timezone by formatting directly via Intl
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  // When we display, ask Intl to render in Europe/Dublin
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(dt);
}