import { ensureLikesSchema, likeDayRange, likesTimestamp } from '../_lib/likes.js';

const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function countLikes(db, { start, end }) {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM bulletin_likes WHERE created_at >= ?1 AND created_at < ?2)
      + (SELECT COUNT(*) FROM bulletin_like_clicks WHERE created_at >= ?1 AND created_at < ?2)
      AS count
  `).bind(start, end);
}

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return response({ error: 'Database unavailable' }, 503);
  try {
    await ensureLikesSchema(db);
    const day = likeDayRange();
    const { count } = await countLikes(db, day).first();
    return response({ count, date: day.date });
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
    await ensureLikesSchema(db);
    const now = new Date();
    const day = likeDayRange(now);
    const [, result] = await db.batch([
      db.prepare('INSERT INTO bulletin_like_clicks (id, created_at) VALUES (?, ?)')
        .bind(crypto.randomUUID(), likesTimestamp(now)),
      countLikes(db, day),
    ]);
    return response({ count: result.results[0].count, date: day.date });
  } catch {
    return response({ error: 'Unable to save like' }, 500);
  }
}
