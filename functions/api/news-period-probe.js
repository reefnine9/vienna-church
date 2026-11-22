import { onRequestPut } from './admin/bulletin.js';
export async function onRequestGet({ request, env }) {
  const key = request.headers.get('X-Period-Test') || '';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== '1f470be072d5e815978350f3b505f9c692b61daff5be11cce509fcbb92625b94') return new Response(null, { status: 404 });

  let stored;
  const DB = {
    prepare(sql) {
      return {
        bind(...args) { return { sql, args, async first() { return null; } }; },
      };
    },
    async batch(statements) {
      const body = statements.find(s => s.args[0] === 'weekly-2026-12-06').args[2];
      stored = JSON.parse(body).news;
    },
  };
  const requestUrl = new URL('/api/admin/bulletin', request.url);
  const payload = {
    action: 'publish', date: '2026-12-06', time: '12:00',
    sermon: '', scripture: '', preacher: '',
    rows: [{ name: '기도', value: '다 같이', standing: false, kind: 'text' }],
    news: "오늘예배가끝난뒤다같이식사합니다 다음주에도함께기도합시다\n부모님께서 아이의 손을 잡고 교회에 오십시요\n예배 안내\n- 예배 시간\n다음 주에도 오시나요?\n자세한 일정은 https://example.org/news 에서 확인해 주세요",
  };
  const response = await onRequestPut({
    env: { DB, NEWS_AI: env.NEWS_AI },
    request: new Request(requestUrl, { method: 'PUT', headers: { Origin: requestUrl.origin }, body: JSON.stringify(payload) }),
  });
  return Response.json({ ...await response.json(), stored }, { status: response.status });
}
