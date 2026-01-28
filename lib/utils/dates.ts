export function addMonthsToISODate(dateISO: string, months: number): string | null {
  if (!dateISO || !Number.isFinite(months)) return null;

  const [yearStr, monthStr, dayStr] = dateISO.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) return null;

  const targetMonthIndex = month - 1 + months;
  const firstOfTarget = new Date(Date.UTC(year, targetMonthIndex, 1));
  if (Number.isNaN(firstOfTarget.getTime())) return null;

  const daysInMonth = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const finalDay = Math.min(day, daysInMonth);
  const finalDate = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), finalDay),
  );

  return finalDate.toISOString().slice(0, 10);
}
