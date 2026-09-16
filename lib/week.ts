/** ISO date (YYYY-MM-DD) of the Monday that starts the week containing `date`. */
export function weekOf(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOffset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayOffset);
  return d.toISOString().slice(0, 10);
}

export function formatWeek(week: string): string {
  const start = new Date(`${week}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)} – ${fmt(end)}, ${end.getUTCFullYear()}`;
}
