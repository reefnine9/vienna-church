import React, { useLayoutEffect, useRef, useState } from 'react';

const newsSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('ko', { granularity: 'sentence' })
  : null;

// Retain positions in the complete bulletin text so an editor's changes
// can be applied without replacing unchanged sentences or their line breaks.
function splitChurchNewsSentences(news) {
  const found = [];
  const lines = String(news || '').matchAll(/[^\r\n]+/g);
  let lineNumber = 0;
  for (const lineMatch of lines) {
    const line = lineMatch[0];
    const prefix = line.match(/^\s*(?:\d+[.)]|[-*•])\s+/)?.[0] || '';
    const rest = line.slice(prefix.length);
    const fragments = newsSegmenter
      ? Array.from(newsSegmenter.segment(rest), part => ({ text: part.segment, start: part.index }))
      : Array.from(rest.matchAll(/[^.!?。！？]+(?:[.!?。！？]+|$)/g), part => ({ text: part[0], start: part.index }));
    fragments.forEach((part, index) => {
      const originalStart = lineMatch.index + prefix.length + part.start;
      const raw = index === 0 ? prefix + part.text : part.text;
      const spanStart = index === 0 ? lineMatch.index : originalStart;
      const lead = raw.length - raw.trimStart().length;
      const trailing = raw.length - raw.trimEnd().length;
      const text = raw.slice(lead, raw.length - trailing);
      if (text) found.push({ text, start: spanStart + lead, end: spanStart + raw.length - trailing, line: lineNumber });
    });
    lineNumber++;
  }
  return found;
}

function churchNewsSentenceKey(text) {
  return text.trim().replace(/^(?:\d+[.)]|[-*•])\s+/, '').replace(/\s+/g, '').replace(/[.!?。！？]+$/, '');
}

// Compare the saved church news with what the editor typed, NOT with the
// grammar service's output. This prevents spelling fixes from appearing as
// deleted and newly added announcements.
function diffChurchNewsSentences(oldItems, newItems) {
  const oldKeys = oldItems.map(item => churchNewsSentenceKey(item.text));
  const newKeys = newItems.map(item => churchNewsSentenceKey(item.text));
  const rows = oldKeys.length, cols = newKeys.length;
  const lcs = Array.from({ length: rows + 1 }, () => new Uint16Array(cols + 1));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lcs[i][j] = oldKeys[i] === newKeys[j] ? 1 + lcs[i + 1][j + 1] : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const added = [], removed = [], matched = [];
  let i = 0, j = 0;
  while (i < rows || j < cols) {
    if (i < rows && j < cols && oldKeys[i] === newKeys[j]) {
      matched.push({ oldIndex: i, newIndex: j });
      i++; j++;
    } else if (i < rows && (j === cols || lcs[i + 1][j] >= lcs[i][j + 1])) {
      removed.push(oldItems[i++]);
    } else {
      added.push({ ...newItems[j], index: j });
      j++;
    }
  }
  return { added, removed, matched };
}

function applyChurchNewsEdits(news, segments, edits) {
  const replacements = Object.entries(edits).map(([index, value]) => ({ index: Number(index), value }))
    .filter(item => Number.isInteger(item.index) && segments[item.index])
    .sort((a, b) => segments[b.index].start - segments[a.index].start);
  return replacements.reduce((text, entry) => {
    const span = segments[entry.index];
    return text.slice(0, span.start) + entry.value + text.slice(span.end);
  }, news);
}

