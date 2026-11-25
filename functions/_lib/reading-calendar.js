// Curated Sunday responsive-reading plan. The first 26 Sundays are sourced
// from the church's 2026–27 Google Sheet; remaining entries are recommendations.
// Writes are additive and never replace a manually chosen annual-schedule value.
const migrationName = 'reading_calendar_seed_nov2026_nov2027_v1';
const startKey = '2026-11-29';
const endKey = '2027-11-21';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const isSunday = value => datePattern.test(value || '') &&
  !Number.isNaN(Date.parse(value + 'T12:00:00Z')) &&
  new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value &&
  new Date(value + 'T12:00:00Z').getUTCDay() === 0;

export const shiftSunday = (value, weeks) => {
  const d = new Date(value + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};

export const nextViennaSunday = () => {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const d = new Date(today + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + (7 - d.getUTCDay()) % 7);
  return d.toISOString().slice(0, 10);
};

export async function getSeedCalendar(env, request) {
  if (!env.ASSETS) throw new Error('assets_unavailable');
  const response = await env.ASSETS.fetch(new URL('/data/responsive-reading-calendar.json', request.url));
  if (!response.ok) throw new Error('calendar_unavailable');
  const document = await response.json();
  const entries = document?.entries;
  if (!Array.isArray(entries) || entries.length !== 52 ||
      entries[0]?.date !== startKey || entries.at(-1)?.date !== endKey ||
      entries.some(e => !isSunday(e.date) || !Number.isInteger(e.number) || e.number < 1 || e.number > 137)) {
    throw new Error('calendar_invalid');
  }
  return entries;
}

export async function ensureReadingCalendarSeed(env, request) {
  const entries = await getSeedCalendar(env, request);
  if (!env.DB) throw new Error('database_unavailable');
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS data_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  const applied = await env.DB.prepare('SELECT name FROM data_migrations WHERE name=?').bind(migrationName).first();
  if (!applied) {
    const statements = entries.map(item => env.DB.prepare(
      'INSERT OR IGNORE INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?)'
    ).bind(item.date + '-responsive_reading', item.date, 'responsive_reading', item.number + '번'));
    statements.push(env.DB.prepare('INSERT OR IGNORE INTO data_migrations(name) VALUES(?)').bind(migrationName));
    await env.DB.batch(statements);
  }
  return entries;
}
