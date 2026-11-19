const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export const normalize=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').replace(/[–—~〜～]/g,'-').replace(/：/g,':').trim();
const books=[['창','창세기'],['출','출애굽기'],['레','레위기'],['민','민수기'],['신','신명기'],['수','여호수아'],['삿','사사기'],['룻','룻기'],['삼상','사무엘상'],['삼하','사무엘하'],['왕상','열왕기상'],['왕하','열왕기하'],['대상','역대상'],['대하','역대하'],['스','에스라'],['느','느헤미야'],['에','에스더'],['욥','욥기'],['시','시편'],['잠','잠언'],['전','전도서'],['아','아가'],['사','이사야'],['렘','예레미야'],['애','예레미야애가'],['겔','에스겔'],['단','다니엘'],['호','호세아'],['욜','요엘'],['암','아모스'],['옵','오바댜'],['욘','요나'],['미','미가'],['나','나훔'],['합','하박국'],['습','스바냐'],['학','학개'],['슥','스가랴'],['말','말라기'],['마','마태복음'],['막','마가복음'],['눅','누가복음'],['요','요한복음'],['행','사도행전'],['롬','로마서'],['고전','고린도전서'],['고후','고린도후서'],['갈','갈라디아서'],['엡','에베소서'],['빌','빌립보서'],['골','골로새서'],['살전','데살로니가전서'],['살후','데살로니가후서'],['딤전','디모데전서'],['딤후','디모데후서'],['딛','디도서'],['몬','빌레몬서'],['히','히브리서'],['약','야고보서'],['벧전','베드로전서'],['벧후','베드로후서'],['요일','요한일서'],['요이','요한이서'],['요삼','요한삼서'],['유','유다서'],['계','요한계시록']];
function parseReference(input){const ref=normalize(input);const match=books.flatMap(([abbr,full])=>[{book:abbr,label:full},{book:abbr,label:abbr}]).filter(x=>ref.startsWith(x.label)).sort((a,b)=>b.label.length-a.label.length)[0];if(!match)return null;const label=match.label;const rest=ref.slice(label.length);const m=rest.match(/^(\\d+)(?:장|편)?(?:(\\d+)(?:절)?(?:[-](\\d+)(?:절)?)?)?$/)||rest.match(/^(\\d+):(\\d+)(?:-(\\d+))?$/);if(!m)return null;const chapter=Number(m[1]),start=m[2]?Number(m[2]):1,end=m[3]?Number(m[3]):(m[2]?start:200);if(chapter<1||chapter>150||start<1||end<start||end>200||end-start>199)return null;return {book:match.book,chapter,start,end};}
export async function onRequestGet({request,env}){
 const reference=normalize(new URL(request.url).searchParams.get('reference'));
 if(!reference||reference.length>120)return reply({error:'invalid_reference'},400);
 if(!env.DB)return reply({error:'database_unavailable'},503);
 try{
  const manual=await env.DB.prepare('SELECT body FROM announcements WHERE id=?').bind('scripture-krv-'+reference).first();
  if(manual?.body)return reply({reference,text:manual.body,translation:'개역개정',source:'admin'});
  const parsed=parseReference(reference);
  if(!parsed)return reply({reference,text:'',translation:'개역개정',source:'none'});
  const rows=await env.DB.prepare('SELECT verse,text FROM bible_verses WHERE book=? AND chapter=? AND verse BETWEEN ? AND ? ORDER BY verse').bind(parsed.book,parsed.chapter,parsed.start,parsed.end).all();
  const verses=rows.results||[];
  return reply({reference,text:verses.map(v=>v.verse+'절 '+v.text).join('\\n'),translation:'개역개정',source:verses.length?'database':'none',count:verses.length});
 }catch(e){return reply({error:'database_error'},500)}
}
