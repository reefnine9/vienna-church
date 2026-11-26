import { reply, sameOrigin } from '../../_lib/auth.js';
import { INTERCESSION_ID, INITIAL_INTERCESSION } from '../../_lib/intercession.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return reply({ error: 'database_unavailable' }, 503);
  try {
    const row = await env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind(INTERCESSION_ID).first();
    return reply({ text: row ? row.body : INITIAL_INTERCESSION, customized: !!row });
  } catch { return reply({ error: 'intercession_load_failed' }, 500); }
}

export async function onRequestPut({ env, request }) {
  if (!sameOrigin(request)) return reply({ error: 'invalid_origin' }, 403);
  let data;
  try { data = await request.json(); } catch { return reply({ error: 'invalid_json' }, 400); }
  if (typeof data?.text !== 'string' || data.text.length > 6000) {
    return reply({ error: 'invalid_intercession' }, 400);
  }
  const text = data.text.trim();
  try {
    await env.DB.prepare(
      "INSERT INTO announcements(id,title,body,starts_on,ends_on,position,active) VALUES(?,?,?,'2000-01-01','2099-12-31',0,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body"
    ).bind(INTERCESSION_ID, '비엔나 교회 가족 중보기도', text).run();
    return reply({ ok: true, text });
  } catch { return reply({ error: 'intercession_save_failed' }, 500); }
}
