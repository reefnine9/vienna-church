const spellings = {
  '왠일': '웬일',
  '왠 일': '웬일',
  '몇일': '며칠',
  '몇 일': '며칠',
  '되요': '돼요',
  '되서': '돼서',
  '되도': '돼도',
  '되야': '돼야',
  '뵈요': '봬요',
  '오랫만에': '오랜만에',
  '오랜동안': '오랫동안',
  '설겆이': '설거지',
  '역활': '역할',
  '메세지': '메시지',
};

const spacing = {
  '교회소식': '교회 소식',
  '예배순서': '예배 순서',
  '예배시간': '예배 시간',
  '다같이': '다 같이',
  '첫째주': '첫째 주',
  '둘째주': '둘째 주',
  '셋째주': '셋째 주',
  '넷째주': '넷째 주',
  '다섯째주': '다섯째 주',
  '다음주일': '다음 주일',
  '지난주일': '지난 주일',
  '대림절기간': '대림절 기간',
  '촛불점화위원': '촛불 점화 위원',
  '공동식사': '공동 식사',
  '점심식사': '점심 식사',
  '기도제목': '기도 제목',
  '기도부탁드립니다': '기도 부탁드립니다',
  '시간되길': '시간이 되기를',
};

const replacements = { ...spellings, ...spacing };
const endings = '일(?:에는|에|부터|은|도)?|입니다|이며|이고|이라고|이지만|에서는|에서|에는|에도|에게|께서|께|이랑|으로|부터|까지|이라면|인지|이든|이나|이|가|은|는|을|를|에|의|도|만|와|과|로';
const knownWords = new RegExp(
  `(?<![\\p{L}\\p{N}])(${Object.keys(replacements).join('|')})(?=(?:${endings})?(?![\\p{L}\\p{N}]))`,
  'gu'
);

// Keep links, contact details, and quoted names or readings as entered.
const protectedText = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|「[^」]*」|『[^』]*』|“[^”]*”|‘[^’]*’|"[^"]*"|'[^']*')/gi;
const NIEUN = 4;
const RIEUL = 8;
const hasFinalConsonant = (syllable, index) => (syllable.charCodeAt(0) - 0xac00) % 28 === index;

function proofreadFragment(text) {
  return text
    .replace(/([가-힣]) {2,}(?=[가-힣])/g, '$1 ')
    .replace(knownWords, word => replacements[word])
    .replace(/어느[ \t]+때[ \t]+보다(?![가-힣])/g, '어느 때보다')
    .replace(/됬(?=어|습|다|고|으|을|던)/g, '됐')
    .replace(/(예배|연습|모임|회의|식사)후(?=에|부터|까지|[\s.,!?]|$)/g, '$1 후')
    .replace(/([가-힣])[ \t]*수[ \t]*(?:(밖에)[ \t]*(?=없))?([있없])/g, (match, verb, boundParticle, predicate) =>
      hasFinalConsonant(verb, RIEUL) ? `${verb} 수${boundParticle || ''} ${predicate}` : match
    )
    .replace(/([가-힣])때(?=에는|에|까지|마다|부터|는|도|[\s.,!?]|$)/g, (match, verb) =>
      hasFinalConsonant(verb, RIEUL) ? `${verb} 때` : match
    )
    .replace(/([가-힣])[ \t]*것[ \t]*같(?=습니다|다|아요|은|이|고)/g, (match, verb) =>
      hasFinalConsonant(verb, RIEUL) || hasFinalConsonant(verb, NIEUN) ? `${verb} 것 같` : match
    )
    .replace(/([가-힣])[ \t]+([,.!?])/g, '$1$2')
    .replace(/([가-힣])\s*:\s*(?=[가-힣])/g, '$1: ');
}

export function proofreadChurchNews(news) {
  return news.replace(/[^\r\n]+/g, line => {
    if (/^\s*\|/.test(line)) return line;
    return line.split(protectedText)
      .map((fragment, index) => index % 2 ? fragment : proofreadFragment(fragment))
      .join('')
      .trimEnd();
  });
}

// Supply missing periods on clear sentence endings even if the language model omitted them.
const sentenceEnd = /(?:[가-힣](?:니다|시다|시오|세요|[아어해돼줘봐와래게네군]요|겠다|셨다|었다|았다)|이다|한다|된다|있다|없다|같다)(?=[ \t]|$)/g;
const continuation = /^[ \t]*(?:[.?!…。！？,:;~()\[\]]|(?:라고|라며|라는|하고|하며|하여|하면서|하니|하므로|하자|하면|하지만|보니|보면|보면서|싶어|싶은)(?=[\s.,!?]|$))/;
const nonProseLine = /^[ \t]*(?:\||#{1,6}(?=[ \t]|$))/;

export function fillMissingSentencePeriods(news) {
  return news.replace(/[^\r\n]+/g, line => {
    if (nonProseLine.test(line)) return line;
    return line.split(protectedText)
      .map((part, index) => index % 2 ? part : part.replace(sentenceEnd, (ending, offset) => {
        const rest = part.slice(offset + ending.length);
        return continuation.test(rest) ? ending : ending + '.';
      }))
      .join('');
  });
}
