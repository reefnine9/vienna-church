import React, { useEffect, useRef } from 'react';

export default function NewsReviewDialog({ review, publishing, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const before = review.payload.news.split(/\r\n|\r|\n/);
  const after = review.result.news.split(/\r\n|\r|\n/);
  const changes = Array.from({ length: Math.max(before.length, after.length) }, (_, i) => ({
    line: i + 1,
    before: before[i] ?? '',
    after: after[i] ?? '',
  })).filter(change => change.before !== change.after);

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
        {review.result.newsNeedsReview &&
          <p className="admin-news-review-notice">자동으로 판단하기 어려운 문장이 있습니다. 본문을 확인해 주세요.</p>}
        {changes.length ? <ul className="admin-news-review-changes">
          {changes.map(change => <li key={change.line}>
            <div>
              <strong>교정 전</strong>
              <p>{change.before || '빈 줄'}</p>
            </div>
            <div className="admin-news-review-after">
              <strong>교정 후</strong>
              <p>{change.after || '빈 줄'}</p>
            </div>
          </li>)}
        </ul> : <p>교회 소식에서 수정한 부분이 없습니다.</p>}
      </div>

      {review.error && <p className="admin-news-review-error" role="alert">{review.error}</p>}
      <footer className="admin-news-review-actions">
        <button type="button" className="admin-reset" onClick={onCancel} disabled={publishing}>취소</button>
        <button type="button" className="admin-save" onClick={onConfirm} disabled={publishing}>
          {publishing ? '게시 중…' : '확인'}
        </button>
      </footer>
    </div>
  </dialog>;
}
