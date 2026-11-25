import { reply, sameOrigin } from '../../_lib/auth.js';
import {
  ensureReadingCalendarSeed, isSunday, shiftSunday, nextViennaSunday,
} from '../../_lib/reading-calendar.js';

const validReading = number => Number.isInteger(number) && number >= 1 && number <= 137;
const getNumber = value => {
  const match = String(value || '').match(/^\s*(\d{1,3})\s*(?:번|호)?\s*$/);
  return match ? Number(match[1]) : null;
};

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  const start = params.get('start') || nextViennaSunday();
  if (!isSunday(start)) return reply({ error: 'invalid_sunday' }, 400);
  if (!env.DB) return reply({ error: 'database_unavailable' }, 503);
  try {
    const seed = await ensureReadingCalendarSeed(env, request);
    const end = shiftSunday(start, 51);
    const schedule = await env.DB.prepare(
      "SELECT sunday_date,value FROM annual_schedule WHERE slot='responsive_reading' AND sunday_date>=? AND sunday_date<=?"
    ).bind(start, end).all();
    const chosen = new Map((schedule.results || []).map(row => [row.sunday_date, getNumber(row.value)]));
    const byDate = new Map(seed.map(item => [item.date, item]));
    const entries = Array.from({ length: 52 }, (_, index) => {
      const date = shiftSunday(start, index);
      const source = byDate.get(date);
      const number = chosen.get(date) ?? source?.number ?? null;
      return {
        date, number, festival: source?.festival || '절기 미지정',
        previousDate: source?.previousDate || '',
        previousReading: source?.previousReading || '미확인',
        previousLink: source?.previousLink || '',
        origin: source?.origin || 'unassigned',
      };
    });
    return reply({ start, end, entries });
  } catch {
    return reply({ error: 'calendar_load_failed' }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request)) return reply({ error: 'invalid_origin' }, 403);
  let body;
  try { body = await request.json(); } catch { return reply({ error: 'invalid_json' }, 400); }
  if (!isSunday(body?.date) || !validReading(body?.number)) {
    return reply({ error: 'invalid_entry' }, 400);
  }
  try {
    const date = body.date, value = body.number + '번';
    // A single-slot upsert leaves all other annual-plan fields untouched.
    await env.DB.prepare(
      "INSERT INTO annual_schedule(id,sunday_date,slot,value) VALUES(?,?,?,?) ON CONFLICT(sunday_date,slot) DO UPDATE SET value=excluded.value"
    ).bind(date + '-responsive_reading', date, 'responsive_reading', value).run();
    return reply({ ok: true, date, number: body.number, value });
  } catch {
    return reply({ error: 'calendar_save_failed' }, 500);
  }
}
