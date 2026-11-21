const zone = 'Europe/Vienna';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: zone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export const viennaDay = date => dayFormatter.format(date);
export const likesTimestamp = date => date.toISOString().slice(0, 19).replace('T', ' ');

function viennaMidnight(day) {
  const utcMidnight = Date.parse(day + 'T00:00:00Z');
  const parts = Object.fromEntries(
    timeFormatter.formatToParts(new Date(utcMidnight))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  );
  const localClockAsUtc = Date.UTC(
    parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second
  );
  return likesTimestamp(new Date(utcMidnight - (localClockAsUtc - utcMidnight)));
}

export function likeDayRange(now = new Date()) {
  const date = viennaDay(now);
  const tomorrow = new Date(date + 'T00:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const nextDate = tomorrow.toISOString().slice(0, 10);
  return { date, start: viennaMidnight(date), end: viennaMidnight(nextDate) };
}

const initialized = new WeakSet();
const schema = [
  'CREATE TABLE IF NOT EXISTS bulletin_likes (visitor_id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS bulletin_like_clicks (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  'CREATE INDEX IF NOT EXISTS idx_bulletin_likes_created_at ON bulletin_likes(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_bulletin_like_clicks_created_at ON bulletin_like_clicks(created_at)',
];

export async function ensureLikesSchema(db) {
  if (initialized.has(db)) return;
  await db.batch(schema.map(statement => db.prepare(statement)));
  initialized.add(db);
}
