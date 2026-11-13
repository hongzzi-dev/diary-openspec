# Tasks

## 1. 페이지 골격

- [ ] 1.1 `index.html` 작성: Tailwind Play CDN, 오늘 날짜 영역, `<form>`(입력창 `maxlength="100"` + 저장 버튼), 안내 메시지 영역, 목록 컨테이너(약 5개 높이 `max-height` + `overflow-y-auto`), `app.js` classic script 로드 — 브라우저로 열어 각 요소가 보이고 콘솔 오류가 없는지 확인
- [ ] 1.2 `app.js` 빈 파일을 만들고 DOM 초기화를 `document`가 있을 때만 실행하도록 구성 — `node app.js`가 오류 없이 끝나는지 확인

## 2. 날짜·시간 로직

- [ ] 2.1 로컬 기준 `YYYY-MM-DD`, `HH:mm` 포맷 함수 작성(`toISOString` 사용 금지) — Node에서 `TZ=Asia/Seoul`로 로컬 2026-12-31 08:30(UTC 12-30)을 넣어 `2026-12-31`, `08:30`이 나오는지 확인
- [ ] 2.2 페이지 로드 시 오늘 날짜를 화면에 표시 — 브라우저에서 날짜가 기기 날짜와 같은 `YYYY-MM-DD` 형식으로 보이는지 확인

## 3. 저장소

- [ ] 3.1 `diary.entries.v1` 키 읽기 함수 작성: 값 없음·JSON 파싱 실패·배열 아님이면 빈 배열 반환 — Node에서 가짜 storage 객체로 세 경우 모두 빈 배열이 나오는지 확인
- [ ] 3.2 기록 생성·추가 함수 작성: `trim()` 후 빈 값이면 거부, `{ id, date, time, text, createdAt }` 생성, 저장 직전에 저장소를 다시 읽어 추가 후 `setItem`, 실패 시 오류를 알려 줌 — Node에서 빈 입력 거부, 공백 제거, 같은 날 두 번 저장 시 2개 유지, `setItem`이 throw할 때 실패 결과가 나오는지 확인

## 4. 화면 연결

- [ ] 4.1 목록 렌더링: `createdAt` 내림차순, 각 항목에 날짜·시간·내용을 `textContent`로 표시, 비어 있으면 안내 문구 — 브라우저에서 `<b>x</b>`를 저장해 태그가 글자로 보이는지, 기록이 없을 때 안내가 보이는지 확인
- [ ] 4.2 저장 처리: form submit(버튼·Enter 공통, IME 조합 중 Enter 무시) → 성공 시 입력창 비우고 목록 갱신, 실패 시 안내 표시하고 입력 유지 — 브라우저에서 버튼·Enter 저장, 한글 입력 후 Enter 시 한 번만 저장되는지, 공백만 입력 시 저장되지 않고 경고 메시지가 뜨며, 글자를 입력하면 경고가 사라지는지 확인

## 5. 통합 확인

- [ ] 5.1 브라우저에서 기록 8개 저장 후 새로고침 — 8개가 최신순으로 유지되고 약 5개가 보인 뒤 목록 영역 안에서만 스크롤되는지 확인
- [ ] 5.2 저장소 값을 손상된 문자열로 바꾸고 새로고침 — 화면이 오류 없이 빈 목록으로 열리는지 확인
- [ ] 5.3 `openspec validate add-diary-write --strict` 실행 — 통과하는지 확인

## Workflow follow-up

- 구현과 확인이 끝나면 `openspec-archive-change`로 변경을 보관해 `openspec/specs/diary-entries/spec.md`를 만든다.
