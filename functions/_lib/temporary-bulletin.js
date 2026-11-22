const date = '2026-11-22';
const endOfSundayInVienna = Date.parse('2026-11-22T23:00:00Z');

// Public 11/22 bulletin as seen on 11/20 before the D1 read limit was reached.
const bulletin = {
  sunday_date: date,
  sermon_title: '추수 감사절, 그 후 전도 감사절',
  items: [
    ['경배와 찬양', '다같이'],
    ['조용한 기도', '다같이 (인도자)', 'text', true],
    ['경배 찬송', '94장', 'text', true],
    ['죄의 고백 / 용서의 말씀', '인도자', 'text', true],
    ['교독', '116번', 'reading'],
    ['대표 기도', '전은숙'],
    ['찬송', '496장'],
    ['성경 봉독', '시편 126장 5-6절', 'scripture'],
    ['찬송', '찬양대'],
    ['말씀', '박철학 선교사님'],
    ['신앙 고백', '사도신경'],
    ['봉헌 찬송', '384장'],
  ].map(([title, detail, kind = 'text', standing = false]) => ({ title, detail, kind, standing })),
  announcements: [{
    body: [
      "교회를 위한 기도: 그 어느 때보다 주님의 인도하심이 간절합니다. 매일 오후 9시에 각자의 처소에서 잠시 시간을 내어 교회를 위해 기도합시다. 무릎을 꿇고 기도하셔도 좋습니다.",
      "교회를 섬겨 주실 담임 목사님을 청빙하는 모든 과정이 하나님의 은혜 가운데 진행될 수 있도록 기도 부탁드립니다.",
      "내년 유럽지방 신년 성회가 1월 26일(화)부터 29일(금)까지 튀르키예 이즈미르에서 열립니다.",
    ].join('\n'),
    extras: {
      servants: [
        '구분 | 11/22 | 11/29 | 12/6',
        '인도 | 김기현 | 김기현 | 김기현',
        '대표기도 | 전은숙 | 윤수빈 | 최경열',
        '봉헌 | 아른트 | 백민규 | 백민규',
      ].join('\n'),
      closingPrayer: '주기도문',
    },
  }],
  lunch: [{ date: '2026-11-29', preparation: '여선교회', cleanup: '남선교회' }],
};

export function bulletinReadError(requestedDate, json, error, status) {
  const canUseCopy = (!requestedDate || requestedDate === date) && Date.now() < endOfSundayInVienna;
  return canUseCopy
    ? json({ bulletin, source: 'temporary_public_copy' })
    : json({ error }, status);
}
