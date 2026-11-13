# Design

## Context

저장소에는 OpenSpec 설정만 있고 앱 코드는 없다(greenfield). 동기와 범위는 `proposal.md`, 요구사항은 `specs/diary-entries/spec.md`를 따른다. 제약은 Vanilla JS + Tailwind CSS + `localStorage`, 빌드 단계와 서버 없음이다.

## Goals / Non-Goals

**Goals:**
- `index.html`을 브라우저로 바로 열어도 동작하는 정적 앱
- 다음 변경(수정·삭제 등)에서 데이터 형식을 바꾸지 않고 확장할 수 있는 기록 구조
- 날짜·저장 로직을 DOM과 분리해 브라우저 없이도 확인할 수 있게 하기

**Non-Goals:**
- 자동화된 테스트 프레임워크·빌드 도구 도입
- 데이터 마이그레이션 체계(첫 버전이므로 버전 필드만 남겨 둠)

## Decisions

### 1. 파일 구성: `index.html` + `app.js` (classic script)
- `index.html`: 마크업과 Tailwind CDN 로드
- `app.js`: 날짜 계산, 저장소 읽기/쓰기, 렌더링, 이벤트 연결
- **대안**: ES module(`type="module"`)로 나누기 → `file://`로 열면 CORS 때문에 module 로드가 막힌다. 로컬 서버 없이 더블클릭으로 열 수 있어야 하므로 classic script 하나로 시작한다.

### 2. Tailwind는 Play CDN
- `<script src="https://cdn.tailwindcss.com">`로 불러온다.
- **대안**: Tailwind CLI로 CSS 빌드 → 운영 품질은 낫지만 Node 빌드 단계가 생긴다. 이번 범위에는 과하다.
- 오프라인에서는 스타일이 빠지지만 기능은 동작한다(Risks 참고).

### 3. 데이터 형식: 키 하나에 배열
- 키: `diary.entries.v1`
- 값: 기록 배열의 JSON
  ```
  { id, date: "2026-12-31", time: "14:05", text, createdAt: 1798700700000 }
  ```
- `id`: `crypto.randomUUID()` (지원하지 않으면 `createdAt` + 난수로 대체). 다음 변경의 수정·삭제에서 항목을 가리키는 데 쓴다.
- `createdAt`(epoch ms)로 정렬하고, `date`/`time`은 표시용으로 저장 시점에 로컬 기준으로 계산해 함께 저장한다. 나중에 시간대가 바뀌어도 작성 당시의 날짜가 유지된다.
- 키 이름의 `v1`은 형식이 바뀔 때 새 키로 옮길 수 있게 하는 표시다.
- **대안**: 날짜별 키(`diary.2026-12-31`) → 전체 목록을 만들려면 모든 키를 훑어야 해서 단순 배열이 낫다. IndexedDB → 기록량이 작아 과하다.

### 4. 로컬 날짜·시간 계산
- `Date`의 `getFullYear/getMonth/getDate/getHours/getMinutes`로 직접 0을 채워 만든다.
- `toISOString()`은 UTC라 쓰지 않는다. `toLocaleDateString`은 로캘마다 형식이 달라 쓰지 않는다.
- 오늘 날짜 표시는 페이지 로드 시 계산한다. 자정을 넘겨 페이지를 열어 둔 경우에도 저장 시점에는 다시 계산하므로 기록의 날짜는 정확하다.

### 5. 입력 검증
- `<input maxlength="100">`으로 입력 길이를 막고, 저장 시 `trim()` 후 빈 문자열이면 저장하지 않는다.
- 빈 입력 경고는 저장 실패 안내와 같은 메시지 영역에 경고 스타일로 표시한다. `alert()` 팝업은 흐름을 끊고 테스트하기도 어려워 쓰지 않는다. 경고를 띄운 뒤 입력창에 포커스를 돌려주고, 사용자가 입력을 시작하면 메시지를 지운다.
- Enter 저장은 `<form>`의 submit 이벤트로 처리해 버튼 클릭과 같은 경로를 탄다. 한글 IME 조합 중 Enter로 인한 중복 제출을 막기 위해 `isComposing`을 확인한다.

### 6. 오류 처리
- 읽기: `JSON.parse` 실패나 배열이 아닌 값이면 빈 배열로 시작한다(기존 값은 덮어쓰기 전까지 그대로 둔다).
- 쓰기: `setItem`을 try/catch로 감싸고, 실패하면 안내 메시지를 보여 주며 메모리 상태도 되돌리고 입력창을 비우지 않는다.

### 7. 렌더링과 스크롤
- 저장할 때마다 목록 전체를 다시 그린다(기록 수가 작아 충분하다).
- 사용자 입력은 `textContent`로 넣어 HTML 주입을 막는다.
- 목록 컨테이너에 약 5개 항목 높이의 `max-height`와 `overflow-y-auto`를 준다.

## Risks / Trade-offs

- [Tailwind CDN은 네트워크가 필요하고 운영용이 아님] → 오프라인에서는 스타일 없이도 동작하게 마크업을 기본 HTML 요소로 구성한다. 운영 배포가 필요해지면 CLI 빌드로 바꾼다.
- [`localStorage`는 기기·브라우저마다 따로이고, 브라우저 데이터 삭제 시 사라짐] → 이번 범위의 알려진 한계로 둔다. 백업·동기화는 별도 변경에서 다룬다.
- [기록이 수천 개가 되면 매번 전체 직렬화·렌더링] → 한 줄 기록의 크기로는 현실적인 문제가 아니다. 필요해지면 가상 스크롤이나 IndexedDB를 검토한다.
- [같은 앱을 여러 탭에서 열면 마지막 저장이 다른 탭의 기록을 덮을 수 있음] → 저장 직전에 저장소를 다시 읽어 그 배열에 추가하는 방식으로 대부분 막는다.

## Migration Plan

새 앱이므로 기존 데이터가 없다. 배포는 정적 파일을 그대로 열거나 정적 호스팅에 올리는 것으로 충분하다.
