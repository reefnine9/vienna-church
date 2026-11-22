// Match the published lines so later edits in the admin editor take precedence.
const november22Edits = new Map([
  [
    "교회를 위한 기도 : 그 어느 때 보다 주님의 인도하심이 간절합니다. 매일 오후 9시에 각자의 처소에서 잠시 또는 무릎으로 교회를 위해 기도합시다.",
    "교회를 위한 기도: 그 어느 때보다 주님의 인도하심이 간절합니다. 매일 오후 9시에 각자의 처소에서 잠시 시간을 내어 교회를 위해 기도합시다. 무릎을 꿇고 기도하셔도 좋습니다.",
  ],
  [
    "교회를 섬겨주실 담임목사님을 모시는 청빙의 모든 과정이 하나님의 은혜 가운데 진행될 수 있도록  기도 부탁드립니다.",
    "교회를 섬겨 주실 담임 목사님을 청빙하는 모든 과정이 하나님의 은혜 가운데 진행될 수 있도록 기도 부탁드립니다.",
  ],
  [
    "내년 유럽지방 신년성회가 1월 26일(화)~29일(금)까지 튀르키예 이즈미르에서 열립니다.",
    "내년 유럽지방 신년 성회가 1월 26일(화)부터 29일(금)까지 튀르키예 이즈미르에서 열립니다.",
  ],
  [
    "11월 29일 주일부터 대림절기간으로 예배드립니다. 이미 오신 예수님의 탄생을 기억하며 성탄을 준비하고, 다시 오실 주님을 기다리는 묵상의 시간입니다. 29일은 그 첫째주로 소망과 기다림의 초를 켜겠습니다.",
    "11월 29일 주일부터 대림절 예배를 드립니다. 이미 오신 예수님의 탄생을 기억하며 성탄을 준비하고, 다시 오실 주님을 기다리는 묵상의 시간입니다. 대림절 첫째 주일인 29일에는 소망과 기다림의 초를 켜겠습니다.",
  ],
  [
    "촛불점화위원- 유희찬, 은하준, 이준우, 이시우",
    "촛불 점화 위원은 유희찬, 은하준, 이준우, 이시우입니다.",
  ],
  [
    "제자리에 멈춰 기다리는 시간이 아니라 오실 예수님을 향해 마음을 열고 그분께 달려가는 시간되길 기도합시다.",
    "제자리에 멈춰 기다리는 시간이 아니라 오실 예수님을 향해 마음을 열고 그분께 달려가는 시간이 되기를 기도합시다.",
  ],
]);

export function editPublishedNews(date, text) {
  if (date !== '2026-11-22' || typeof text !== 'string') return text;
  return text.split('\n').map(line => november22Edits.get(line.trim()) ?? line).join('\n');
}

// Apply the archive correction only to entries saved before manual confirmation.
export function storedNewsText(date, data) {
  const text = data.news || '';
  return data.newsConfirmed ? text : editPublishedNews(date, text);
}

export function readStoredNews(date, body) {
  try {
    const data = JSON.parse(body);
    if (data && typeof data === 'object') return storedNewsText(date, data);
  } catch {}
  return editPublishedNews(date, body);
}
