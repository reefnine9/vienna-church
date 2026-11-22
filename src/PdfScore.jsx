import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronLeft,ChevronRight,Eraser} from 'lucide-react';

const PDFJS_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const FIT_SCORE = { scale: 1, x: 0, y: 0 };
const MAX_SCORE_ZOOM = 4;
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
function createScoreDocument(url) {
 let promise, task;

 function destroy() {
  const loadingTask = task;
  promise = task = null;
  loadingTask?.destroy().catch(() => {});
 }

 function load() {
  if (promise) return promise;
  const attempt = loadPdfJs().then(lib => {
   if (promise !== attempt) throw new Error('Score loading cancelled');
   lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
   task = lib.getDocument({ url, withCredentials: false });
   return task.promise;
  }).catch(error => {
   if (promise === attempt) destroy();
   throw error;
  });
  promise = attempt;
  return promise;
 }

 return { load, destroy };
}

export function usePreloadedScore(url) {
 const source = useMemo(() => url ? createScoreDocument(url) : null, [url]);
 useEffect(() => {
  if (!source) return;
  // Download the entire file once so previews and full-screen views can share it.
  source.load().then(pdf => pdf.getData()).catch(() => {});
  return source.destroy;
 }, [source]);
 return source;
}

function scoreTouchPoint(touches) {
  const first = touches[0];
  const second = touches[1];
  if (!second) return { x: first.clientX, y: first.clientY, distance: null };
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
    distance: Math.max(1, Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)),
  };
}

