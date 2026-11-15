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
 const host=useRef(null);const scroller=useRef(null);const [current,setCurrent]=useState(1);
 const [status,setStatus]=useState('loading');
 const [pages,setPages]=useState(0);
 useEffect(()=>{
  if(!url)return;
  let cancelled=false;let task;let pdf;const renders=[];
  const render=async()=>{
   setStatus('loading');setPages(0);setCurrent(1);
   const lib=await loadPdfJs();lib.GlobalWorkerOptions.workerSrc=WORKER_URL;
   task=lib.getDocument({url,withCredentials:false});pdf=await task.promise;
   if(cancelled)return;
   const root=host.current;if(!root)return;root.replaceChildren();
   setPages(pdf.numPages);
   for(let n=1;n<=pdf.numPages;n++){
    if(cancelled)break;
    const page=await pdf.getPage(n);if(cancelled)break;
    const available=Math.max(280,root.clientWidth-12);
    const initial=page.getViewport({scale:1});
    const scale=available/initial.width;
    const viewport=page.getViewport({scale});
    const ratio=Math.min(window.devicePixelRatio||1,2);
    const canvas=document.createElement('canvas');
    canvas.className='score-pdf-page';
    canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
    canvas.style.width='100%';canvas.style.height='auto';
    canvas.setAttribute('aria-label',title+' '+n+'페이지');
    const slide=document.createElement('div');slide.className='score-pdf-slide';slide.appendChild(canvas);root.appendChild(slide);
    const ctx=canvas.getContext('2d',{alpha:false});
    const job=page.render({canvasContext:ctx,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
    renders.push(job);await job.promise;
   }
   if(!cancelled)setStatus('ready');
  };
  render().catch(e=>{if(!cancelled&&e?.name!=='RenderingCancelledException')setStatus('error')});
  return()=>{cancelled=true;renders.forEach(job=>{try{job.cancel()}catch{}});if(task)try{task.destroy()}catch{};if(pdf)try{pdf.destroy()}catch{};};
 },[url,title,full]);
 const goTo=n=>{const next=Math.max(1,Math.min(pages,n));const el=scroller.current;if(!el)return;el.scrollTo({left:(next-1)*el.clientWidth,behavior:'smooth'});setCurrent(next)};
 const onScroll=()=>{const el=scroller.current;if(!el||!el.clientWidth)return;setCurrent(Math.max(1,Math.min(pages,Math.round(el.scrollLeft/el.clientWidth)+1)))};
 return <div className={'score-pdf-viewer'+(full?' score-pdf-full':'')}>
  {status==='loading'&&<p className="score-pdf-status">악보를 불러오는 중입니다… {pages? '('+pages+'페이지)':''}</p>}
  {status==='error'&&<p className="score-pdf-status">악보를 표시하지 못했습니다. <a href={url} target="_blank" rel="noopener noreferrer">PDF 파일 열기</a></p>}
  {pages>1&&<div className="score-pdf-navigation"><button type="button" onClick={()=>goTo(current-1)} disabled={current<=1} aria-label="이전 악보 페이지">‹</button><span>{current} / {pages} 페이지</span><button type="button" onClick={()=>goTo(current+1)} disabled={current>=pages} aria-label="다음 악보 페이지">›</button></div>}
  <div className="score-pdf-scroll" ref={scroller} onScroll={onScroll}><div className="score-pdf-pages" ref={host}/></div>
 </div>;
}
