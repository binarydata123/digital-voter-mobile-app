const indiaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
});

export function getIndiaCalendarDate(now = new Date()) {
  const parts = indiaDateFormatter.formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function getElectionVotingError(electionDate?: string | null, now = new Date()) {
  const raw = String(electionDate ?? "").trim();
  const day = raw.slice(0, 10);
  const date = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    return "Your election date is not set. Please ask your administrator to set it before marking voters as voted.";
  }
  return day === getIndiaCalendarDate(now)
    ? ""
    : `Voters can only be marked as voted on your election date (${day}).`;
}
