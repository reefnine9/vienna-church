import { likeDayRange, likeDayTotal, likesTimestamp, withLikesSchema } from '../_lib/likes.js';

const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return response({ error: 'Database unavailable' }, 503);
  try {
    const { date, start, end } = likeDayRange();
    const { count } = await withLikesSchema(db, () =>
      db.prepare(`SELECT ${likeDayTotal} AS count`).bind(date, start, end).first()
    );
    return response({ count, date });
  } catch {
    return response({ error: 'Unable to load likes' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return response({ error: 'Database unavailable' }, 503);
  try {
    const origin = request.headers.get('Origin');
    if (origin && new URL(origin).origin !== new URL(request.url).origin) {
      return response({ error: 'Invalid origin' }, 403);
    }
    const now = new Date();
    const { date, start, end } = likeDayRange(now);
    const id = crypto.randomUUID();
    const [, result] = await withLikesSchema(db, () => db.batch([
      db.prepare('INSERT INTO bulletin_like_clicks (id, created_at) VALUES (?, ?)')
        .bind(id, likesTimestamp(now)),
      db.prepare(`
        INSERT INTO bulletin_like_totals (day, count) VALUES (?1, ${likeDayTotal})
        ON CONFLICT(day) DO UPDATE SET count = bulletin_like_totals.count + 1
        RETURNING count
      `).bind(date, start, end),
    ]));
    return response({ count: result.results[0].count, date });
  } catch {
    return response({ error: 'Unable to save like' }, 500);
  }
}
