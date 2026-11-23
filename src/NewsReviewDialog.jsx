import React, { useLayoutEffect, useRef, useState } from 'react';

export default function NewsReviewDialog({ review, publishing, onConfirm, onCancel, onRetry }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const [edits, setEdits] = useState({});
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    cancelRef.current.autofocus = true;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const beforeParts = review.payload.news.split(/(\r\n|\r|\n)/);
  const result = review.result;
  const afterParts = result?.news.split(/(\r\n|\r|\n)/) ?? [];
  const changes = afterParts
    .filter((_, index) => index % 2 === 0)
    .map((after, index) => ({ index, before: beforeParts[index * 2] ?? '', after }))
    .filter(change => change.before !== change.after);

  const setEdit = (index, text) => setEdits(current => ({ ...current, [index]: text }));
  const confirmedNews = changes.length
    ? afterParts.map((part, index) => index % 2 ? part : (edits[index / 2] ?? part)).join('')
    : (edits[0] ?? result?.news ?? '');
  const newsChanged = confirmedNews !== review.originalNews;

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
        {result && (changes.length ? <ul className="admin-news-review-changes">
          {changes.map(change => <li key={change.index}>
            <div>
              <strong>교정 전</strong>
              <p>{change.before || '빈 줄'}</p>
            </div>
            <div className="admin-news-review-after">
              <label>
                교정 후
                <textarea
                  aria-label={`교정 후 ${change.index + 1}번째 줄`}
                  rows={3}
                  value={edits[change.index] ?? change.after}
                  onChange={event => setEdit(change.index, event.target.value)}
                  disabled={publishing}
                />
              </label>
            </div>
          </li>)}
        </ul> : <div className="admin-news-review-after">
          <label>
            교정 후
            <textarea
              rows={5}
              value={confirmedNews}
              onChange={event => setEdit(0, event.target.value)}
              disabled={publishing}
            />
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
