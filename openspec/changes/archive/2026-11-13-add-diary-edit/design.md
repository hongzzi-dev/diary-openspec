# Design

## Context

`add-diary-write`로 만든 `app.js`는 순수 로직 `DiaryCore`(`formatDate`, `loadEntries`, `addEntry`, `sortNewestFirst`)와 화면 연결 `initDiaryApp`으로 나뉘어 있다. 목록은 저장할 때마다 `renderList(entries)`가 통째로 다시 그린다. 기록 객체는 `{ id, date, time, text, createdAt }`이며 `diary.entries.v1` 키에 배열로 저장된다. 요구사항은 `specs/diary-entries/spec.md`를 따른다.

## Goals / Non-Goals

**Goals:**
- 기존 구조(로직/화면 분리, 전체 다시 그리기)를 유지하면서 수정을 더한다.
- 수정 로직을 Node에서 검증할 수 있게 `DiaryCore`에 순수 함수로 둔다.

**Non-Goals:**
- 부분 렌더링이나 프레임워크 도입
- 저장 형식 버전 변경(`v1` 유지)

## Decisions

### 1. 저장 로직: `DiaryCore.updateEntry(storage, id, text, now)`
- `addEntry`와 같은 결과 형태를 쓴다: `{ ok: true, entry, entries, changed }` 또는 `{ ok: false, error: 'empty' | 'not_found' | 'storage' }`.
- `trim()` 후 빈 값이면 `empty`. 100자를 넘으면 잘라 낸다(입력창 `maxlength`가 1차 방어).
- 저장 직전에 저장소를 다시 읽어 `id`로 찾는다. 다른 탭에서 쓴 기록을 덮지 않기 위해서다(`addEntry`와 같은 이유). 못 찾으면 `not_found`.
- 내용이 기존과 같으면 쓰지 않고 `{ ok: true, changed: false }`를 돌려준다. 이때 `updatedAt`을 남기지 않으므로 "(수정됨)"이 붙지 않는다.
- 바뀌었으면 `text`와 `updatedAt`(epoch ms)만 갱신한다. `date`·`time`·`createdAt`은 건드리지 않으므로 정렬 위치도 그대로다.
- **대안**: 기존 기록을 지우고 새로 추가 → `createdAt`이 바뀌어 위치가 달라지므로 요구사항에 어긋난다.

### 2. 화면 상태: `editingId` + `draft`
- `initDiaryApp` 안에 `editingId`(수정 중인 기록 id 또는 null)와 `draft`(입력 중인 내용)를 둔다.
- `renderList`는 `editingId`와 같은 항목을 입력창 + [저장]·[취소]로 그리고, 입력창 값에 `draft`를 넣는다. 수정 입력창의 `input` 이벤트마다 `draft`를 갱신한다.
- 이렇게 하면 수정 중에 상단 폼으로 새 기록을 저장해 목록을 다시 그려도 수정 상태와 입력 내용이 남는다. 다시 그린 뒤 포커스는 사용자가 방금 쓰던 상단 입력창에 그대로 둔다.
- **대안**: 수정 시작 시 DOM만 바꾸고 상태를 두지 않음 → 목록을 다시 그릴 때 입력 중인 수정 내용이 사라진다.

### 3. 이벤트 처리
- 목록 컨테이너 하나에 클릭 이벤트를 위임하고, 버튼의 `data-action`(`edit`/`save`/`cancel`)과 항목의 `data-id`로 구분한다. 다시 그릴 때마다 리스너를 붙였다 떼지 않아도 된다.
- 수정 입력창의 `keydown`: Enter는 저장, Esc는 취소. IME 조합 중(`isComposing` 또는 `keyCode === 229`)에는 둘 다 무시한다. 상단 입력창과 같은 규칙이다.
- 다른 기록의 [수정]을 누르면 `editingId`를 바꾸고 `draft`를 그 기록의 내용으로 새로 채운다. 이전 수정은 저장하지 않는다.

### 4. 메시지
- 경고와 저장 실패 안내는 기존의 상단 메시지 영역 하나를 같이 쓴다. 수정 줄 옆에 따로 두지 않는 이유는 메시지 영역을 한 곳으로 유지해 화면이 흔들리지 않게 하기 위해서다.
- 빈 내용 경고는 수정 입력창에 글자를 입력하면 지운다(상단 입력창과 같은 규칙).
- `not_found`는 저장 실패와 같은 오류 스타일로 "기록을 찾을 수 없습니다. 페이지를 새로고침해 주세요."를 보여 준다. 지금은 삭제 기능이 없어 거의 일어나지 않지만, 저장소가 다른 탭에서 지워진 경우를 대비한다.

### 5. "(수정됨)" 표시
- `updatedAt`이 있는 기록만 내용 뒤에 작은 회색 글씨로 "(수정됨)"을 붙인다.
- `title` 속성에 수정 시각을 `YYYY-MM-DD HH:mm`(로컬)로 넣어, 마우스를 올리면 언제 고쳤는지 볼 수 있게 한다.

### 6. 접근성
- [수정] 버튼에 `aria-label="<내용> 수정"`을 넣어 화면 낭독기에서 어떤 기록인지 구분되게 한다.
- 수정을 시작하면 입력창에 포커스를 주고 커서를 끝으로 둔다. 저장·취소 후에는 그 기록의 [수정] 버튼으로 포커스를 돌려준다.

## Risks / Trade-offs

- [목록 전체 다시 그리기로 수정 입력창의 커서 위치가 초기화될 수 있음] → 수정 중에는 다시 그리는 경우가 상단 폼 저장뿐이고, 이때 포커스는 상단 입력창에 있으므로 사용자가 느끼지 못한다.
- [두 탭에서 같은 기록을 동시에 수정하면 나중 저장이 이김] → 한 사람이 쓰는 다이어리라 받아들인다. 저장 직전 다시 읽기로 다른 기록이 사라지는 일은 막는다.
- [기존 기록에는 `updatedAt`이 없음] → 선택 필드로 다루므로 마이그레이션이 필요 없다.

## Migration Plan

데이터 마이그레이션은 없다. 기존 기록은 그대로 읽히고, 수정한 기록에만 `updatedAt`이 더해진다. 되돌릴 때는 이전 `app.js`로 바꾸면 되며, 남은 `updatedAt` 필드는 이전 코드가 무시한다.
