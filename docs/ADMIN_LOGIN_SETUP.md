# 관리자 비밀번호 로그인 설정

이 기능은 Cloudflare Pages Functions에서 비밀번호를 검사합니다. GitHub에 비밀번호를 넣지 마세요.

## 1. D1 테이블
Cloudflare > D1 > vienna-church-db > Console에서 [admin-auth-schema.sql](../admin-auth-schema.sql) 전체를 실행하세요. `admin_login_attempts` 테이블을 만듭니다.

## 2. Cloudflare Secret 2개
Workers & Pages > vienna-church > Settings > Variables and secrets > Add.
각각 **Secret** 유형으로 Production에 추가합니다.

- `ADMIN_PASSWORD`: 직접 정한 길고 고유한 비밀번호 (최소 4자 허용, 보안상 12자 이상 권장)
- `ADMIN_SESSION_SECRET`: 비밀번호와 다른 무작위 문자열 (32자 이상, 권장 64자 이상)

두 값은 **서로 달라야** 하며 채팅, GitHub, 스크린샷에 적지 마세요. 설정 후 새 배포가 필요할 수 있습니다.

## 3. 확인
`/admin` 접속 > 비밀번호 입력 > 로그인.
브라우저를 닫았다가 다시 열어도 로그인 유지. 활동할 때마다 만료 시점이 365일 뒤로 연장됩니다. 기기의 쿠키 삭제, 시크릿 모드, 365일 동안 미사용, 로그아웃, SESSION_SECRET 변경 시 재로그인이 필요합니다.

현재는 **관리자 편집 화면에만 로그인 게이트**가 있습니다. 편집한 주보는 여전히 이 기기의 localStorage에 임시저장되며 서버 D1에는 저장/게시되지 않습니다. 다음 단계에서 보호된 저장 API를 추가합니다.

## 보안 주의
- 단순한 URL 비공개 방식이 아닌 서버 측 인증입니다.
- 로그인 실패가 같은 IP에서 15분 안에 5번 발생하면 15분 동안 차단됩니다. 대규모 분산 공격에는 Cloudflare WAF/Rate Limiting 추가가 권장됩니다.
- 관리자 API는 반드시 `/api/admin/*` 아래에 만들고 서버 인증 미들웨어를 거쳐야 합니다.
- 로그인 쿠키는 HttpOnly, Secure, SameSite=Strict이며 JS에서 읽을 수 없습니다.
- 서버 인증은 영구 세션이 아닙니다. 장기간 편리하게 사용하도록 자동 갱신됩니다.
- 비밀번호만 변경해도 기존 세션은 자동으로 무효화되지 않습니다. 모든 기기 로그아웃이 필요하면 `ADMIN_SESSION_SECRET`을 교체하세요.