export default function PdfScore({
 url, title = '악보', full = false, pinchZoom = false, source, onDocumentLoad,
 startAtLastPage = false, onPreviousScore, onNextScore,
}) {
 const host=useRef(null),pdfRef=useRef(null),touchStart=useRef(null),trackRef=useRef(null),animationRef=useRef(null);
 const renderedPages=useRef(new Map()),visiblePage=useRef(1),pendingPage=useRef(null);
 const zoomView = useRef(FIT_SCORE);
 const zoomGesture = useRef(null);
 const [status,setStatus]=useState('loading'),[pages,setPages]=useState(0),[current,setCurrent]=useState(1);
 const [width,setWidth]=useState(0),[viewHeight,setViewHeight]=useState(0),[tool,setTool]=useState('move'),[ink,setInk]=useState('#e5484d'),[revision,setRevision]=useState(0);
 const [renderAttempt,setRenderAttempt]=useState(0);
 const drawings=useRef({}),activeStroke=useRef(null),storageKey='vienna-church:pdf-markings:v1:'+encodeURIComponent(url);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');drawings.current=saved&&typeof saved==='object'?saved:{}}catch{drawings.current={}}setRevision(v=>v+1)},[storageKey]);
 const saveDrawings=()=>{try{localStorage.setItem(storageKey,JSON.stringify(drawings.current))}catch{}setRevision(v=>v+1)};
 const undo=()=>{const list=drawings.current[current]||[];if(!list.length)return;drawings.current[current]=list.slice(0,-1);saveDrawings()};
 const clearPage=()=>{if(!window.confirm('현재 페이지의 개인 마킹을 모두 지울까요?'))return;drawings.current[current]=[];saveDrawings()};
 const pointFor=(e,svg)=>{const r=svg.getBoundingClientRect();return [Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000)),Math.max(0,Math.min(1000,(e.clientY-r.top)/r.height*1000))]};
 const eraseAt=(e,svg,index)=>{const p=pointFor(e,svg),list=drawings.current[index]||[];const next=list.filter(stroke=>!stroke.points?.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<22));if(next.length!==list.length){drawings.current[index]=next;saveDrawings()}};
 const startInk=(e,svg,index)=>{if((tool!=='pen'&&tool!=='eraser')||e.button!==0)return;e.preventDefault();e.stopPropagation();svg.setPointerCapture(e.pointerId);if(tool==='eraser'){activeStroke.current={index,eraser:true};eraseAt(e,svg,index);return}const stroke={color:ink,points:[pointFor(e,svg)]};activeStroke.current={index,stroke};drawings.current[index]=[...(drawings.current[index]||[]),stroke];setRevision(v=>v+1)};
 const moveInk=(e,svg)=>{if(!activeStroke.current)return;e.preventDefault();if(activeStroke.current.eraser){eraseAt(e,svg,activeStroke.current.index);return}activeStroke.current.stroke.points.push(pointFor(e,svg));setRevision(v=>v+1)};
 const finishInk=()=>{if(!activeStroke.current)return;activeStroke.current=null;saveDrawings()};

 useEffect(() => {
  let cancelled = false;
  const cache = renderedPages.current, track = trackRef.current;
  const documentSource = source || createScoreDocument(url);
  pdfRef.current = null;
  setStatus('loading');
  setPages(0);
  setCurrent(1);
  documentSource.load().then(pdf => {
   if (cancelled) return;
   pdfRef.current = pdf;
   setPages(pdf.numPages);
   setCurrent(startAtLastPage ? pdf.numPages : 1);
   setStatus('ready');
   onDocumentLoad?.(pdf);
  }).catch(() => {
   if (cancelled) return;
   setStatus('error');
   onDocumentLoad?.(null);
  });
  return () => {
   cancelled = true;
   pdfRef.current = null;
   pendingPage.current = null;
   touchStart.current = null;
   animationRef.current?.();
   for (const entry of cache.values()) entry.cancel?.();
   cache.clear();
   track?.replaceChildren();
   if (!source) documentSource.destroy();
  };
 }, [url, source, startAtLastPage, onDocumentLoad]);

 useEffect(() => {
  if (full) host.current.focus({ preventScroll: true });
 }, [full]);

 useEffect(()=>{
  const el=host.current;if(!el)return;
  const resize=()=>{setWidth(el.clientWidth);setViewHeight(el.clientHeight)};
  resize();
  if(typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(resize);observer.observe(el);
  return()=>observer.disconnect();
 },[]);

 useLayoutEffect(() => {
  const sheet = renderedPages.current.get(visiblePage.current)?.sheet;
  if (zoomView.current.scale > 1 && sheet) sheet.style.transform = '';
  zoomView.current = FIT_SCORE;
  zoomGesture.current = null;
 }, [current, url, width, viewHeight, pinchZoom]);

 useLayoutEffect(()=>{
  visiblePage.current=current;
  moveTrack(0);
  host.current.scrollTop=0;
 },[current]);

 useLayoutEffect(()=>{
  const pdf=pdfRef.current,track=trackRef.current;
  if(!pdf||!track||!width||!pages||(full&&!viewHeight))return;
  const cache=renderedPages.current;
  for(const [index,entry] of cache){
   if(Math.abs(index-current)<=1)continue;
   entry.cancel?.();entry.slide.remove();cache.delete(index);
  }
  const ratio=Math.min(window.devicePixelRatio||1,2);
  const renderKey=[width,full?viewHeight:0,ratio,title].join('|');
  for(const index of [current,current-1,current+1].filter(index=>index>=1&&index<=pages)){
   let entry=cache.get(index);
   if(!entry){
    const slide=document.createElement('div');slide.className='score-pdf-drag-slide';
    // Keep each page at a fixed position while the track scrolls between pages.
    slide.style.transform=`translateX(${(index-1)*100}%)`;
    const sheet=document.createElement('div');sheet.style.cssText='position:relative;display:inline-block;line-height:0;max-width:100%';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('preserveAspectRatio','none');svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;touch-action:none;pointer-events:none';svg.dataset.markPage=String(index);
    svg.addEventListener('pointerdown',e=>startInkRef.current(e,svg,index));svg.addEventListener('pointermove',e=>moveInkRef.current(e,svg));svg.addEventListener('pointerup',()=>finishInkRef.current());svg.addEventListener('pointercancel',()=>finishInkRef.current());
    sheet.appendChild(svg);slide.appendChild(sheet);track.appendChild(slide);
    entry={slide,sheet,canvas:null,renderKey:null,cancel:null};
    cache.set(index,entry);
   }
   if(entry.renderKey===renderKey)continue;
   entry.cancel?.();entry.renderKey=renderKey;
   let cancelled=false,job;
   entry.cancel=()=>{cancelled=true;job?.cancel()};
   (async()=>{
    const page=await pdf.getPage(index);if(cancelled)return;
    const base=page.getViewport({scale:1}),availableWidth=Math.max(100,width-16),availableHeight=Math.max(100,viewHeight-16),scale=full?Math.min(availableWidth/base.width,availableHeight/base.height):availableWidth/base.width,viewport=page.getViewport({scale});
    const canvas=document.createElement('canvas');
    canvas.className='score-pdf-page';canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
    canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
    canvas.setAttribute('aria-label',title+' '+index+'페이지');
    job=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
    await job.promise;
    if(cancelled)return;
    // Publish only finished canvases, retaining the previous render during resizes.
    if(entry.canvas)entry.canvas.replaceWith(canvas);else entry.sheet.prepend(canvas);
    entry.canvas=canvas;entry.cancel=null;
    if(pendingPage.current===index){pendingPage.current=null;setCurrent(index);setStatus('ready')}
   })().catch(()=>{
    if(cancelled)return;
    entry.cancel=null;entry.renderKey=null;
    if(pendingPage.current===index){pendingPage.current=null;setStatus('error')}
    else if(index===visiblePage.current&&!entry.canvas)setStatus('error');
   });
  }
 },[current,pages,width,viewHeight,title,full,renderAttempt]);
 const startInkRef=useRef(null),moveInkRef=useRef(null),finishInkRef=useRef(null);
 startInkRef.current=startInk;moveInkRef.current=moveInk;finishInkRef.current=finishInk;
 useLayoutEffect(()=>{const track=trackRef.current;if(!track)return;for(const svg of track.querySelectorAll('svg[data-mark-page]')){const index=Number(svg.dataset.markPage);svg.style.pointerEvents=tool==='pen'||tool==='eraser'?'auto':'none';svg.replaceChildren();for(const stroke of drawings.current[index]||[]){if(!Array.isArray(stroke.points)||!stroke.points.length)continue;const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',stroke.points.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join(' ')+(stroke.points.length===1?' l 0.1 0.1':''));path.setAttribute('fill','none');path.setAttribute('stroke',stroke.color||'#e5484d');path.setAttribute('stroke-width','3.5');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.appendChild(path)}}},[revision,current,tool,width,viewHeight,pages]);
 function moveTrack(dx,animate=false,page=current){
  const track=trackRef.current;if(!track)return;
  track.style.transition=animate?'transform 230ms cubic-bezier(.22,.75,.3,1)':'none';
  track.style.transform=`translateX(calc(${(1-page)*100}% + ${dx}px))`;
 }
 function goTo(target,animate=false){
  if (!pages || animationRef.current || target === current) return;
  if (target < 1) {
   onPreviousScore?.();
   return;
  }
  if (target > pages) {
   onNextScore?.();
   return;
  }
  touchStart.current=null;
  const page=renderedPages.current.get(target);
  if(!page?.canvas){
   pendingPage.current=target;
   moveTrack(0,true);
   if(!page?.renderKey)setRenderAttempt(n=>n+1);
   return;
  }
  pendingPage.current=null;
  if(!animate){setCurrent(target);setStatus('ready');return}
  const track=trackRef.current;
  const cleanup=()=>{track.removeEventListener('transitionend',done);clearTimeout(fallback);animationRef.current=null};
  const done=e=>{
   if(e&&(e.target!==track||e.propertyName!=='transform'))return;
   cleanup();setCurrent(target);setStatus('ready');
  };
  const fallback=setTimeout(done,330);
  animationRef.current=cleanup;
  track.addEventListener('transitionend',done);
  moveTrack(0,true,target);
 }

 function beginZoomGesture(touches) {
  const page = renderedPages.current.get(current);
  if (!page?.canvas) return;
  zoomGesture.current = {
   fingers: touches.length,
   start: scoreTouchPoint(touches),
   view: zoomView.current,
   viewport: host.current.getBoundingClientRect(),
   sheet: page.sheet,
   sheetWidth: page.sheet.offsetWidth,
   sheetHeight: page.sheet.offsetHeight,
  };
 }

 function updateZoomGesture(touches) {
  const { start, view, viewport, sheet, sheetWidth, sheetHeight } = zoomGesture.current;
  const point = scoreTouchPoint(touches);
  const scale = start.distance === null
   ? view.scale
   : Math.max(1, Math.min(MAX_SCORE_ZOOM, view.scale * point.distance / start.distance));
  const ratio = scale / view.scale;
  const centerX = viewport.left + viewport.width / 2;
  const centerY = viewport.top + viewport.height / 2;
  const x = point.x - centerX - (start.x - centerX - view.x) * ratio;
  const y = point.y - centerY - (start.y - centerY - view.y) * ratio;
  const limitX = Math.max(0, (sheetWidth * scale - viewport.width) / 2);
  const limitY = Math.max(0, (sheetHeight * scale - viewport.height) / 2);
  zoomView.current = {
   scale,
   x: Math.max(-limitX, Math.min(limitX, x)),
   y: Math.max(-limitY, Math.min(limitY, y)),
  };
  // Keep the PDF and its pen marks registered while scaling the rendered sheet.
  sheet.style.transform = scale === 1 ? '' : `translate(${zoomView.current.x}px, ${zoomView.current.y}px) scale(${scale})`;
 }

 const onTouchStart=e=>{
  if(tool!=='move'||animationRef.current||pendingPage.current!==null)return;
  const fingers = e.touches.length;
  if (pinchZoom && (fingers >= 2 || zoomView.current.scale > 1)) {
   if (touchStart.current?.axis === 'x') moveTrack(0);
   touchStart.current = null;
   zoomGesture.current = null;
   if (fingers <= 2) beginZoomGesture(e.touches);
   return;
  }
  if (fingers !== 1) return;
  const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY,axis:null,time:Date.now()};
 };
 const onTouchMove=e=>{
  if (tool === 'move' && zoomGesture.current) {
   if (e.touches.length === zoomGesture.current.fingers) updateZoomGesture(e.touches);
   return;
  }
  const g=touchStart.current;if(tool!=='move'||!g||e.touches.length!==1)return;
  const t=e.touches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
  if(!g.axis&&Math.max(Math.abs(dx),Math.abs(dy))>7)g.axis=Math.abs(dx)>Math.abs(dy)*1.15?'x':'y';
  if(g.axis!=='x')return;
  if(!pinchZoom&&e.cancelable)e.preventDefault();
  const target=current+(dx<0?1:-1),width=host.current.clientWidth;
  moveTrack(renderedPages.current.get(target)?.canvas?Math.max(-width,Math.min(width,dx)):0);
 };
 const onTouchEnd=e=>{
  if (zoomGesture.current) {
   zoomGesture.current = null;
   if (e.touches.length === 1 && zoomView.current.scale > 1) beginZoomGesture(e.touches);
   return;
  }
  const g=touchStart.current;touchStart.current=null;if(tool!=='move')return;
  if(!g||g.axis!=='x'||!pages)return;
  const dx=e.changedTouches[0].clientX-g.x,elapsed=Math.max(1,Date.now()-g.time);
  const threshold=Math.min(100,Math.max(45,(host.current?.clientWidth||320)*.23));
  const direction=Math.abs(dx)>threshold||(Math.abs(dx)>25&&elapsed<220)?(dx<0?1:-1):0;
  const target = current + direction;
  if (!direction || (target < 1 && !onPreviousScore) || (target > pages && !onNextScore)) {
   moveTrack(0, true);
  } else {
   goTo(target, true);
  }
 };
 const onTouchCancel=()=>{zoomGesture.current=null;touchStart.current=null;moveTrack(0,true)};
 return <div className={'score-pdf-viewer score-pdf-paged'+(full?' score-pdf-full':'')}>
  {status==='loading'&&<p className="score-pdf-status">악보를 불러오는 중입니다…</p>}
  {status==='error'&&<p className="score-pdf-status">악보를 표시하지 못했습니다. <a href={url} target="_blank" rel="noopener noreferrer">PDF 파일 열기</a></p>}
  {status==='ready'&&(()=>{const controls=<div className="score-mark-toolbar"><button type="button" title="이동 및 페이지 넘기기" aria-label="이동" aria-pressed={tool==='move'} onClick={()=>setTool('move')}>↔</button><button type="button" title="빨간펜" aria-label="빨간펜" aria-pressed={tool==='pen'} onClick={()=>{setInk('#e5484d');setTool('pen')}} style={{color:'#e5484d'}}>✎</button><button type="button" title="지우개" aria-label="지우개" aria-pressed={tool==='eraser'} onClick={()=>setTool('eraser')}><Eraser size={18} strokeWidth={2}/></button></div>;const slot=full?document.getElementById('score-mark-toolbar-slot'):null;return slot?createPortal(controls,slot):controls})()}
  {pages>0&&(pages>1||onPreviousScore||onNextScore)&&(()=>{const navigation=<div className="score-pdf-navigation"><button type="button" onClick={()=>goTo(current-1)} disabled={current<=1&&!onPreviousScore} aria-label="이전 악보 페이지"><ChevronLeft size={17} strokeWidth={2}/></button><span>{current} / {pages} 페이지</span><button type="button" onClick={()=>goTo(current+1)} disabled={current>=pages&&!onNextScore} aria-label="다음 악보 페이지"><ChevronRight size={17} strokeWidth={2}/></button></div>;const slot=full?document.getElementById("score-page-navigation-slot"):null;return slot?createPortal(navigation,slot):navigation})()}
  <div className={'score-pdf-single-page'+(pinchZoom?' score-pdf-zoomable':'')} ref={host} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel} onKeyDown={e=>{if(e.key==='ArrowLeft')goTo(current-1);if(e.key==='ArrowRight')goTo(current+1)}} tabIndex={0} role="region" aria-label={title+(pinchZoom?' PDF 악보, 두 손가락으로 확대·축소, 좌우로 페이지 넘기기':' PDF 악보, 좌우로 페이지 넘기기')}><div className="score-pdf-drag-track" ref={trackRef}/></div>
 </div>;
}
