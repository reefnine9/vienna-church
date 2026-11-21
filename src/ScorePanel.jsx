import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import PdfScore from './PdfScore.jsx';

function pdfCanShare(file) {
  return typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] });
}

function fallbackLink(url, fileName, loadFailed) {
  let source;
  try {
    source = new URL(url, location.href);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(source.protocol)) return null;

  const sameOrigin = source.origin === location.origin;
  const driveId = sameOrigin && source.pathname.match(/^\/api\/scores\/(?:drive|google)\/([\w-]+)\.pdf$/)?.[1];
  if (loadFailed && driveId) {
    return { href: `https://drive.google.com/file/d/${driveId}/view`, target: '_blank', label: 'Google Drive에서 열기' };
  }
  return sameOrigin
    ? { href: source.href, download: fileName, label: 'PDF 다운로드' }
    : { href: source.href, target: '_blank', label: 'PDF 파일 열기' };
}

export default function ScorePanel({ url, title, onExpand, onClose }) {
  const fileName = `${title} 악보.pdf`;
  const [pdf, setPdf] = useState();
  const [file, setFile] = useState(null);
  const [shareUnavailable, setShareUnavailable] = useState(() =>
    typeof File !== 'function' || !pdfCanShare(new File([], fileName, { type: 'application/pdf' }))
  );

  useEffect(() => {
    if (!pdf || shareUnavailable) return;
    let active = true;
    pdf.getData().then(bytes => {
      if (!active) return;
      const readyFile = new File([bytes], fileName, { type: 'application/pdf' });
      if (pdfCanShare(readyFile)) setFile(readyFile);
      else setShareUnavailable(true);
    }).catch(() => {
      if (active) setShareUnavailable(true);
    });
    return () => { active = false; };
  }, [pdf, fileName, shareUnavailable]);

  async function openInApp() {
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (error.name !== 'AbortError') setShareUnavailable(true);
    }
  }

  const useFallback = shareUnavailable || pdf === null;
  const link = useFallback ? fallbackLink(url, fileName, pdf === null) : null;
  return <div className="praise-score-inline">
    <div className="praise-score-inline-actions">
      <div className="praise-score-open-actions">
        {!useFallback && <button type="button" className="praise-score-open" disabled={!file} aria-busy={!file} onClick={openInApp}>
          {file ? '앱열기' : 'PDF 준비 중…'} <FileText size={15}/>
        </button>}
        {link && <a className="praise-score-open" href={link.href} download={link.download} target={link.target} rel={link.target ? 'noopener noreferrer' : undefined}>
          {link.label} {link.download ? <Download size={15}/> : <ExternalLink size={15}/>}
        </a>}
        <button type="button" className="praise-score-open" onClick={onExpand}>크게 <ExternalLink size={15}/></button>
      </div>
      <button type="button" className="praise-score-close" onClick={onClose} aria-label="악보 접기">닫기 <X size={15}/></button>
    </div>
    <PdfScore url={url} title={title} onDocumentLoad={setPdf}/>
  </div>;
}
