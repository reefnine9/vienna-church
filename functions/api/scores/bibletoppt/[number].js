// On-demand, best-effort PDF proxy. No bulk scraping or persistent storage.
const valid=n=>/^(?:[1-9]|[1-9]\d|[1-5]\d\d|6[0-3]\d|64[0-5])$/.test(String(n));
const base='https://bibletoppt.com';
const allowed=u=>u.protocol==='https:'&&(u.hostname==='bibletoppt.com'||u.hostname==='www.bibletoppt.com');
function decode(s){return s.replace(/&amp;/g,'&').replace(/&#038;/g,'&').replace(/&#x2F;/gi,'/').replace(/\\\//g,'/')}
async function get(url){
 const r=await fetch(url,{redirect:'manual',headers:{'user-agent':'ViennaChurchBulletin/1.0','accept':'application/pdf,text/html,*/*'}});
 if(r.status>=300&&r.status<400){const loc=r.headers.get('location');if(!loc)throw Error('redirect');const next=new URL(loc,url);if(!allowed(next))throw Error('external redirect');return fetch(next.toString(),{redirect:'manual'})}
 return r;
}
export async function onRequestGet({params,request}){
 const n=String(params.number||'');
 if(!valid(n))return new Response('Invalid hymn number',{status:400});
 try{
  const page=await get(base+'/hymn/sheet-music/'+n);
  if(!page.ok)return new Response('Source unavailable',{status:502});
  const html=(await page.text()).slice(0,1500000);
  const matches=[...html.matchAll(/(?:href|data-url|data-href)=["']([^"']+)["']/gi)].map(m=>decode(m[1]));
  const urls=[];
  for(const href of matches){
   try{const u=new URL(href,base);if(!allowed(u))continue;if(!/\.pdf(?:$|[?#])|(?:download|pdf)/i.test(u.pathname+u.search))continue;urls.push(u.toString())}catch{}
  }
  for(const url of [...new Set(urls)].slice(0,12)){
   try{
    const r=await get(url);if(!r.ok)continue;
    const size=Number(r.headers.get('content-length')||0);if(size>12*1024*1024)continue;
    const data=new Uint8Array(await r.arrayBuffer());
    if(data.length>12*1024*1024||data.length<5||String.fromCharCode(...data.slice(0,5))!=='%PDF-')continue;
    return new Response(data,{headers:{'content-type':'application/pdf','content-disposition':'inline; filename="hymn-'+n+'.pdf"','cache-control':'public,max-age=3600','x-content-type-options':'nosniff'}});
   }catch{}
  }
  return new Response('No directly downloadable PDF found on source page',{status:404,headers:{'cache-control':'no-store'}});
 }catch{return new Response('Could not retrieve hymn PDF',{status:502,headers:{'cache-control':'no-store'}})}
}