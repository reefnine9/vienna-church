import React, { useEffect, useRef, useState } from 'react';

const formattedDate = date => {
  const [year, month, day] = date.split('-');
  return year + '.' + month + '.' + day;
};
const validNumber = value => /^[1-9]\d{0,2}$/.test(String(value)) && Number(value) <= 137;

export default function ResponsiveReadings() {
  const [number, setNumber] = useState('115');
  const [reading, setReading] = useState(null);
  const [readingBusy, setReadingBusy] = useState(false);
  const [calendar, setCalendar] = useState([]);
  const [titles, setTitles] = useState({});
  const [calendarBusy, setCalendarBusy] = useState(true);
  const [calendarError, setCalendarError] = useState('');
  const [message, setMessage] = useState('');
  const [draftNumbers, setDraftNumbers] = useState({});
  const [savingDates, setSavingDates] = useState({});
  const pending = useRef(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/responsive-reading-titles.json', { signal: controller.signal })
      .then(res => { if (!res.ok) throw Error('titles'); return res.json(); })
      .then(data => { if (!controller.signal.aborted) setTitles(data); })
      .catch(() => {});
    fetch('/api/admin/reading-calendar', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw Error(data.error || 'calendar');
        return data;
      }).then(data => {
        if (controller.signal.aborted) return;
        setCalendar(data.entries || []);
        if (data.entries?.[0]?.number) setNumber(String(data.entries[0].number));
      }).catch(error => {
        if (!controller.signal.aborted) setCalendarError('일정표를 불러오지 못했습니다. ' + error.message);
      }).finally(() => {
        if (!controller.signal.aborted) setCalendarBusy(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!validNumber(number)) {
      setReading(null);
      setReadingBusy(false);
      return;
    }
    const controller = new AbortController();
    setReadingBusy(true);
    setReading(null);
    fetch('/api/responsive-reading?number=' + number, { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw Error('reading');
        return data;
      }).then(data => {
        if (!controller.signal.aborted) setReading(data);
      }).catch(() => {
        if (!controller.signal.aborted) setReading({ verses: [], text: '', error: true });
      }).finally(() => {
        if (!controller.signal.aborted) setReadingBusy(false);
      });
    return () => controller.abort();
  }, [number]);

  function editNumber(date, value) {
    setDraftNumbers(current => ({ ...current, [date]: value }));
    setMessage('');
  }

  async function saveNumber(row) {
    if (pending.current.has(row.date)) return;
    const typed = draftNumbers[row.date];
    if (typed === undefined) return;
    if (!validNumber(typed)) {
      setMessage(formattedDate(row.date) + ': 교독문 번호는 1~137 사이로 입력해 주세요.');
      return;
    }
    const next = Number(typed);
    if (next === row.number) {
      setDraftNumbers(current => { const copy = { ...current }; delete copy[row.date]; return copy; });
      return;
    }
    pending.current.add(row.date);
    setSavingDates(current => ({ ...current, [row.date]: true }));
    try {
      const response = await fetch('/api/admin/reading-calendar', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date: row.date, number: next }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'save_failed');
      setCalendar(current => current.map(item => item.date === row.date ? { ...item, number: next } : item));
      setDraftNumbers(current => {
        if (current[row.date] !== typed) return current;
        const copy = { ...current }; delete copy[row.date]; return copy;
      });
      setMessage(formattedDate(row.date) + ' 교독문 ' + next + '번을 연간 계획에 반영했습니다.');
      setNumber(String(next));
    } catch {
      setMessage(formattedDate(row.date) + ' 교독문을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      pending.current.delete(row.date);
      setSavingDates(current => { const copy = { ...current }; delete copy[row.date]; return copy; });
    }
  }

  return <section className="admin-panel admin-reading-simple">
    <h2>교독문 본문</h2>
    <div className="admin-reading-simple-controls">
      <label>교독문 번호
        <input type="number" min="1" max="137" value={number} onChange={event => setNumber(event.target.value)} />
      </label>
      {reading?.title && <strong>{reading.title}</strong>}
    </div>
    <div className="admin-reading-simple-preview">
      {readingBusy && <p>교독문을 불러오는 중입니다.</p>}
      {!readingBusy && !validNumber(number) && <p>1~137번 중 하나를 선택해 주세요.</p>}
      {!readingBusy && validNumber(number) && (!reading?.verses?.length
        ? <p>{reading?.error ? '교독문을 불러오지 못했습니다.' : '등록된 교독문 본문이 없습니다.'}</p>
        : reading.verses.map((verse, index) =>
          <p key={index} style={{ fontWeight: verse.role === 'leader' ? 400 : 800 }}>{verse.text}</p>))}
    </div>

    <div className="admin-reading-calendar-title">
      <h2>주일별 교독문 일정표</h2>
      <span>현재 주일부터 약 1년 · 52주일</span>
    </div>
    <p className="admin-help">교독문 번호를 수정하고 입력칸 밖을 누르면 자동 저장되며, 연간 일정 관리의 교독문에도 바로 반영됩니다. 날짜를 누르면 위에서 해당 교독문을 볼 수 있습니다.</p>
    <p className="admin-help">2027년 5월 23일까지는 기존 <a href="https://docs.google.com/spreadsheets/d/1Nvih2TN09hce3e7yJYYUvLY1g9spi27-iSlZalUR8GY/edit" target="_blank" rel="noreferrer">교회력 구글 시트</a>의 제안을 사용했습니다. 그 이후는 추가 추천이며, 전년도 확인 자료가 없는 경우 ‘미확인’으로 표시합니다.</p>
    {calendarBusy && <p role="status">교독문 일정을 불러오는 중입니다.</p>}
    {calendarError && <p role="alert">{calendarError}</p>}
    {!!calendar.length && <div className="admin-reading-calendar-scroll">
      <table className="admin-reading-calendar-table">
        <thead><tr>
          <th>주일 날짜</th>
          <th>교독문</th>
          <th>기독교 절기</th>
          <th>전년도 동일 절기 주일</th>
          <th>전년도 교독문</th>
        </tr></thead>
        <tbody>{calendar.map(row => {
          const value = draftNumbers[row.date] ?? (row.number ? String(row.number) : '');
          const chosenTitle = titles[value] || '';
          return <tr key={row.date}>
            <td><button type="button" className="admin-reading-date-link"
              onClick={() => { if (validNumber(value)) setNumber(String(value)); }}>{formattedDate(row.date)}</button></td>
            <td>
              <div className="admin-reading-calendar-cell">
                <input type="number" min="1" max="137"
                  aria-label={formattedDate(row.date) + ' 교독문 번호'}
                  value={value} disabled={!!savingDates[row.date]}
                  onChange={event => editNumber(row.date, event.target.value)}
                  onFocus={() => { if (validNumber(value)) setNumber(String(value)); }}
                  onBlur={() => saveNumber(row)}
                  onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
                <small>{chosenTitle}{savingDates[row.date] ? ' · 저장 중' : ''}</small>
              </div>
            </td>
            <td>{row.festival}</td>
            <td>{row.previousDate ? formattedDate(row.previousDate) : '—'}</td>
            <td>{row.previousLink && row.previousReading !== '미확인'
              ? <a href={row.previousLink} target="_blank" rel="noreferrer">{row.previousReading}</a>
              : row.previousReading}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    <p role="status" className="admin-reading-calendar-status">{message}</p>
  </section>;
}
