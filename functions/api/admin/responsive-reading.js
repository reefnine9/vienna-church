import { reply, sameOrigin } from '../../_lib/auth.js';
import {
  validReadingNumber, baseReading, parseSavedReading,
  normalizeVerses, readingText, sameReading,
} from '../../_lib/responsive-reading.js';

const idFor = number => 'responsive-reading-' + number;

async function readBase(request, env, number) {
  try { return await baseReading(env, request, number); }
  catch { return undefined; }
}

export async function onRequestGet({ request, env }) {
  const number = Number(new URL(request.url).searchParams.get('number'));
  if (!validReadingNumber(number)) return reply({ error: 'invalid_number' }, 400);
  if (!env.DB) return reply({ error: 'database_unavailable' }, 503);
  try {
    const [base, record] = await Promise.all([
      readBase(request, env, number),
      env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind(idFor(number)).first(),
    ]);
    if (number <= 137 && !base) return reply({ error: 'base_reading_unavailable' }, 503);
    const saved = parseSavedReading(record?.body, base);
    const effective = saved || base;
    return reply({
      number, title: base?.title || '',
      verses: effective?.verses || [], text: effective?.text || '',
      baseVerses: base?.verses || [],
      hasOverride: !!saved,
      source: saved ? 'admin' : base ? 'official-ppt' : 'none',
    });
  } catch { return reply({ error: 'database_error' }, 500); }
}

export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request)) return reply({ error: 'invalid_origin' }, 403);
  let body;
  try { body = await request.json(); } catch { return reply({ error: 'invalid_json' }, 400); }
  const number = body?.number;
  if (!validReadingNumber(number)) return reply({ error: 'invalid_number' }, 400);
  const base = await readBase(request, env, number);
  if (number <= 137 && !base) return reply({ error: 'base_reading_unavailable' }, 503);
  let verses = normalizeVerses(body.verses);
  // Compatibility with previous administrator versions using a plain textarea.
  if (!verses && typeof body.text === 'string') {
    if (body.text.length > 20000) return reply({ error: 'invalid_data' }, 400);
    verses = parseSavedReading(body.text, base)?.verses || null;
  }
  if (!verses?.length) return reply({ error: 'invalid_data' }, 400);
  try {
    if (base && sameReading(verses, base.verses)) {
      // Never overwrite the 137 official readings. Reverting saves no override.
      await env.DB.prepare('DELETE FROM announcements WHERE id=?').bind(idFor(number)).run();
      return reply({ ok: true, number, hasOverride: false, verses, text: readingText(verses) });
    }
    const value = JSON.stringify({ format: 'responsive-reading-v2', verses });
    await env.DB.prepare(
      "INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES(?,?,?,'2000-01-01','2099-12-31',0,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body"
    ).bind(idFor(number), '교독문 '+number+'번', value).run();
    return reply({ ok: true, number, hasOverride: true, verses, text: readingText(verses) });
  } catch { return reply({ error: 'save_failed' }, 500); }
}

export async function onRequestDelete({ request, env }) {
  if (!sameOrigin(request)) return reply({ error: 'invalid_origin' }, 403);
  const number = Number(new URL(request.url).searchParams.get('number'));
  if (!validReadingNumber(number) || number > 137) return reply({ error: 'invalid_number' }, 400);
  const base = await readBase(request, env, number);
  if (!base) return reply({ error: 'base_reading_unavailable' }, 503);
  try {
    await env.DB.prepare('DELETE FROM announcements WHERE id=?').bind(idFor(number)).run();
    return reply({ ok: true, number, hasOverride: false, verses: base.verses, text: base.text });
  } catch { return reply({ error: 'restore_failed' }, 500); }
}
