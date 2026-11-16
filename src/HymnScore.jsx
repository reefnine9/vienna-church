import React,{useEffect,useState} from 'react';
import {ExternalLink,X} from 'lucide-react';
import PdfScore from './PdfScore.jsx';
export default function HymnScore({number,onClose,onFullscreen}){
 const [status,setStatus]=useState('loading'),[url,setUrl]=useState('');
 useEffect(()=>{let live=true;setStatus('loading');setUrl('');fetch('/api/hymns/'+number,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('lookup failed');return r.json()}).then(x=>{if(live){setUrl(x.url||'');setStatus(x.exists&&x.url?'ready':'missing')}}).catch(()=>{if(live)setStatus('error')});return()=>{live=false}},[number]);
 return <div className="praise-score-inline"><div className="praise-score-inline-actions">{status==='ready'&&<button type="button" className="praise-score-open" onClick={()=>onFullscreen(url)}>화면 크게 보기 <ExternalLink size={15}/></button>}<button type="button" className="praise-score-close" onClick={onClose}>닫기 <X size={15}/></button></div>{status==='ready'?<PdfScore url={url} title={'새찬송가 '+number+'장'}/>:<p>{status==='loading'?'악보 확인 중...':status==='missing'?'이 찬송가 악보는 아직 등록되지 않았습니다. 관리자 화면에서 Google Drive PDF 링크를 등록해 주세요.':'악보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'}</p>}</div>;
}