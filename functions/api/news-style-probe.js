import { onRequestPut } from './admin/bulletin.js';
import { reviewChurchNews } from '../_lib/news-language-review.js';
export async function onRequestGet({ request, env }) {
  const key = request.headers.get('X-Style-Test') || '';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== '02ba088e530733c668818bfde2859998d2a75216516ffe19a9f939fa74eb76ed') return new Response(null, { status: 404 });
  let stored;
  const DB = {
    prepare(sql) {
      return { bind(...args) { return { sql, args, async first() { return null; } }; } };
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
    news: "봉사자 명단을 미리 사전에 확인해 주세요.\n참석하시는 분들은 각자 개인의 물병을 가져오세요.\n다음 주 예배는 오전 11시에 시작합니다.\n주일예배후다같이식사합니다\n부모님께서 아이의 손을 잡고 교회에 오십시요.\n참석하지 못하시는 분은 금요일까지 김하늘 목사님께 알려 주세요.",
  };
  const response = await onRequestPut({
    env: { DB, NEWS_AI: env.NEWS_AI },
    request: new Request(requestUrl, { method: 'PUT', headers: { Origin: requestUrl.origin }, body: JSON.stringify(payload) }),
  });
  const forced = await reviewChurchNews('참석은 선택 사항입니다.', {
    async run(model, input) {
      if (JSON.parse(input.messages[1].content).lines) return { response: { lines: ['참석은 필수 사항입니다.'] } };
      return env.NEWS_AI.run(model, input);
    }
  });
  return Response.json({ ...await response.json(), stored, forced }, { status: response.status });
}
