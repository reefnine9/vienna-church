// Shared responsive-reading parsing for admin and public bulletin endpoints.
// Official 1–137 texts remain in the static asset; overrides are separate D1 rows.
export const validReadingNumber = n => Number.isInteger(n) && n >= 1 && n <= 200;
export const allowedRoles = new Set(['leader', 'congregation', 'all']);

export function normalizeVerses(verses) {
  if (!Array.isArray(verses) || verses.length > 100) return null;
  const rows = [];
  for (const row of verses) {
    if (!row || !allowedRoles.has(row.role) || typeof row.text !== 'string' ||
        row.text.length > 1500 || /[\r\n]/.test(row.text)) return null;
    rows.push({ role: row.role, text: row.text.trim() });
  }
  if (rows.some(row => !row.text) || rows.map(row => row.text).join('\n').length > 20000) return null;
  return rows;
}

export const readingText = verses => verses.map(row => row.text).join('\n');

export async function baseReading(env, request, number) {
  if (number > 137) return null;
  if (!env.ASSETS) throw new Error('base_asset_unavailable');
  const response = await env.ASSETS.fetch(new URL('/data/responsive-readings.json', request.url));
  if (!response.ok) throw new Error('base_asset_unavailable');
  const data = await response.json();
  const item = data?.readings?.[String(number)];
  const verses = normalizeVerses(item?.verses);
  if (!verses || !verses.length) throw new Error('base_reading_unavailable');
  return { number, title: item.title || '', verses, text: readingText(verses) };
}

export function parseSavedReading(body, base) {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    if (parsed?.format === 'responsive-reading-v2') {
      const verses = normalizeVerses(parsed.verses);
      if (verses && verses.length) return { verses, text: readingText(verses) };
    }
  } catch { /* Older entries contain raw lines of text. */ }
  // Preserve roles when importing existing plain-text admin overrides.
  const lines = body.split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  const verses = lines.map((text, index) => ({
    role: base?.verses?.[index] && base.verses.length === lines.length
      ? base.verses[index].role
      : index % 2 ? 'congregation' : 'leader',
    text,
  }));
  return { verses, text: readingText(verses) };
}

export const sameReading = (a, b) => JSON.stringify(a) === JSON.stringify(b);
