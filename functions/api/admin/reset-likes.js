import {reply,authenticated,sameOrigin} from '../../_lib/auth.js';
import {withLikesSchema,likeDayRange} from '../../_lib/likes.js';
export async function onRequestPost({request,env}){
 if(!await authenticated(request,env))return reply({error:'관리자 로그인이 필요합니다.'},401);
 if(!sameOrigin(request))return reply({error:'invalid_origin'},403);
 if(!env.DB)return reply({error:'DB unavailable'},503);
 try{
  const {date:day,start,end}=likeDayRange();
  const [clicks,legacy]=await withLikesSchema(env.DB,()=>env.DB.batch([
   env.DB.prepare('DELETE FROM bulletin_like_clicks WHERE created_at >= ? AND created_at < ?').bind(start,end),
   env.DB.prepare('DELETE FROM bulletin_likes WHERE created_at >= ? AND created_at < ?').bind(start,end),
   env.DB.prepare('DELETE FROM bulletin_like_totals WHERE day = ?').bind(day)
  ]));
  return reply({ok:true,date:day,deleted:[clicks,legacy].reduce((sum,r)=>sum+Number(r.meta?.changes||0),0)});
 }catch{return reply({error:'좋아요 초기화에 실패했습니다.'},500)}
}
