export async function onRequestGet({ request, env }) {
  const secret = request.headers.get('X-Proof-Test') || '';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== '60b65ddd822a328ef23bedee3e7f39ee29622713c65d0fedfdeb203f6becb0f7') return new Response(null, { status: 404 });
  if (!env.NEWS_AI) return Response.json({ binding: false });
  try {
    const result = await env.NEWS_AI.run('@cf/google/gemma-4-26b-a4b-it', {
      messages: [
        { role: 'system', content: '국립국어원 한글 맞춤법에 따라 띄어쓰기를 교정하세요. 문장만 출력하세요.' },
        { role: 'user', content: '오늘예배가끝난뒤에는교회식당에서함께점심을먹겠습니다.' },
      ],
      chat_template_kwargs: { enable_thinking: false },
      max_tokens: 250,
      temperature: 0,
    });
    return Response.json({ binding: true, result });
  } catch (error) {
    return Response.json({ binding: true, error: String(error) }, { status: 502 });
  }
}
