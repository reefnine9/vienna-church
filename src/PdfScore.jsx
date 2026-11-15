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
 const host=useRef(null),pdfRef=useRef(null),touchStart=useRef(null);
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
  const pdf=pdfRef.current,root=host.current;
  if(!pdf||!root||!width)return;
  let cancelled=false,job;
  root.replaceChildren();
  (async()=>{
   const page=await pdf.getPage(current);if(cancelled)return;
   const base=page.getViewport({scale:1});
   const maxWidth=Math.max(100,root.clientWidth-16);
   const maxHeight=Math.max(160,root.clientHeight-16);
   const scale=Math.min(maxWidth/base.width,maxHeight/base.height);
   const viewport=page.getViewport({scale});
   const ratio=Math.min(window.devicePixelRatio||1,2);
   const canvas=document.createElement('canvas');
   canvas.className='score-pdf-page';
   canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
   canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
   canvas.setAttribute('aria-label',title+' '+current+'페이지');
   root.appendChild(canvas);
   job=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
   await job.promise;
  })().catch(e=>{if(!cancelled&&e?.name!=='RenderingCancelledException')setStatus('error')});
  return()=>{cancelled=true;if(job)try{job.cancel()}catch{}};
 },[current,pages,width,title,full]);
 const goTo=n=>setCurrent(p=>Math.max(1,Math.min(pages,typeof n==='function'?n(p):n)));
 const onTouchStart=e=>{const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY}};
 const onTouchEnd=e=>{
  const start=touchStart.current;touchStart.current=null;
  if(!start||!pages)return;
  const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
  if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.2)goTo(p=>p+(dx<0?1:-1));
 };
 return <div className={'score-pdf-viewer score-pdf-paged'+(full?' score-pdf-full':'')}>
  {status==='loading'&&<p className="score-pdf-status">악보를 불러오는 중입니다…</p>}
  {status==='error'&&<p className="score-pdf-status">악보를 표시하지 못했습니다. <a href={url} target="_blank" rel="noopener noreferrer">PDF 파일 열기</a></p>}
  {pages>1&&<div className="score-pdf-navigation"><button type="button" onClick={()=>goTo(p=>p-1)} disabled={current<=1} aria-label="이전 악보 페이지">‹</button><span>{current} / {pages} 페이지</span><button type="button" onClick={()=>goTo(p=>p+1)} disabled={current>=pages} aria-label="다음 악보 페이지">›</button></div>}
  <div className="score-pdf-single-page" ref={host} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onKeyDown={e=>{if(e.key==='ArrowLeft')goTo(p=>p-1);if(e.key==='ArrowRight')goTo(p=>p+1)}} tabIndex={0} role="region" aria-label={title+' PDF 악보, 좌우로 페이지 넘기기'}/>
 </div>;
}
