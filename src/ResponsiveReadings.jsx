import React, { useState, useEffect } from 'react';

const roles = [
  { value: 'leader', label: '인도자' },
  { value: 'congregation', label: '회중' },
  { value: 'all', label: '다같이' },
];
const clone = verses => (verses || []).map(row => ({ role: row.role, text: row.text }));
const isNumber = value => /^[1-9]\d{0,2}$/.test(value) && Number(value) <= 200;
const errorText = value => ({
  base_reading_unavailable: '기본 교독문을 불러오지 못했습니다. 다시 시도해 주세요.',
  invalid_data: '각 줄의 본문을 입력하고 인도자·회중 구분을 확인해 주세요.',
  database_error: '데이터베이스 오류가 발생했습니다.',
})[value] || '처리하지 못했습니다. 다시 시도해 주세요.';

export default function ResponsiveReadings() {
  const [number, setNumber] = useState('105');
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [baseRows, setBaseRows] = useState([]);
  const [hasOverride, setHasOverride] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const changed = JSON.stringify(rows) !== JSON.stringify(originalRows);
  const valid = isNumber(number);
  const hasBase = baseRows.length > 0;

  useEffect(() => {
    const controller = new AbortController();
    setTitle('');
    setRows([]);
    setOriginalRows([]);
    setBaseRows([]);
    setHasOverride(false);
    setMessage('');
    if (!isNumber(number)) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    fetch('/api/admin/responsive-reading?number=' + number, {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'load_failed');
      return data;
    }).then(data => {
      if (controller.signal.aborted) return;
      const effective = clone(data.verses);
      setTitle(data.title || '');
      setRows(effective);
      setOriginalRows(clone(effective));
      setBaseRows(clone(data.baseVerses));
      setHasOverride(!!data.hasOverride);
    }).catch(error => {
      if (!controller.signal.aborted) setMessage('본문을 불러오지 못했습니다. ' + errorText(error.message));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [number]);

  const chooseNumber = value => {
    if (busy || loading) return;
    if (changed && !window.confirm('저장하지 않은 교독문 수정 내용을 버리고 다른 번호를 열까요?')) return;
    setNumber(value);
  };

  const editRow = (index, field, value) => {
    setRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row));
    setMessage('');
  };
  const addRow = () => {
    setRows(current => [...current, {
      role: current.length % 2 ? 'congregation' : 'leader', text: '',
    }]);
    setMessage('');
  };
  const removeRow = index => {
    if (!window.confirm((index + 1) + '번째 교독문 줄을 삭제할까요?')) return;
    setRows(current => current.filter((_, i) => i !== index));
    setMessage('');
  };

  async function save() {
    if (busy || loading || !valid || !changed) return;
    if (!rows.length || rows.some(row => !row.text.trim())) {
      setMessage('비어 있는 줄을 채우거나 삭제한 뒤 저장해 주세요.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/responsive-reading', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ number: Number(number), verses: rows }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'save_failed');
      const saved = clone(data.verses);
      setRows(saved);
      setOriginalRows(clone(saved));
      setHasOverride(!!data.hasOverride);
      setMessage(data.hasOverride
        ? '교독문 ' + number + '번 수정본을 저장했습니다. 교인용 주보에도 적용됩니다.'
        : '기본 교독문과 동일하여 별도 수정본 없이 원문을 사용합니다.');
    } catch (error) {
      setMessage('저장 실패: ' + errorText(error.message));
    } finally { setBusy(false); }
  }

  async function restore() {
    if (busy || loading || !hasBase) return;
    if (!window.confirm('교독문 ' + number + '번을 기본 원문으로 복원할까요? 기존 수정본은 삭제됩니다.')) return;
    setBusy(true);
    setMessage('');
    try {
      if (hasOverride) {
        const response = await fetch('/api/admin/responsive-reading?number=' + number, {
          method: 'DELETE', credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'restore_failed');
      }
      setRows(clone(baseRows));
      setOriginalRows(clone(baseRows));
      setHasOverride(false);
      setMessage('교독문 ' + number + '번을 기본 원문으로 복원했습니다.');
    } catch (error) {
      setMessage('복원 실패: ' + errorText(error.message));
    } finally { setBusy(false); }
  }

  return <section className="admin-panel admin-reading-manager">
    <h2>교독문 본문 관리</h2>
    <p className="admin-help">
      21세기 새찬송가 1~137편의 기본 본문이 자동으로 표시됩니다.
      연간 일정에서 교독문 번호를 지정하면 교인용 주보에 연결됩니다.
      수정한 본문만 별도 저장되며 기본 원문은 유지됩니다.
    </p>
    <div className="admin-reading-heading">
      <label>교독문 번호
        <input type="number" min="1" max="200" value={number}
          onChange={event => chooseNumber(event.target.value)} disabled={busy} />
      </label>
      {valid && !loading && <div className="admin-reading-meta">
        <strong>{number}번{title ? ' · ' + title : ''}</strong>
        <span>{hasOverride ? '수정본 사용 중' : hasBase ? '기본 원문 사용 중' : '직접 등록'}</span>
      </div>}
    </div>

    {loading && <p role="status">교독문을 불러오는 중입니다.</p>}
    {!loading && !valid && <p className="admin-help">1~200 사이의 번호를 입력해 주세요.</p>}
    {!loading && valid && <div className="admin-reading-editor">
      <p className="admin-help">각 줄의 내용을 편집하고 인도자·회중·다같이 구분을 지정할 수 있습니다. 회중과 다같이 말씀은 교인용 주보에서 굵게 표시됩니다.</p>
      {rows.map((row, index) => <div className="admin-reading-line" key={index}>
        <span className="admin-reading-index">{index + 1}</span>
        <label>담당
          <select value={row.role} onChange={event => editRow(index, 'role', event.target.value)} disabled={busy}>
            {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </label>
        <label className="admin-reading-line-text">본문
          <textarea aria-label={'교독문 ' + (index + 1) + '번째 줄'}
            rows={2} value={row.text}
            onChange={event => editRow(index, 'text', event.target.value)}
            style={{ fontWeight: row.role === 'leader' ? 400 : 700 }} disabled={busy} />
        </label>
        <button type="button" className="admin-reset admin-reading-remove"
          onClick={() => removeRow(index)} disabled={busy}>삭제</button>
      </div>)}
      <button type="button" className="admin-add" onClick={addRow}
        disabled={busy || rows.length >= 100}>+ 교독문 줄 추가</button>

      {!!rows.length && <div className="admin-reading-preview">
        <strong>교인용 주보 미리보기</strong>
        {rows.map((row, index) => <p key={index}
          style={{ fontWeight: row.role === 'leader' ? 400 : 800 }}>{row.text || '내용을 입력해 주세요.'}</p>)}
      </div>}

      <div className="admin-reading-buttons">
        <button type="button" className="admin-save"
          disabled={busy || !changed || !rows.length} onClick={save}>
          {busy ? '처리 중...' : '수정한 본문 저장'}
        </button>
        {hasBase && <button type="button" className="admin-reset"
          disabled={busy || (!hasOverride && !changed)} onClick={restore}>기본 본문 복원</button>}
      </div>
      {changed && <p className="admin-help">저장되지 않은 변경사항이 있습니다.</p>}
    </div>}
    <p role="status" className="admin-reading-status">{message}</p>
  </section>;
}
