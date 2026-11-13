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

    function renderList(entries) {
      listEl.textContent = '';
      if (entries.length === 0) {
        var empty = doc.createElement('li');
        empty.className = 'px-4 py-6 text-center text-sm text-stone-400';
        empty.textContent = '아직 기록이 없습니다. 첫 한 줄을 남겨 보세요.';
        listEl.appendChild(empty);
        return;
      }
      sortNewestFirst(entries).forEach(function (entry) {
        var li = doc.createElement('li');
        li.className = 'flex gap-3 px-4 py-3';

        var meta = doc.createElement('span');
        meta.className = 'shrink-0 text-sm tabular-nums text-stone-400';
        meta.textContent = entry.date + ' ' + entry.time;

        var text = doc.createElement('span');
        text.className = 'min-w-0 break-words';
        text.textContent = entry.text; // 사용자 입력은 HTML로 해석하지 않는다.

        li.appendChild(meta);
        li.appendChild(text);
        listEl.appendChild(li);
      });
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
      input.focus();
      renderList(result.entries);
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
