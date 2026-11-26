import { editPublishedNews, storedNewsText } from './news-copy-edits.js';
import { bulletinReadError } from './temporary-bulletin.js';
import { likeDayRange, likeDayTotal, withLikesSchema } from './likes.js';
import { INTERCESSION_ID, INTERCESSION_START, INITIAL_INTERCESSION } from './intercession.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date)
  && !Number.isNaN(Date.parse(date + 'T12:00:00Z'))
  && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date;

function bulletinQuery(db, date) {
  const selection = date ? 'AND sunday_date = ?1' : 'ORDER BY sunday_date DESC';
  const query = db.prepare(`
    WITH published AS (
      SELECT id, sunday_date, service_time, sermon_title, scripture_reference, preacher
      FROM bulletins WHERE status = 'published' ${selection} LIMIT 1
    )
    SELECT published.*,
      (SELECT json_group_array(json_object(
        'position', position, 'title', title, 'detail', detail, 'kind', kind, 'standing', standing
      )) FROM (
        SELECT position, title, detail, kind, standing FROM worship_items
        WHERE bulletin_id = published.id ORDER BY position
      )) AS items_json,
      (SELECT json_group_array(json_object('title', title, 'body', body)) FROM (
        SELECT title, body FROM announcements
        WHERE active = 1 AND starts_on <= published.sunday_date AND ends_on >= published.sunday_date
        ORDER BY position
      )) AS news_json,
      (SELECT json_group_array(json_object('sunday_date', sunday_date, 'slot', slot, 'value', value))
        FROM annual_schedule
        WHERE sunday_date BETWEEN published.sunday_date AND date(published.sunday_date, '+14 days')
      ) AS schedule_json,
      (SELECT body FROM announcements WHERE id = 'church-lunch-schedule-v1') AS lunch_json,
      (SELECT body FROM announcements WHERE id = '${INTERCESSION_ID}') AS intercession_body,
      (SELECT body FROM announcements WHERE id = 'choir-score-weekly-' || published.sunday_date) AS choir_override
    FROM published
  `);
  return date ? query.bind(date) : query;
}

function screenQuery(db, { date, start, end }) {
  return db.prepare(`
    SELECT
      (SELECT body FROM announcements WHERE id = 'church-bulletin-design-v1') AS style,
      (SELECT body FROM announcements WHERE id = 'praise-score-global-v1') AS prayer_score,
      ${likeDayTotal} AS count
  `).bind(date, start, end);
}

function formatBulletin(row) {
  if (!row) return null;
  const { items_json, news_json, schedule_json, lunch_json, choir_override, intercession_body, ...bulletin } = row;
  const items = JSON.parse(items_json || '[]');
  const news = JSON.parse(news_json || '[]').map(announcement => {
    try {
      const data = JSON.parse(announcement.body);
      if (data && typeof data === 'object') {
        return {
          ...announcement,
          body: storedNewsText(bulletin.sunday_date, data),
          extras: data.extras || {},
        };
      }
    } catch {}
    return { ...announcement, body: editPublishedNews(bulletin.sunday_date, announcement.body) };
  });
  const schedule = JSON.parse(schedule_json || '[]');
  const dates = [0, 7, 14].map(offset => {
    const date = new Date(bulletin.sunday_date + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
  const byDate = {};
  for (const entry of schedule) {
    const values = byDate[entry.sunday_date] ||= {};
    if (entry.slot === 'custom') {
      try { Object.assign(values, JSON.parse(entry.value)); } catch {}
    } else {
      values[entry.slot] = entry.value;
    }
  }
  const today = byDate[bulletin.sunday_date] || {};
  const slots = {
    '경배 찬송': 'opening_hymn', '교독': 'responsive_reading', '교독문': 'responsive_reading',
    '대표 기도': 'prayer_leader', '봉헌 찬송': 'offertory_hymn',
  };
  let hymns = 0;
  for (const item of items) {
    const slot = item.title === '찬송' ? (++hymns === 1 ? 'hymn' : 'choir') : slots[item.title];
    if (slot && Object.hasOwn(today, slot)) item.detail = today[slot];
  }

  const newsWithExtras = news.find(announcement => announcement.extras);
  const extras = newsWithExtras?.extras || {};
  const rosterSlots = [['인도', 'service_leader'], ['대표기도', 'prayer_leader'], ['봉헌', 'offering_leader']];
  if (extras.servants || schedule.some(entry =>
    ['service_leader', 'prayer_leader', 'offering_leader', 'custom'].includes(entry.slot)
  )) {
    const header = ['구분', ...dates.map(date => Number(date.slice(5, 7)) + '/' + Number(date.slice(8, 10)))];
    const roster = [header, ...rosterSlots.map(([label, slot]) =>
      [label, ...dates.map(date => byDate[date]?.[slot] ?? '')]
    )].map(cells => cells.join(' | ')).join('\n');
    if (newsWithExtras) newsWithExtras.extras = { ...extras, servants: roster };
    else news.push({ body: '', extras: { servants: roster } });
  }
  let lunch = [];
  try {
    const all = JSON.parse(lunch_json || '[]');
    const last = new Date(bulletin.sunday_date + 'T12:00:00Z');
    last.setUTCDate(last.getUTCDate() + 20);
    const end = last.toISOString().slice(0, 10);
    if (Array.isArray(all)) {
      lunch = all.filter(entry => entry.date >= bulletin.sunday_date && entry.date <= end)
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  } catch {}

  return {
    ...bulletin,
    items,
    announcements: news,
    intercession: bulletin.sunday_date >= INTERCESSION_START
      ? (intercession_body === null || intercession_body === undefined ? INITIAL_INTERCESSION : intercession_body)
      : (extras.intercession || ''),
    lunch,
    choirPdfUrl: choir_override ?? (today.choir_pdf_url || extras.choirPdfUrl || ''),
  };
}

export async function onRequestGet({ env, request, params = {} }) {
  const date = Array.isArray(params.date) ? params.date[0] : params.date;
  if (date && !validDate(date)) return json({ error: 'invalid_date' }, 400);
  const db = env.DB;
  if (!db) return bulletinReadError(date, json, 'database_not_configured', 503);

  try {
    if (request && new URL(request.url).searchParams.get('screen') === '1') {
      const day = likeDayRange();
      const [published, settings] = await withLikesSchema(db, () =>
        db.batch([bulletinQuery(db, date), screenQuery(db, day)])
      );
      const { style, prayer_score, count } = settings.results[0];
      return json({
        bulletin: formatBulletin(published.results[0]),
        screen: {
          style: ['revision1', 'revision2', 'revision3'].includes(style) ? style : 'basic',
          prayerScoreUrl: prayer_score || '',
          likes: { count, date: day.date },
        },
      });
    }
    return json({ bulletin: formatBulletin(await bulletinQuery(db, date).first()) });
  } catch {
    return bulletinReadError(date, json, 'database_query_failed', 500);
  }
}
