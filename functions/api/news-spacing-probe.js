import { reviewChurchNews } from '../_lib/news-language-review.js';
import { proofreadChurchNews } from '../_lib/news-proofreading.js';
export async function onRequestGet({ request, env }) {
  const secret = request.headers.get('X-Proof-Test') || '';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== '60b65ddd822a328ef23bedee3e7f39ee29622713c65d0fedfdeb203f6becb0f7') return new Response(null, { status: 404 });
  try {
    return Response.json(await reviewChurchNews(proofreadChurchNews("오늘예배가끝난뒤에는교회식당에서함께점심을먹겠습니다.\n다음주일에는오후2시에김하늘목사님과교회식당에서만납니다.\n부모님께서 아이의 손을 잡고 교회에 오십시요.\n7명이신청하였지만참석하지못했습니다.\n다음 주일에는 오전 11시에 카를스플라츠역 2번 출구에서 만납니다.\n회의에서 안건을 의논할 예정입니다.\n신청 링크는 https://example.org/a?show=123 입니다.\n\n| 첫째주 | 11월 29일 |"), env.NEWS_AI));
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
