// Public reading endpoint: numbered official readings with optional D1 overrides.
import { validReadingNumber, baseReading, parseSavedReading } from '../_lib/responsive-reading.js';

const reply = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export async function onRequestGet({ request, env }) {
  const raw = new URL(request.url).searchParams.get('number');
  if (!/^[1-9]\d{0,2}$/.test(raw || '') || !validReadingNumber(Number(raw))) {
    return reply({ error: 'invalid_number' }, 400);
  }
  if (!env.DB) return reply({ error: 'database_unavailable' }, 503);
  const number = Number(raw);
  try {
    const [record, base] = await Promise.all([
      env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('responsive-reading-' + number).first(),
      baseReading(env, request, number),
    ]);
    const saved = parseSavedReading(record?.body, base);
    const reading = saved || base;
    return reply({
      number, title: base?.title || '',
      text: reading?.text || '',
      verses: reading?.verses || [],
      source: saved ? 'admin' : base ? 'official-ppt' : 'none',
    });
  } catch {
    return reply({ error: number <= 137 ? 'reading_unavailable' : 'database_error' }, 503);
  }
}
