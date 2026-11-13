const enc=new TextEncoder();
const DAY=86400;
const YEAR=365*DAY;
const cookieName='vc_admin';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
export const reply=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function key(secret){return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function sign(payload,secret){return b64(await crypto.subtle.sign('HMAC',await key(secret),enc.encode(payload)))}
async function validSignature(payload,sig,secret){try{return await crypto.subtle.verify('HMAC',await key(secret),unb64(sig),enc.encode(payload))}catch{return false}}
export function configured(env){return !!(env.ADMIN_PASSWORD&&env.ADMIN_SESSION_SECRET&&env.DB&&env.ADMIN_PASSWORD.length>=12&&env.ADMIN_SESSION_SECRET.length>=32)}
function cookies(request){const raw=request.headers.get('cookie')||'';return raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)}
export async function authenticated(request,env){if(!configured(env))return false;const token=cookies(request);if(!token)return false;const parts=token.split('.');if(parts.length!==2)return false;const [payload,sig]=parts;if(!await validSignature(payload,sig,env.ADMIN_SESSION_SECRET))return false;try{const p=JSON.parse(new TextDecoder().decode(unb64(payload)));return p.v===1&&Number.isFinite(p.exp)&&p.exp>Date.now()/1000&&p.exp<=Date.now()/1000+YEAR&&p.role==='admin'}catch{return false}}
export async function issue(env){const payload=b64(enc.encode(JSON.stringify({v:1,role:'admin',exp:Math.floor(Date.now()/1000)+YEAR})));return payload+'.'+await sign(payload,env.ADMIN_SESSION_SECRET)}
export function sessionCookie(value,maxAge=YEAR){return cookieName+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge}
export function sameOrigin(request){try{return new URL(request.headers.get('origin')).origin===new URL(request.url).origin}catch{return false}}
export async function matchesPassword(input,env){if(typeof input!=='string'||input.length>256)return false;const expected=await sign('password:'+env.ADMIN_PASSWORD,env.ADMIN_SESSION_SECRET);const supplied=await sign('password:'+input,env.ADMIN_SESSION_SECRET);return expected===supplied}
export async function attemptStatus(env,request){const ip=request.headers.get('cf-connecting-ip')||'unknown';const id=await sign('rate:'+ip,env.ADMIN_SESSION_SECRET);const now=Math.floor(Date.now()/1000);const row=await env.DB.prepare('SELECT failures,blocked_until,updated_at FROM admin_login_attempts WHERE id=?').bind(id).first();return {id,blocked:!!(row&&row.blocked_until>now),failures:row&&now-row.updated_at<900?row.failures:0,now}}
export async function recordFailure(env,a){const failures=a.failures+1;const blocked=failures>=5?a.now+900:0;await env.DB.prepare('INSERT INTO admin_login_attempts(id,failures,blocked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET failures=excluded.failures,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at').bind(a.id,failures,blocked,a.now).run()}
export async function clearAttempts(env,a){await env.DB.prepare('DELETE FROM admin_login_attempts WHERE id=?').bind(a.id).run()}