export default function NewsReviewDialog({ review, publishing, onConfirm, onCancel, onRetry }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const [edits, setEdits] = useState({});
  const [fullEdit, setFullEdit] = useState(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    cancelRef.current.autofocus = true;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const result = review.result;
  const originalSentences = splitChurchNewsSentences(review.originalNews || '');
  const typedSentences = splitChurchNewsSentences(review.payload.news);
  const finalizedSentences = splitChurchNewsSentences(result?.news || '');
  const diff = diffChurchNewsSentences(originalSentences, typedSentences);
  const addedIndexes = new Set(diff.added.map(item => item.index));
  const aligned = !!result && typedSentences.length === finalizedSentences.length
    && typedSentences.every((item, index) => item.line === finalizedSentences[index].line);
  const manuallyEdited = new Map(diff.matched
    .filter(pair => originalSentences[pair.oldIndex].text !== typedSentences[pair.newIndex].text)
    .map(pair => [pair.newIndex, originalSentences[pair.oldIndex].text]));
  const corrections = aligned ? finalizedSentences.flatMap((sentence, index) => {
    if (addedIndexes.has(index)) return [];
    const before = manuallyEdited.get(index) ?? typedSentences[index].text;
    return before !== sentence.text ? [{ index, before, after: sentence.text }] : [];
  }) : [];

  const setEdit = (index, text) => setEdits(current => ({ ...current, [index]: text }));
  const composedNews = result && aligned
    ? applyChurchNewsEdits(result.news, finalizedSentences, edits)
    : result?.news || '';
  const confirmedNews = fullEdit ?? composedNews;
  const newsChanged = !!result && confirmedNews !== (review.originalNews || '');
  const needsFullCorrection = !!result && !aligned && review.payload.news !== result.news;
  const startFullEditing = () => setFullEdit(confirmedNews);

  return <dialog
    className="admin-news-review"
    ref={dialogRef}
    aria-labelledby="news-review-title"
    onCancel={event => {
      event.preventDefault();
      if (!publishing) onCancel();
    }}
  >
    <div className="admin-news-review-layout">
      <header className="admin-news-review-header">
        <h2 id="news-review-title">교회 소식 교정 확인</h2>
        <p><time dateTime={review.payload.date}>{review.payload.date}</time> 주보</p>
      </header>

      <div className="admin-news-review-content">
        {!result && !review.error &&
          <p role="status">{review.payload.news.trim() ? '교회 소식의 변경 사항을 확인하고 있습니다.' : '주보를 확인하고 있습니다.'}</p>}
        {result?.newsNeedsReview &&
          <p className="admin-news-review-notice">자동으로 판단하기 어려운 문장이 있습니다. 본문을 확인해 주세요.</p>}
        {result && <p className="admin-news-review-summary" role="status">
          {newsChanged ? '교회 소식에 변경 사항이 있습니다.' : '교회 소식에 변경 사항이 없습니다.'}
        </p>}

        {result && (diff.added.length > 0 || diff.removed.length > 0) &&
          <div className="admin-news-review-events">
            {diff.removed.map((item, index) => <div className="admin-news-review-event" key={'removed-' + index}>
              <strong className="admin-news-review-event-label">삭제되었습니다.</strong>
              <p>{item.text}</p>
            </div>)}
            {diff.added.map(item => <div className="admin-news-review-event" key={'added-' + item.index}>
              <strong className="admin-news-review-event-label">추가됨</strong>
              {aligned ? <textarea
                aria-label={'추가된 문장 ' + (item.index + 1)}
                rows={2}
                value={edits[item.index] ?? finalizedSentences[item.index].text}
                onChange={event => setEdit(item.index, event.target.value)}
                disabled={publishing || fullEdit !== null}
              /> : <p>{item.text}</p>}
            </div>)}
          </div>}

        {result && corrections.length > 0 && <ul className="admin-news-review-changes">
          {corrections.map(change => <li key={change.index}>
            <div>
              <strong>교정 전</strong>
              <p>{change.before}</p>
            </div>
            <div className="admin-news-review-after">
              <label>
                교정 후
                <textarea
                  aria-label={'교정 후 ' + (change.index + 1) + '번째 문장'}
                  rows={3}
                  value={edits[change.index] ?? change.after}
                  onChange={event => setEdit(change.index, event.target.value)}
                  disabled={publishing || fullEdit !== null}
                />
              </label>
            </div>
          </li>)}
        </ul>}

        {needsFullCorrection && <div className="admin-news-review-fallback">
          <p>문장 구성이 달라진 교정 결과입니다. 최종 문장을 확인해 주세요.</p>
          <label>교정 후
            <textarea rows={6} value={fullEdit ?? result.news} onChange={event => setFullEdit(event.target.value)} disabled={publishing} />
          </label>
        </div>}

        {result && !needsFullCorrection && (fullEdit === null
          ? <button type="button" className="admin-news-review-edit-all" onClick={startFullEditing} disabled={publishing}>
              전체 본문 직접 수정
            </button>
          : <div className="admin-news-review-fallback">
              <label>최종 게시 내용
                <textarea rows={6} value={fullEdit} onChange={event => setFullEdit(event.target.value)} disabled={publishing} />
              </label>
            </div>)}
      </div>

      {review.error && <p className="admin-news-review-error" role="alert">{review.error}</p>}
      <footer className="admin-news-review-actions">
        <button type="button" className="admin-reset" ref={cancelRef} onClick={onCancel} disabled={publishing}>취소</button>
        {!result && review.error ?
          <button type="button" className="admin-save" onClick={onRetry}>다시 시도</button> :
          <button type="button" className="admin-save" onClick={() => onConfirm(confirmedNews)} disabled={publishing || !result}>
            {publishing ? '게시 중…' : '확인'}
          </button>}
      </footer>
    </div>
  </dialog>;
}
