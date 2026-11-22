import React,{useState,useEffect,useRef} from 'react';import {createPortal} from 'react-dom';import{createRoot}from'react-dom/client';import{ChevronLeft,ChevronRight,ChevronDown,ChevronUp,Share2,Type,Church,Settings,Heart}from'lucide-react';import './style.css';import Admin from './Admin.jsx';import PdfScore from './PdfScore.jsx';import ScorePanel from './ScorePanel.jsx';import LikeChart from './LikeChart.jsx';
const sample={date:'2026-11-08',time:'낮 12시',sermon:'너를 보면 하나님이 살아 계신것을',rows:[['경배와 찬양','다같이'],['조용한 기도','다같이 (인도자)','stand'],['경배 찬송','19장','stand,hymn'],['죄의 고백 / 용서의 말씀','인도자','stand'],['교독','105번','reading'],['대표 기도','양태중'],['찬송','382장','hymn'],['성경 봉독','요한복음 14장 9절','scripture'],['찬송','찬양대 · 은혜의 자리'],['말씀','박철학 선교사님'],['신앙 고백','사도신경'],['봉헌 찬송','516장','hymn']]};
function sunday(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+(7-x.getDay())%7);return x}
function dateKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function withoutOldLunchTable(news,lunch){if(!lunch?.length)return news;const lines=(news||'').split('\n');const out=[];for(let i=0;i<lines.length;){const line=lines[i];if(/^\s*\|/.test(line)&&/날짜/.test(line)){let j=i;const group=[];while(j<lines.length&&/^\s*\|/.test(lines[j]))group.push(lines[j++]);if(group.some(x=>/담당|정리/.test(x))){i=j;continue}}out.push(line);i++}return out.join('\n').replace(/\n{3,}/g,'\n\n').trim()}
function NewsBullets({text}){const lines=(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!lines.length)return <p>이번 주 교회 소식은 아직 등록되지 않았습니다.</p>;return <ul className="news-bullets">{lines.map((line,i)=><li key={i}>{line.replace(/^(?:[•●▪◦]|[-*]|\d+[.)])\s*/,'')}</li>)}</ul>}
function dateText(s){return new Date(s+'T12:00:00').toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).replace(/일요일/g,'주일')}
function ResponsiveReading({value}){
 const match=String(value||'').match(/(?:^|\D)(\d{1,3})\s*(?:번|호)?/);
 const number=match?Number(match[1]):null;
 const [reading,setReading]=useState({text:'',verses:[]}),[status,setStatus]=useState('loading');
 useEffect(()=>{
  if(!number||number>200){setStatus('invalid');return}
  let active=true;setStatus('loading');
  fetch('/api/responsive-reading?number='+number,{cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error();return r.json()})
   .then(x=>{if(active){setReading({text:x.text||'',verses:Array.isArray(x.verses)?x.verses:[]});setStatus(x.text?'ready':'empty')}})
   .catch(()=>{if(active)setStatus('error')});
  return()=>{active=false}
 },[number]);
 const lines=reading.verses.length?reading.verses.map(v=>({text:v.text,role:v.role})):reading.text.replace(/\\n/g,'\n').split(/\r?\n/).filter(Boolean).map((text,i)=>({text,role:i%2?'congregation':'leader'}));
 return <div className="responsive-reading-content">{status==='ready'?lines.map((line,i)=><p key={i} className={(line.role==='all'||i%2===1)?'responsive-reading-bold':'responsive-reading-normal'} style={{fontWeight:(line.role==='all'||i%2===1)?800:400}}>{(line.role==='all'||i%2===1)?<strong style={{fontWeight:800}}>{line.text}</strong>:line.text}</p>):<p>{status==='loading'?'교독문을 불러오는 중입니다.':status==='empty'?'교독문 '+number+'번의 본문이 아직 등록되지 않았습니다. 관리자 메뉴에서 등록해 주세요.':status==='invalid'?'교독문 번호를 확인해 주세요.':'교독문을 불러오지 못했습니다. 다시 시도해 주세요.'}</p>}</div>
}
function ScriptureReading({reference}){
 const [text,setText]=useState(''),[status,setStatus]=useState('loading');
 useEffect(()=>{let live=true;setStatus('loading');setText('');fetch('/api/scripture?reference='+encodeURIComponent(reference),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(x=>{if(live){setText(x.text||'');setStatus(x.text?'ready':'empty')}}).catch(()=>{if(live)setStatus('error')});return()=>{live=false}},[reference]);
 return <div className="responsive-reading-content scripture-reading-content"><small>개역개정</small>{status==='ready'?text.replace(/\\n/g,'\n').split(/\r?\n/).filter(Boolean).map((line,i)=><p key={i}>{line}</p>):<p>{status==='loading'?'성경 본문을 불러오는 중입니다.':status==='empty'?'해당 성경 본문이 아직 등록되지 않았습니다. 관리자 메뉴에서 사용 권한이 있는 개역개정 본문을 등록해 주세요.':'성경 본문을 불러오지 못했습니다.'}</p>}</div>
}
const D1_QUOTA_RESET_AT = Date.parse('2026-11-22T00:00:00Z');

function BulletinUnavailable({ error }) {
 const showRecoveryTime = error === 'database_query_failed' && Date.now() < D1_QUOTA_RESET_AT;
 const errorDetails = showRecoveryTime
  ? '비엔나 시간으로 일요일 오전 1시 이후 다시 이용하실 수 있습니다.'
  : '잠시 후 다시 시도해 주세요.';

 return <section className="empty" aria-live="polite">
  <h2>{error ? '프로그램 오류로 잠시 주보가 안 됩니다.' : '해당 주일의 주보가 아직 등록되지 않았습니다.'}</h2>
  <p>{error ? errorDetails : '관리자가 아직 이 날짜의 주보를 게시하지 않았습니다.'}</p>
 </section>;
}

function App(){const[requestedDate,setRequestedDate]=useState(()=>{const v=new URLSearchParams(location.search).get('date');return /^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:null});const[expanded,setExpanded]=useState({});const[scoreOpen,setScoreOpen]=useState(false);const[scoreUrl,setScoreUrl]=useState('');const[scoreTitle,setScoreTitle]=useState('경배와 찬양');const[sharedPraiseUrl,setSharedPraiseUrl]=useState('/scores/praise.pdf');const[size,setSize]=useState(()=>{try{const v=Number(localStorage.getItem('church-bulletin-font-size'));return Number.isFinite(v)&&v>=14&&v<=36?v:16}catch{return 16}});const [likeCount,setLikeCount]=useState(null);const confirmedLikesRef=useRef(null);const screenLoaded=useRef(false);const likeButtonRef=useRef(null);const likeLayerRef=useRef(null);const pendingLikesRef=useRef({count:0,result:null});const [heartActive,setHeartActive]=useState(false);const heartIdleTimer=useRef(null);const floatingStreakRef=useRef({count:0,lastTap:0});useEffect(()=>()=>clearTimeout(heartIdleTimer.current),[]);const likeHoldTimer=useRef(null),likeHeld=useRef(false);const [showLikeChart,setShowLikeChart]=useState(false);const [visualStyle,setVisualStyle]=useState('basic');const [bulletin,setBulletin]=useState(null);const [fetching,setFetching]=useState(true);const [loadError,setLoadError]=useState('');
const date = requestedDate ?? bulletin?.date ?? null;

function applyRefreshedLikes(likes) {
 if (typeof likes?.count !== 'number' || pendingLikesRef.current.count > 0) return;
 confirmedLikesRef.current = likes;
 setLikeCount(likes.count);
}

useEffect(() => {
 let active = true;
 setFetching(true);
 setLoadError('');
 const path = '/api/bulletins' + (requestedDate ? '/' + requestedDate : '');
 const url = path + (screenLoaded.current ? '' : '?screen=1');
 fetch(url, { cache: 'no-store' })
  .then(async response => {
   const data = await response.json();
   if (!response.ok) throw Error(data.error || 'http_' + response.status);
   return data;
  })
  .then(data => {
   if (!active) return;
   if (data.screen) {
    screenLoaded.current = true;
    setVisualStyle(data.screen.style);
    setSharedPraiseUrl(data.screen.prayerScoreUrl || '/scores/praise.pdf');
    applyRefreshedLikes(data.screen.likes);
   }
   const published = data.bulletin;
   setBulletin(published ? {
    date: published.sunday_date,
    time: published.service_time,
    sermon: published.sermon_title,
    rows: published.items.map(row => [
     row.title, row.detail, (row.standing ? 'stand,' : '') + (row.kind === 'text' ? '' : row.kind),
    ]),
    news: published.announcements?.map(announcement => announcement.body).filter(Boolean).join('\n\n') || '',
    extras: published.announcements?.find(announcement => announcement.extras)?.extras || {},
    lunch: published.lunch || [],
    choirPdfUrl: published.choirPdfUrl || '',
    temporary: data.source === 'temporary_public_copy',
   } : null);
  })
  .catch(error => {
   if (active) {
    setBulletin(null);
    setLoadError(error?.message || 'load_failed');
   }
  })
  .finally(() => {
   if (active) setFetching(false);
  });
 return () => { active = false; };
}, [requestedDate]);

useEffect(() => {
 let active = true;
 const timer = setInterval(() => {
  if (document.hidden || pendingLikesRef.current.count > 0) return;
  const previous = confirmedLikesRef.current;
  fetch('/api/likes', { cache: 'no-store' })
   .then(response => response.json())
   .then(likes => {
    if (active && confirmedLikesRef.current === previous) applyRefreshedLikes(likes);
   })
   .catch(() => {});
 }, 10 * 60 * 1000);
 return () => {
  active = false;
  clearInterval(timer);
 };
}, []);

function floatHeart(){const button=likeButtonRef.current,layer=likeLayerRef.current;if(!button||!layer||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const rect=button.getBoundingClientRect(),heart=document.createElement('span');heart.className='church-live-heart';heart.textContent='♥';const rand=(min,max)=>min+Math.random()*(max-min);heart.style.left=(rect.left+rect.width/2+rand(-12,12))+'px';heart.style.top=(window.innerHeight*0.5+rand(-18,18))+'px';const now=Date.now(),streak=floatingStreakRef.current;streak.count=now-streak.lastTap<1200?Math.min(streak.count+1,15):1;streak.lastTap=now;heart.style.fontSize=(rand(23,33)+Math.min(streak.count-1,14)*5.5)+'px';heart.style.color=['#e53859','#f04468','#d92345','#f46a86'][Math.floor(Math.random()*4)];heart.style.setProperty('--x1',rand(-30,30)+'px');heart.style.setProperty('--x2',rand(-52,52)+'px');heart.style.setProperty('--x3',rand(-65,65)+'px');heart.style.setProperty('--rise',rand(170,235)+'px');heart.style.setProperty('--duration',rand(1.5,2.6)+'s');layer.appendChild(heart);heart.addEventListener('animationend',()=>heart.remove(),{once:true})}

async function likeBulletin() {
 setHeartActive(true);
 clearTimeout(heartIdleTimer.current);
 heartIdleTimer.current = setTimeout(() => setHeartActive(false), 950);
 floatHeart();
 const pending = pendingLikesRef.current;
 pending.count++;
 setLikeCount(count => count === null ? null : count + 1);

 try {
  const response = await fetch('/api/likes', { method: 'POST', credentials: 'same-origin' });
  if (!response.ok) throw Error('save failed');
  const likes = await response.json();
  const previous = pending.result;
  if (!previous || likes.date > previous.date
      || (likes.date === previous.date && likes.count >= previous.count)) {
   pending.result = likes;
  }
 } catch {
  alert('좋아요를 서버에 저장하지 못했습니다.');
 } finally {
  pending.count--;
  if (pending.count === 0) {
   if (pending.result) confirmedLikesRef.current = pending.result;
   pending.result = null;
   setLikeCount(confirmedLikesRef.current?.count ?? null);
  }
 }
}
useEffect(()=>{try{localStorage.setItem('church-bulletin-font-size',String(size))}catch{}},[size]);useEffect(()=>{if(!scoreOpen)return;const key=e=>{if(e.key==='Escape')setScoreOpen(false)};document.addEventListener('keydown',key);const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=old}},[scoreOpen]);function move(n){const d=new Date((date||dateKey(sunday(new Date())))+'T12:00:00');d.setDate(d.getDate()+n*7);setRequestedDate(dateKey(d));setExpanded({});setScoreOpen(false)}async function share(){const data={title:'비엔나교회 주보',url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);alert('주보 링크를 복사했습니다.')}}catch(e){if(e.name!=='AbortError')alert('링크 공유를 완료하지 못했습니다.')}}return <main className={visualStyle==='revision3'?'bulletin-revision3':visualStyle==='revision2'?'bulletin-revision2':visualStyle==='revision1'?'bulletin-revision1':'bulletin-basic'} style={{'--body-size':size+'px'}}><header><div className="brand">{visualStyle==='revision3'?<span className="church-cross" aria-hidden="true">✝</span>:<Church size={23} strokeWidth={1.5}/>}<div><h1>비엔나 감리교회</h1></div><div className="church-like-wrap"><button type="button" ref={likeButtonRef} className={"bulletin-like"+(heartActive?" heart-active":"")} onPointerDown={()=>{likeHeld.current=false;clearTimeout(likeHoldTimer.current);likeHoldTimer.current=setTimeout(()=>{likeHeld.current=true;setShowLikeChart(true)},550)}} onPointerUp={()=>clearTimeout(likeHoldTimer.current)} onPointerLeave={()=>clearTimeout(likeHoldTimer.current)} onPointerCancel={()=>clearTimeout(likeHoldTimer.current)} onContextMenu={e=>e.preventDefault()} onClick={()=>{if(likeHeld.current){likeHeld.current=false;return}likeBulletin()}} aria-label={"좋아요 "+(likeCount??0)+"개"} title="좋아요"><Heart size={24} fill="#e54860" color="#e54860" strokeWidth={1.8}/><span>{likeCount===null?"–":likeCount}</span></button></div></div><div className="tools"><button aria-label="글씨 작게" onClick={()=>setSize(v=>Math.max(14,v-2))}>가−</button><button aria-label="글씨 크게" onClick={()=>setSize(v=>Math.min(36,v+2))}>가+</button><button aria-label="관리자 설정" title="관리자 설정" onClick={()=>{window.location.href="/admin"}}><Settings size={19} strokeWidth={1.9}/></button></div></header><div ref={likeLayerRef} className="church-live-hearts-layer" aria-hidden="true"/>{showLikeChart&&<div className="like-chart-backdrop" onClick={()=>setShowLikeChart(false)}><div className="like-chart-dialog" role="dialog" aria-modal="true" aria-label="최근 7일 좋아요" onClick={e=>e.stopPropagation()}><button type="button" className="like-chart-close" onClick={()=>setShowLikeChart(false)} aria-label="닫기">×</button><LikeChart compact/></div></div>}{visualStyle==='revision3'&&<section className="christmas-hero" aria-label="주일교인주보"><div className="christmas-hero-text"><strong>주일교인주보</strong><i/></div></section>}{visualStyle==='revision2'&&<section className="vienna-hero"><div className="vienna-hero-text"><strong>비엔나교회</strong></div></section>}<section className="datebar"><button onClick={()=>move(-1)} aria-label="이전 주보"><ChevronLeft/></button><div><strong>{visualStyle==='revision1'?dateText(date||dateKey(sunday(new Date()))).replace(/^\d{4}년\s*/, ''):dateText(date||dateKey(sunday(new Date())))}</strong>{visualStyle!=='revision1'&&<span>주일예배 · {bulletin?.time||'낮 12시'}</span>}</div><button onClick={()=>move(1)} aria-label="다음 주보"><ChevronRight/></button></section>{fetching?<section className="empty"><p>주보를 불러오는 중입니다...</p></section>:bulletin?<>{visualStyle!=='revision1'&&<p className="notice">* 표시는 일어서서 드리는 순서입니다.</p>}<h2 className="bulletin-section-heading">주일 예배 순서</h2>{visualStyle==='revision1'&&<p className="notice">* 표시는 일어서서 드리는 순서입니다.</p>}<section className="orders">{bulletin.rows.map(([name,value,flags=''],i)=>{const isQuietPrayer=/^조용한\s*기도$/.test(name.trim());const isChoir=/찬양대/.test(value)||/찬양대/.test(name)||(name==='찬송'&&bulletin.rows.slice(0,i+1).filter(row=>row[0]==='찬송').length===2);const rowScoreUrl=isQuietPrayer?sharedPraiseUrl:(bulletin.choirPdfUrl||bulletin.extras?.choirPdfUrl);const rowScoreTitle=isQuietPrayer?'조용한 기도':'찬양대';const isNumberedHymn=/찬송/.test(name)&&!isChoir&&/\d{1,3}\s*장/.test(String(value));const expandable=isQuietPrayer||isChoir||(!isNumberedHymn&&(/reading|scripture/.test(flags)||/교독/.test(name)||/성경\s*봉독/.test(name)));return <React.Fragment key={i}><div className={'order '+(expandable?'expandable':'')}><span>{(visualStyle==='revision1'?(/^(조용한\s*기도|경배\s*찬송|죄의\s*고백)/.test(name.trim())):flags.includes('stand'))?'* ':''}{name}</span>{expandable?<button className="value" aria-expanded={!!expanded[i]} onClick={()=>setExpanded(p=>({...p,[i]:!p[i]}))}>{value}{expanded[i]?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>:<span className="value">{value}</span>}</div>{expanded[i]&&<div className="expanded">{!(isQuietPrayer||isChoir)&&<strong>{name} · {value}</strong>}{(isQuietPrayer||isChoir)?<div className="praise-score-panel">{rowScoreUrl?<ScorePanel key={rowScoreUrl} url={rowScoreUrl} title={rowScoreTitle} onExpand={()=>{setScoreUrl(rowScoreUrl);setScoreTitle(rowScoreTitle);setScoreOpen(true)}} onClose={()=>setExpanded(p=>({...p,[i]:false}))}/>:<p>{bulletin.temporary&&!isQuietPrayer?'찬양대 악보는 서버 복구 후 열 수 있습니다.':(isQuietPrayer?'조용한 기도 공통 악보':'이번 주 찬양대 악보')+'가 아직 등록되지 않았습니다.'}</p>}</div>:/성경\s*봉독/.test(name)?<ScriptureReading reference={value}/>: (/reading/.test(flags)||/교독/.test(name))?<ResponsiveReading value={value}/>:<p>본문은 사용 권한 확인 및 관리자 등록 후 표시됩니다.</p>}</div>}{name==='말씀'&&<div className="sermon"><small>설교 제목</small><strong>{bulletin.sermon}</strong></div>}</React.Fragment>})}<div className="order"><span>교회소식</span><span className="value">아래 내용 참조</span></div><div className="order"><span>{visualStyle==='revision1'?'* ':''}파송의 노래</span><span className="value">{bulletin.extras?.sendingSong||""}</span></div><div className="order"><span>{visualStyle==='revision1'?'* ':''}공동기도/축도-주기도문</span><span className="value">{bulletin.extras?.closingPrayer||"주기도문"}</span></div></section><section className="news"><h2 className="bulletin-section-heading">교회 소식</h2><NewsBullets text={withoutOldLunchTable(bulletin.news,bulletin.lunch)}/></section><section className="community-sections">{[["servants","예배 섬김 위원"],["intercession","비엔나 가족 중보"]].filter(([key])=>bulletin.extras?.[key]).map(([key,title])=><section className="community-section" key={key}><h2>{title}</h2>{key==="servants"?<div className="servants-table-wrap"><table className="servants-table"><tbody>{bulletin.extras[key].split("\n").filter(Boolean).map((line,i)=><tr key={i}>{line.split("|").map((cell,j)=><td key={j}>{cell.trim()}</td>)}</tr>)}</tbody></table></div>:<p>{bulletin.extras[key]}</p>}</section>)}</section>{bulletin.lunch?.length>0&&<section className="lunch-section"><h2>주일 점심 및 친교 안내</h2><div className="lunch-table-wrap"><table><thead><tr><th>구분</th>{bulletin.lunch.map(e=><th key={e.date}>{Number(e.date.slice(5,7))}/{Number(e.date.slice(8,10))}</th>)}</tr></thead><tbody><tr><th>점심 준비</th>{bulletin.lunch.map(e=><td key={e.date}>{e.preparation}</td>)}</tr><tr><th>정리 담당</th>{bulletin.lunch.map(e=><td key={e.date}>{e.cleanup}</td>)}</tr></tbody></table></div></section>}</>:<BulletinUnavailable error={loadError}/>}{scoreOpen&&scoreUrl&&createPortal(<div className="praise-score-overlay" role="dialog" aria-modal="true" aria-label={scoreTitle+" 악보"}><div className="praise-score-toolbar"><strong>{scoreTitle} · 악보</strong><div className="score-header-actions"><div id="score-page-navigation-slot"/><div id="score-mark-toolbar-slot"/><button type="button" className="score-return-button" onClick={()=>setScoreOpen(false)} aria-label="주보로 돌아가기">← 주보로 돌아가기</button></div></div><PdfScore url={scoreUrl} title={scoreTitle} full pinchZoom={scoreTitle==='찬양대'}/></div>,document.body)}<section className="church-links"><h2>YouTube</h2><p><a href="https://www.youtube.com/@ViennaKoreanChurch" target="_blank" rel="noopener noreferrer">https://www.youtube.com/@ViennaKoreanChurch</a></p><h2>오시는 길</h2><p><a href="https://maps.app.goo.gl/hLjsUfWWQM9aaJhx8" target="_blank" rel="noopener noreferrer">Google 지도에서 오시는 길 보기</a></p></section><footer>비엔나교회 · 모바일 주보</footer></main>}createRoot(document.getElementById('root')).render((location.pathname==='/admin'||location.pathname==='/admin/')?<Admin/>:<App/>);
