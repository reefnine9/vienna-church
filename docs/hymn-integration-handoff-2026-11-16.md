# 찬송가 악보 연동 작업 기록 (2026-11-16)

## 현재 적용 방침
- **경배 찬송 / 찬송 / 봉헌 찬송**: 번호와 텍스트만 표시. 우측 펼치기 버튼 및 악보 팝업 비활성화.
- **조용한 기도**: 기존 공통 PDF 악보 펼치기, 전체 화면 보기 유지.
- **찬양대 찬송**: 기존 주간 찬양대 PDF 악보 펼치기, 전체 화면 보기 유지.
- **관리자**: 미완성 번호별 찬송가 출처 관리 UI는 다음 수정까지 숨김.
- 기존 예배 순서의 번호/내용과 조용한 기도·찬양대 PDF 설정은 유지.

## 이전에 구현했으나 현재 사용하지 않는 기능
1. R2 `SCORES`에 번호별 PDF 업로드: `functions/api/admin/hymns/[number].js`의 초기 구현. R2 바인딩 미설정.
2. Google Drive 공유 PDF ID를 D1 `announcements`에 `hymn-drive-N`으로 저장하고 `/api/scores/google/<id>.pdf`로 PDF를 표시하는 기능.
3. BibleToPPT 번호별 자동 PDF 가져오기 시도: `functions/api/scores/bibletoppt/[number].js`. 실제 다운로드 성공 미검증.
4. Hanoon Hymn으로 전환: 직접 이미지/PDF 주소와 API 미확인. 현재는 하눈 사이트 검색 링크만 구현한 상태.
5. 번호별 출처 선택: D1 `announcements`에 `hymn-source-N` 저장, `src/HymnManager.jsx`와 `src/HymnScore.jsx` 사용. 현재 화면에서는 import/렌더링 제거하여 비활성화.

## 다음 수정 시 검토
- 하눈찬송의 합법적인 재사용 허용 범위, 공식 API 또는 직접 파일 URL 확인.
- 번호별 악보 표시 방식 결정(PDF/이미지/원본 링크).
- 관리자 출처 선택과 저장/검증 UX 정비.
- 성공적으로 악보를 읽은 경우에만 교인용 펼치기 활성화.
- Cloudflare Pages 배포 및 모바일(특히 iPhone) 실제 동작 검증.
- 보류된 소스 파일과 API는 삭제하지 않았음. 재활성화 전 검증 및 정리가 필요함.
