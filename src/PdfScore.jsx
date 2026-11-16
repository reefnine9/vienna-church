import React,{useEffect,useRef,useState} from 'react';

const PDFJS_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let loader;
function loadPdfJs(){
 if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
 if(!loader)loader=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=PDFJS_URL;script.async=true;
  script.onload=()=>window.pdfjsLib?resolve(window.pdfjsLib):reject(new Error('pdfjs unavailable'));
  script.onerror=()=>reject(new Error('pdfjs load failed'));
  document.head.appendChild(script);
 }).catch(e=>{loader=null;throw e});
 return loader;
}
export default function PdfScore({url,title='악보',full=false}){
 const host=useRef(null),pdfRef=useRef(null),touchStart=useRef(null),trackRef=useRef(null),animationRef=useRef(false);
 const [status,setStatus]=useState('loading'),[pages,setPages]=useState(0),[current,setCurrent]=useState(1);
 const [width,setWidth]=useState(0);
 useEffect(()=>{
  let cancelled=false,task;
  pdfRef.current=null;setStatus('loading');setPages(0);setCurrent(1);
  loadPdfJs().then(lib=>{
   if(cancelled)return;
   lib.GlobalWorkerOptions.workerSrc=WORKER_URL;
   task=lib.getDocument({url,withCredentials:false});
   return task.promise;
  }).then(pdf=>{if(!pdf||cancelled)return;pdfRef.current=pdf;setPages(pdf.numPages);setStatus('ready')})
    .catch(()=>{if(!cancelled)setStatus('error')});
  return()=>{cancelled=true;pdfRef.current=null;if(task)task.destroy().catch(()=>{})};
 },[url]);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  const resize=()=>setWidth(el.clientWidth);
  resize();
  if(typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(resize);observer.observe(el);
  return()=>observer.disconnect();
 },[]);

 useEffect(()=>{
  const pdf=pdfRef.current,root=host.current,track=trackRef.current;
  if(!pdf||!root||!track||!width)return;
  let cancelled=false;const jobs=[];
  animationRef.current=false;
  track.style.transition='none';track.style.transform='translateX(-33.333333%)';track.replaceChildren();
  for(const index of [current-1,current,current+1]){
   const slide=document.createElement('div');slide.className='score-pdf-drag-slide';track.appendChild(slide);
   if(index<1||index>pages)continue;
   (async()=>{
    const page=await pdf.getPage(index);if(cancelled)return;
    const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.max(100,root.clientWidth-16)/base.width});
    const ratio=Math.min(window.devicePixelRatio||1,2),canvas=document.createElement('canvas');
    canvas.className='score-pdf-page';canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
    canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
    canvas.setAttribute('aria-label',title+' '+index+'페이지');slide.appendChild(canvas);
    const job=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
    jobs.push(job);await job.promise;
   })().catch(e=>{if(!cancelled&&e?.name!=='RenderingCancelledException')setStatus('error')});
  }
  root.scrollTop=0;
  return()=>{cancelled=true;jobs.forEach(job=>{try{job.cancel()}catch{}})};
 },[current,pages,width,title,full]);
 const goTo=n=>{if(!animationRef.current)setCurrent(p=>Math.max(1,Math.min(pages,typeof n==='function'?n(p):n)))};
 const moveTrack=(dx,animate=false)=>{
  const track=trackRef.current;if(!track)return;
  track.style.transition=animate?'transform 230ms cubic-bezier(.22,.75,.3,1)':'none';
  track.style.transform='translateX(calc(-33.333333% + '+dx+'px))';
 };
 const onTouchStart=e=>{
  if(e.touches.length!==1||animationRef.current)return;
  const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY,axis:null,time:Date.now()};
 };
 const onTouchMove=e=>{
  const g=touchStart.current;if(!g||e.touches.length!==1)return;
  const t=e.touches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
  if(!g.axis&&Math.max(Math.abs(dx),Math.abs(dy))>7)g.axis=Math.abs(dx)>Math.abs(dy)*1.15?'x':'y';
  if(g.axis!=='x')return;
  if(e.cancelable)e.preventDefault();
  moveTrack((dx>0&&current===1)||(dx<0&&current===pages)?dx*.2:dx);
 };
 const onTouchEnd=e=>{
  const g=touchStart.current;touchStart.current=null;
  if(!g||g.axis!=='x'||!pages)return;
  const dx=e.changedTouches[0].clientX-g.x,elapsed=Math.max(1,Date.now()-g.time);
  const threshold=Math.min(100,Math.max(45,(host.current?.clientWidth||320)*.23));
  const direction=Math.abs(dx)>threshold||(Math.abs(dx)>25&&elapsed<220)?(dx<0?1:-1):0;
  const target=Math.max(1,Math.min(pages,current+direction));
  animationRef.current=true;
  moveTrack(target===current?0:target>current?-(host.current?.clientWidth||0):(host.current?.clientWidth||0),true);
  const track=trackRef.current;
  let finished=false;let fallback;
  const done=()=>{if(finished)return;finished=true;track?.removeEventListener('transitionend',done);clearTimeout(fallback);animationRef.current=false;if(target!==current)setCurrent(target);else moveTrack(0)};
  track?.addEventListener('transitionend',done,{once:true});fallback=setTimeout(done,330);
 };
 const onTouchCancel=()=>{touchStart.current=null;moveTrack(0,true)};
 return <div className={'score-pdf-viewer score-pdf-paged'+(full?' score-pdf-full':'')}>
  {status==='loading'&&<p className="score-pdf-status">악보를 불러오는 중입니다…</p>}
  {status==='error'&&<p className="score-pdf-status">악보를 표시하지 못했습니다. <a href={url} target="_blank" rel="noopener noreferrer">PDF 파일 열기</a></p>}
  {pages>1&&<div className="score-pdf-navigation"><button type="button" onClick={()=>goTo(p=>p-1)} disabled={current<=1} aria-label="이전 악보 페이지">‹</button><span>{current} / {pages} 페이지</span><button type="button" onClick={()=>goTo(p=>p+1)} disabled={current>=pages} aria-label="다음 악보 페이지">›</button></div>}
  <div className="score-pdf-single-page" ref={host} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel} onKeyDown={e=>{if(e.key==='ArrowLeft')goTo(p=>p-1);if(e.key==='ArrowRight')goTo(p=>p+1)}} tabIndex={0} role="region" aria-label={title+' PDF 악보, 좌우로 페이지 넘기기'}><div className="score-pdf-drag-track" ref={trackRef}/></div>
 </div>;
}
