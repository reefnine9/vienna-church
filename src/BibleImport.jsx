import React,{useState,useEffect} from 'react';
const books='창 출 레 민 신 수 삿 룻 삼상 삼하 왕상 왕하 대상 대하 스 느 에 욥 시 잠 전 아 사 렘 애 겔 단 호 욜 암 옵 욘 미 나 합 습 학 슥 말 마 막 눅 요 행 롬 고전 고후 갈 엡 빌 골 살전 살후 딤전 딤후 딛 몬 히 약 벧전 벧후 요일 요이 요삼 유 계'.split(' ');
const bookSet=new Set(books);
function parse(text){
 const rows=[],invalid=[],keys=new Set();
 text.replace(/^\uFEFF/,'').split(/\r?\n/).forEach((raw,i)=>{
  if(!raw.trim())return;
  const m=raw.match(/^([^\s\d:]+)(\d+):(\d+)\s+(.+)$/);
  if(!m||!bookSet.has(m[1])||!Number(m[2])||!Number(m[3])){invalid.push({line:i+1,text:raw.slice(0,120)});return}
  const v={book:m[1],chapter:Number(m[2]),verse:Number(m[3]),text:m[4].trim()};
  const key=v.book+':'+v.chapter+':'+v.verse;
  if(keys.has(key)||v.chapter>150||v.verse>200||v.text.length>2000){invalid.push({line:i+1,text:raw.slice(0,120)});return}
  keys.add(key);rows.push(v);
 });
 return {rows,invalid};
}
export default function BibleImport(){
 const [data,setData]=useState(null),[fileName,setFileName]=useState(''),[progress,setProgress]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[count,setCount]=useState(null);
 const [confirmed,setConfirmed]=useState(false);
 async function refresh(){try{const r=await fetch('/api/admin/bible-import',{credentials:'same-origin'});if(r.ok){const x=await r.json();setCount(x.count)}}catch{}}
 useEffect(()=>{refresh()},[]);
 async function choose(file){setData(null);setError('');setProgress(0);setConfirmed(false);if(!file)return;if(file.size>12*1024*1024){setError('12MB 이하 TXT 파일을 선택하세요.');return}try{const buffer=await file.arrayBuffer();const decoded=new TextDecoder('utf-8',{fatal:true}).decode(buffer);const parsed=parse(decoded);setData(parsed);setFileName(file.name);if(!parsed.rows.length)setError('인식된 성경 구절이 없습니다. UTF-8 TXT 파일인지 확인하세요.')}catch{setError('UTF-8로 저장된 TXT 파일을 선택하세요.')}} 
 async function upload(){if(!data?.rows.length||busy||!confirmed)return;setBusy(true);setError('');let done=0;try{for(let i=0;i<data.rows.length;i+=80){const chunk=data.rows.slice(i,i+80);let success=false;for(let attempt=0;attempt<3;attempt++){try{const r=await fetch('/api/admin/bible-import',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({verses:chunk})});const x=await r.json();if(!r.ok)throw Error(x.error||'등록 실패');success=true;break}catch(e){if(attempt===2)throw Error((i+1)+'번째 구절부터 저장 실패: '+e.message)}}if(!success)throw Error('저장 실패');done+=chunk.length;setProgress(done)}await refresh()}catch(e){setError(e.message||'업로드 실패. 다시 실행하면 저장된 구절은 갱신됩니다.')}finally{setBusy(false)}}
 return <section className="admin-panel"><h1>성경 데이터 관리</h1><p className="admin-help">개역개정 성경 전체를 D1에 저장합니다. 성경 본문은 GitHub 공개 저장소에 업로드되지 않습니다. 웹사이트 제공에 필요한 이용 허가가 있는 파일만 등록하세요.</p><p><strong>현재 D1 등록 구절: {count===null?'확인 중':count.toLocaleString('ko-KR')}절</strong></p><label>UTF-8 성경 TXT 파일 선택<input type="file" accept=".txt,text/plain" disabled={busy} onChange={e=>choose(e.target.files?.[0])}/></label>{data&&<><p>{fileName} · 인식 {data.rows.length.toLocaleString('ko-KR')}절 · 확인 필요 {data.invalid.length}줄</p>{data.invalid.length>0&&<details><summary>인식하지 못한 줄 보기 (처음 30줄)</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{data.invalid.slice(0,30).map(x=>x.line+': '+x.text).join('\n')}</pre></details>}<label style={{display:'flex',alignItems:'center',gap:8,margin:'16px 0'}}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>성경 본문 저장 및 웹사이트 제공에 필요한 이용 허가를 확인했습니다.</label><button type="button" className="admin-save" disabled={busy||!confirmed||!data.rows.length} onClick={upload}>{busy?'등록 중...':'D1에 일괄 등록'}</button><p role="status">진행: {progress.toLocaleString('ko-KR')} / {data.rows.length.toLocaleString('ko-KR')}절 ({Math.round(progress/data.rows.length*100)}%)</p><progress max={data.rows.length} value={progress} style={{width:'100%'}}/></>}{error&&<p role="alert">{error}</p>}<p className="admin-help">기존에 저장된 동일 장·절은 새 파일의 내용으로 갱신됩니다. 업로드 도중 중단되면 같은 파일을 다시 선택하여 재실행할 수 있습니다. 누락되거나 잘못된 줄은 별도로 확인하세요.</p></section>
}
