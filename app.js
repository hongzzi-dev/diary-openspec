/* 한 줄 다이어리 - 날짜·저장 로직(DiaryCore)과 화면 연결(initDiaryApp)을 나눈다. */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'diary.entries.v1';
  var MAX_LENGTH = 100;

  // ---- 날짜·시간 (로컬 기준, toISOString 사용 금지: UTC라 날짜가 어긋난다) ----

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function formatTime(d) {
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // ---- 저장소 ----

  function loadEntries(storage) {
    var raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (e) {
      return [];
    }
    if (raw == null) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function makeId(now) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return now.getTime().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /**
   * 기록 하나를 추가한다.
   * @returns {{ok: true, entry: object, entries: object[]} | {ok: false, error: 'empty' | 'storage'}}
   */
  function addEntry(storage, text, now) {
    var trimmed = String(text == null ? '' : text).trim();
    if (trimmed === '') return { ok: false, error: 'empty' };
    if (trimmed.length > MAX_LENGTH) trimmed = trimmed.slice(0, MAX_LENGTH);

    now = now || new Date();
    var entry = {
      id: makeId(now),
      date: formatDate(now),
      time: formatTime(now),
      text: trimmed,
      createdAt: now.getTime()
    };

    // 다른 탭에서 저장한 기록을 덮어쓰지 않도록 저장 직전에 다시 읽는다.
    var entries = loadEntries(storage).concat([entry]);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      return { ok: false, error: 'storage' };
    }
    return { ok: true, entry: entry, entries: entries };
  }

  /**
   * 기록 하나의 내용을 고친다. 작성 날짜·시간·createdAt(목록 위치)은 바꾸지 않는다.
   * @returns {{ok: true, changed: boolean, entry: object, entries: object[]}
   *         | {ok: false, error: 'empty' | 'not_found' | 'storage'}}
   */
  function updateEntry(storage, id, text, now) {
    var trimmed = String(text == null ? '' : text).trim();
    if (trimmed === '') return { ok: false, error: 'empty' };
    if (trimmed.length > MAX_LENGTH) trimmed = trimmed.slice(0, MAX_LENGTH);

    // 다른 탭에서 저장한 기록을 덮어쓰지 않도록 저장 직전에 다시 읽는다.
    var entries = loadEntries(storage);
    var index = -1;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id === id) { index = i; break; }
    }
    if (index === -1) return { ok: false, error: 'not_found' };

    var current = entries[index];
    if (current.text === trimmed) {
      return { ok: true, changed: false, entry: current, entries: entries };
    }

    var updated = {};
    for (var key in current) {
      if (Object.prototype.hasOwnProperty.call(current, key)) updated[key] = current[key];
    }
    updated.text = trimmed;
    updated.updatedAt = (now || new Date()).getTime();

    var next = entries.slice();
    next[index] = updated;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      return { ok: false, error: 'storage' };
    }
    return { ok: true, changed: true, entry: updated, entries: next };
  }

  function sortNewestFirst(entries) {
    return entries.slice().sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  var DiaryCore = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_LENGTH: MAX_LENGTH,
    formatDate: formatDate,
    formatTime: formatTime,
    loadEntries: loadEntries,
    addEntry: addEntry,
    updateEntry: updateEntry,
    sortNewestFirst: sortNewestFirst
  };

  // ---- 화면 ----

  var MESSAGE_STYLES = {
    warning: 'bg-amber-100 text-amber-900',
    error: 'bg-red-100 text-red-900'
  };

  function getStorage() {
    try {
      return global.localStorage;
    } catch (e) {
      // 일부 브라우저 설정에서는 localStorage 접근 자체가 예외를 던진다.
      return {
        getItem: function () { return null; },
        setItem: function () { throw new Error('storage unavailable'); }
      };
    }
  }

  function initDiaryApp(doc) {
    var storage = getStorage();
    var todayEl = doc.getElementById('today');
    var form = doc.getElementById('entry-form');
    var input = doc.getElementById('entry-input');
    var messageEl = doc.getElementById('message');
    var listEl = doc.getElementById('entry-list');

    function showMessage(text, kind) {
      messageEl.textContent = text;
      messageEl.className = 'mt-2 rounded-md px-3 py-2 text-sm ' + MESSAGE_STYLES[kind];
      messageEl.dataset.kind = kind;
    }

    function clearMessage() {
      messageEl.textContent = '';
      messageEl.className = 'mt-2 hidden rounded-md px-3 py-2 text-sm';
      delete messageEl.dataset.kind;
    }

    // 수정 상태. 목록을 다시 그려도(예: 수정 중 새 기록 저장) 입력 중인 내용이 남도록 DOM 밖에 둔다.
    var editingId = null;
    var draft = '';

    var SMALL_BUTTON = 'shrink-0 rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-stone-400';

    function makeButton(action, label, style) {
      var button = doc.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.className = SMALL_BUTTON + ' ' + style;
      button.textContent = label;
      return button;
    }

    function formatDateTime(ms) {
      var d = new Date(ms);
      return formatDate(d) + ' ' + formatTime(d);
    }

    function renderList(entries) {
      listEl.textContent = '';
      if (entries.length === 0) {
        editingId = null;
        var empty = doc.createElement('li');
        empty.className = 'px-4 py-6 text-center text-sm text-stone-400';
        empty.textContent = '아직 기록이 없습니다. 첫 한 줄을 남겨 보세요.';
        listEl.appendChild(empty);
        return;
      }
      var sorted = sortNewestFirst(entries);
      if (editingId !== null && !sorted.some(function (e) { return e.id === editingId; })) {
        editingId = null;
      }
      sorted.forEach(function (entry) {
        var li = doc.createElement('li');
        li.className = 'flex items-center gap-3 px-4 py-3';
        li.dataset.id = entry.id;

        var meta = doc.createElement('span');
        meta.className = 'shrink-0 text-sm tabular-nums text-stone-400';
        meta.textContent = entry.date + ' ' + entry.time;
        li.appendChild(meta);

        if (entry.id === editingId) {
          var editInput = doc.createElement('input');
          editInput.type = 'text';
          editInput.maxLength = MAX_LENGTH;
          editInput.autocomplete = 'off';
          editInput.value = draft;
          editInput.dataset.role = 'edit-input';
          editInput.setAttribute('aria-label', '기록 내용 수정');
          editInput.className = 'min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-300';
          li.appendChild(editInput);
          li.appendChild(makeButton('save', '저장', 'bg-stone-800 text-white hover:bg-stone-700'));
          li.appendChild(makeButton('cancel', '취소', 'border border-stone-300 text-stone-600 hover:bg-stone-100'));
        } else {
          var text = doc.createElement('span');
          text.className = 'min-w-0 flex-1 break-words';
          text.textContent = entry.text; // 사용자 입력은 HTML로 해석하지 않는다.
          if (entry.updatedAt) {
            var edited = doc.createElement('span');
            edited.className = 'ml-1 text-xs text-stone-400';
            edited.textContent = '(수정됨)';
            edited.title = '수정: ' + formatDateTime(entry.updatedAt);
            text.appendChild(edited);
          }
          li.appendChild(text);
          var editButton = makeButton('edit', '수정', 'text-stone-500 hover:bg-stone-100 hover:text-stone-800');
          editButton.setAttribute('aria-label', entry.text + ' 수정');
          li.appendChild(editButton);
        }
        listEl.appendChild(li);
      });
    }

    function findItem(id) {
      var items = listEl.querySelectorAll('li[data-id]');
      for (var i = 0; i < items.length; i++) {
        if (items[i].dataset.id === id) return items[i];
      }
      return null;
    }

    function focusEditInput() {
      var item = editingId !== null ? findItem(editingId) : null;
      var field = item && item.querySelector('[data-role="edit-input"]');
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }

    function focusEditButton(id) {
      var item = findItem(id);
      var button = item && item.querySelector('[data-action="edit"]');
      if (button) button.focus();
    }

    function startEdit(id) {
      var entries = loadEntries(storage);
      var target = null;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].id === id) { target = entries[i]; break; }
      }
      if (!target) {
        showMessage('기록을 찾을 수 없습니다. 페이지를 새로고침해 주세요.', 'error');
        return;
      }
      // 다른 기록을 수정하던 중이면 그 수정은 저장하지 않고 버린다.
      editingId = id;
      draft = target.text;
      clearMessage();
      renderList(entries);
      focusEditInput();
    }

    function cancelEdit() {
      var id = editingId;
      editingId = null;
      draft = '';
      clearMessage();
      renderList(loadEntries(storage));
      focusEditButton(id);
    }

    function saveEdit() {
      var id = editingId;
      var result = updateEntry(storage, id, draft, new Date());
      if (!result.ok) {
        if (result.error === 'empty') {
          showMessage('내용을 입력해 주세요.', 'warning');
        } else if (result.error === 'not_found') {
          showMessage('기록을 찾을 수 없습니다. 페이지를 새로고침해 주세요.', 'error');
        } else {
          showMessage('저장하지 못했습니다. 브라우저 저장 공간이나 설정을 확인해 주세요.', 'error');
        }
        focusEditInput();
        return;
      }
      editingId = null;
      draft = '';
      clearMessage();
      renderList(result.entries);
      focusEditButton(id);
    }

    todayEl.textContent = formatDate(new Date());
    renderList(loadEntries(storage));

    // 한글 등 IME 조합 중 Enter는 조합 확정용이므로 제출하지 않는다.
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.isComposing || e.keyCode === 229)) {
        e.preventDefault();
      }
    });

    input.addEventListener('input', function () {
      if (messageEl.dataset.kind === 'warning') clearMessage();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var result = addEntry(storage, input.value, new Date());
      if (!result.ok) {
        if (result.error === 'empty') {
          showMessage('내용을 입력해 주세요.', 'warning');
        } else {
          showMessage('저장하지 못했습니다. 브라우저 저장 공간이나 설정을 확인해 주세요.', 'error');
        }
        input.focus();
        return;
      }
      clearMessage();
      input.value = '';
      renderList(result.entries); // 수정 중인 기록은 editingId·draft로 그대로 다시 그려진다.
      input.focus();
    });

    listEl.addEventListener('click', function (e) {
      var button = e.target.closest('button[data-action]');
      if (!button || !listEl.contains(button)) return;
      var item = button.closest('li[data-id]');
      var action = button.dataset.action;
      if (action === 'edit' && item) startEdit(item.dataset.id);
      else if (action === 'save') saveEdit();
      else if (action === 'cancel') cancelEdit();
    });

    listEl.addEventListener('keydown', function (e) {
      if (!e.target.matches || !e.target.matches('[data-role="edit-input"]')) return;
      if (e.isComposing || e.keyCode === 229) {
        // IME 조합 중 Enter·Esc는 조합 확정·취소용이다.
        if (e.key === 'Enter') e.preventDefault();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });

    listEl.addEventListener('input', function (e) {
      if (!e.target.matches || !e.target.matches('[data-role="edit-input"]')) return;
      draft = e.target.value;
      if (messageEl.dataset.kind === 'warning') clearMessage();
    });
  }

  global.DiaryCore = DiaryCore;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiaryCore;
  }
  if (typeof document !== 'undefined') {
    initDiaryApp(document);
  }
})(typeof window !== 'undefined' ? window : globalThis);
