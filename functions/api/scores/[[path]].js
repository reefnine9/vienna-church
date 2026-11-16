export async function onRequestGet({request,env,params}){
 const key=Array.isArray(params.path)?params.path.join('/'):String(params.path||'');
 if(!(/^(?:choir\/[a-zA-Z0-9._-]+|hymns\/(?:[1-9]|[1-9]\\d|[1-5]\\d\\d|6[0-3]\\d|64[0-5]))\\.pdf$/.test(key)))return new Response('Not found',{status:404});
 if(!env.SCORES)return new Response('Storage unavailable',{status:503});
 const object=await env.SCORES.get(key);
 if(!object)return new Response('Not found',{status:404});
 return new Response(object.body,{headers:{'content-type':'application/pdf','content-disposition':'inline','cache-control':'public,max-age=3600','x-content-type-options':'nosniff','accept-ranges':'none'}});
}
