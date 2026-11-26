import React, { useEffect, useRef, useState } from 'react';

const stripBullet = line => String(line || '').trim()
  .replace(/^(?:[•●▪◦]|[-*]|\d+[.)])\s*/, '');
const cleanField = value => String(value || '').trim().replace(/\s*\r?\n\s*/g, ' ');

// Keep the existing bulletin storage format: blank line between families,
// first line = family name, following lines = individual prayer requests.
export function parseIntercession(text, newId = () => '') {
  return String(text || '').trim()
    .split(/\r?\n\s*\r?\n/)
    .map(block => block.split(/\r?\n/).map(stripBullet).filter(Boolean))
    .filter(lines => lines.length)
    .map(([family, ...prayers]) => ({
      id: newId(),
      family,
      prayers: prayers.map(text => ({ id: newId(), text })),
    }));
}

export function serializeIntercession(groups) {
  return groups.map(group => [
    cleanField(group.family),
    ...group.prayers.map(prayer => cleanField(prayer.text)),
  ].join('\n')).join('\n\n');
}

const maxFamilies = 30;
const maxPrayers = 20;

export default function IntercessionEditor() {
  const nextId = useRef(0);
  const generateId = () => String(++nextId.current);
  const [groups, setGroups] = useState([]);
  const [savedText, setSavedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const text = serializeIntercession(groups);
  const dirty = text !== savedText;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    setMessage('');
    fetch('/api/admin/intercession', {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'load_failed');
      return result;
    }).then(result => {
      if (controller.signal.aborted) return;
      const parsed = parseIntercession(result.text || '', generateId);
      setGroups(parsed);
      setSavedText(serializeIntercession(parsed));
    }).catch(() => {
      if (!controller.signal.aborted) {
        setLoadError(true);
        setMessage('중보기도 내용을 불러오지 못했습니다.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);

  const editFamily = (id, value) => {
    setGroups(prev => prev.map(group => group.id === id ? { ...group, family: value } : group));
    setMessage('');
  };
  const editPrayer = (familyId, prayerId, value) => {
    setGroups(prev => prev.map(group => group.id !== familyId ? group : {
      ...group,
      prayers: group.prayers.map(prayer =>
        prayer.id === prayerId ? { ...prayer, text: value } : prayer),
    }));
    setMessage('');
  };
  const addFamily = () => {
    if (groups.length >= maxFamilies) return;
    setGroups(prev => [...prev, {
      id: generateId(), family: '',
      prayers: [{ id: generateId(), text: '' }],
    }]);
    setMessage('');
  };
  const removeFamily = id => {
    const group = groups.find(item => item.id === id);
    if (!group || !window.confirm((group.family.trim() || '이 가정') + '과 기도 제목을 삭제할까요? 저장 전까지는 주보에 반영되지 않습니다.')) return;
    setGroups(prev => prev.filter(item => item.id !== id));
    setMessage('');
  };
  const addPrayer = id => {
    setGroups(prev => prev.map(group => group.id !== id || group.prayers.length >= maxPrayers
      ? group : { ...group, prayers: [...group.prayers, { id: generateId(), text: '' }] }));
    setMessage('');
  };
  const removePrayer = (familyId, prayerId) => {
    setGroups(prev => prev.map(group => group.id !== familyId ? group : {
      ...group, prayers: group.prayers.filter(prayer => prayer.id !== prayerId),
    }));
    setMessage('');
  };

  async function save() {
    if (loading || saving || loadError || !dirty) return;
    const invalid = groups.some(group =>
      !cleanField(group.family) || !group.prayers.length ||
      group.prayers.some(prayer => !cleanField(prayer.text)));
    if (invalid) {
      setMessage('각 세트의 가정 이름과 기도 제목을 모두 입력해 주세요. 빈 기도 제목은 삭제할 수 있습니다.');
      return;
    }
    if (text.length > 6000) {
      setMessage('전체 내용은 6,000자 이내로 입력해 주세요.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/intercession', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'save_failed');
      const parsed = parseIntercession(result.text, generateId);
      setGroups(parsed);
      setSavedText(serializeIntercession(parsed));
      setMessage('중보기도를 저장했습니다. 교인용 주보에 반영됩니다.');
    } catch {
      setMessage('중보기도 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="admin-panel admin-intercession-editor">
    <h2>비엔나 교회 가족 중보기도</h2>
    <p className="admin-help">
      가정 이름은 큰 동그라미 글머리표, 기도 제목은 그 아래 작은 네모 글머리표로 표시됩니다.
      가정마다 기도 제목을 여러 개 입력하거나 다른 가정을 추가할 수 있습니다.
    </p>
    {loading && <p role="status">기도 제목을 불러오는 중입니다.</p>}
    {!loading && loadError && <button type="button" className="admin-reset"
      onClick={() => setReload(value => value + 1)}>다시 불러오기</button>}
    {!loading && !loadError && <>
      {groups.map((group, i) => <div className="intercession-group" key={group.id}>
        <div className="intercession-group-header">
          <strong>가정 {i + 1}</strong>
          <button type="button" className="admin-reset" disabled={saving}
            onClick={() => removeFamily(group.id)}>가정 삭제</button>
        </div>
        <label className="intercession-family-label">
          <span><span className="intercession-family-symbol" aria-hidden="true">●</span> 가정 이름</span>
          <input type="text" value={group.family}
            placeholder="예: 아른트-이종아 집사님 가정"
            aria-label={'가정 ' + (i + 1) + ' 이름'}
            disabled={saving} maxLength={300}
            onChange={event => editFamily(group.id, event.target.value)} />
        </label>
        <div className="intercession-prayer-list">
          <strong className="intercession-prayer-heading">기도 제목</strong>
          {group.prayers.map((prayer, j) => <div className="intercession-prayer-row" key={prayer.id}>
            <span className="intercession-child-symbol" aria-hidden="true">▪</span>
            <label>
              <span>기도 제목 {j + 1}</span>
              <textarea rows={2} value={prayer.text}
                aria-label={'가정 ' + (i + 1) + ' 기도 제목 ' + (j + 1)}
                placeholder="기도 제목을 입력하세요."
                disabled={saving}
                onChange={event => editPrayer(group.id, prayer.id, event.target.value)} />
            </label>
            <button type="button" className="admin-reset intercession-remove-prayer"
              disabled={saving} onClick={() => removePrayer(group.id, prayer.id)}>삭제</button>
          </div>)}
          <button type="button" className="admin-reset intercession-add-prayer"
            disabled={saving || group.prayers.length >= maxPrayers}
            onClick={() => addPrayer(group.id)}>+ 기도 제목 추가</button>
        </div>
      </div>)}
      <button type="button" className="admin-add intercession-add-family"
        disabled={saving || groups.length >= maxFamilies}
        onClick={addFamily}>+ 가정 추가</button>
      {!groups.length && <p className="admin-help">등록된 가정이 없습니다. ‘가정 추가’를 눌러 입력해 주세요.</p>}
      <div className="intercession-footer">
        <button type="button" className="admin-save" disabled={saving || !dirty}
          onClick={save}>{saving ? '저장 중...' : '중보기도 저장'}</button>
        <span className="admin-help" role="status">{message || (dirty ? '저장되지 않은 변경사항이 있습니다.' : '')}</span>
      </div>
    </>}
    {loadError && <p role="alert" className="admin-help">{message}</p>}
  </section>;
}
