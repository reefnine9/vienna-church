export async function onRequestGet({env,params}){
 const n=String(params.number||'');
 if(!/^(?:[1-9]|[1-9]\d|[1-5]\d\d|6[0-3]\d|64[0-5])$/.test(n))return Response.json({exists:false});
 if(!env.SCORES)return Response.json({exists:false});
 return new Response(JSON.stringify({exists:!!await env.SCORES.head('hymns/'+n+'.pdf')}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
}