// 한글 타자 연습 게임
(() => {
  'use strict';

  // 연습에 사용할 문장 5개
  const SENTENCES = [
    '작은 습관이 모여 큰 변화를 만듭니다.',
    '오늘의 노력은 내일의 실력이 됩니다.',
    '천천히 정확하게 입력하는 연습부터 시작해요.',
    '새로운 것을 배우는 가장 좋은 방법은 직접 해보는 것입니다.',
    '꾸준한 연습은 자신감을 키우는 가장 확실한 길입니다.'
  ];

  const STORAGE_KEY = 'hangulTypingRecentRecords';
  const MAX_RECORDS = 5;

  const promptEl = document.getElementById('prompt');
  const inputEl = document.getElementById('typing-input');
  const statusEl = document.getElementById('status');
  const hintEl = document.getElementById('hint');
  const timeResultEl = document.getElementById('time-result');
  const cpmResultEl = document.getElementById('cpm-result');
  const accuracyResultEl = document.getElementById('accuracy-result');
  const restartButton = document.getElementById('restart-button');
  const historyBody = document.getElementById('history-body');
  const historyTable = document.getElementById('history-table');
  const historyEmpty = document.getElementById('history-empty');
  const historyCount = document.getElementById('history-count');

  let targetSentence = '';
  let startedAt = null;
  let finished = false;

  // 유니코드 정규 분해(NFD)를 이용해 한글 음절을 자모 단위로 셉니다.
  // 예: '가' -> ᄀ + ᅡ = 2타, '한' -> ᄒ + ᅡ + ᆫ = 3타
  // 공백과 문장부호도 각각 1타로 계산합니다.
  function countJamo(text) {
    return Array.from(text.normalize('NFD')).length;
  }

  // 입력한 문자열과 제시 문장을 정규 분해한 뒤, 앞에서부터 일치하는 비율을 계산합니다.
  // 한글 IME 조합 중에도 입력값을 수정하지 않고 읽기만 하므로 조합이 끊기지 않습니다.
  function calculateAccuracy(typed, target) {
    const typedUnits = Array.from(typed.normalize('NFD'));
    const targetUnits = Array.from(target.normalize('NFD'));
    if (typedUnits.length === 0) return 100;

    let matched = 0;
    for (let i = 0; i < Math.min(typedUnits.length, targetUnits.length); i += 1) {
      if (typedUnits[i] === targetUnits[i]) matched += 1;
    }

    // 입력한 자모 수를 기준으로 정확도를 계산하며, 목표 길이를 초과한 입력도 오답으로 반영합니다.
    return Math.max(0, Math.round((matched / Math.max(typedUnits.length, targetUnits.length)) * 100));
  }

  function elapsedSeconds() {
    if (startedAt === null) return 0;
    return Math.max(0, (performance.now() - startedAt) / 1000);
  }

  function updateLiveResults() {
    const seconds = elapsedSeconds();
    const typed = inputEl.value;
    const cpm = seconds > 0 ? Math.round(countJamo(typed) / (seconds / 60)) : 0;

    timeResultEl.textContent = `${seconds.toFixed(1)}초`;
    cpmResultEl.textContent = Number.isFinite(cpm) ? cpm.toLocaleString('ko-KR') : '0';
    accuracyResultEl.textContent = `${calculateAccuracy(typed, targetSentence)}%`;
  }

  function loadRecords() {
    // 저장 데이터가 손상되었거나 브라우저 저장소 사용이 불가능한 경우를 대비합니다.
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.slice(0, MAX_RECORDS) : [];
    } catch (error) {
      return [];
    }
  }

  function saveRecord(record) {
    const records = loadRecords();
    records.unshift(record);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
    } catch (error) {
      // 저장 공간 제한 또는 브라우저 설정으로 저장할 수 없어도 게임은 계속됩니다.
    }
    renderHistory();
  }

  function renderHistory() {
    const records = loadRecords();
    historyBody.replaceChildren();
    historyCount.textContent = `${records.length} / ${MAX_RECORDS}`;
    historyEmpty.hidden = records.length > 0;
    historyTable.hidden = records.length === 0;

    records.forEach((record) => {
      const row = document.createElement('tr');
      const values = [
        record.date,
        `${Number(record.seconds).toFixed(1)}초`,
        Number(record.cpm).toLocaleString('ko-KR'),
        `${record.accuracy}%`
      ];

      values.forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.appendChild(cell);
      });
      historyBody.appendChild(row);
    });
  }

  function finishGame() {
    if (finished) return;
    finished = true;
    const seconds = elapsedSeconds();
    const accuracy = calculateAccuracy(inputEl.value, targetSentence);
    const cpm = seconds > 0 ? Math.round(countJamo(inputEl.value) / (seconds / 60)) : 0;

    timeResultEl.textContent = `${seconds.toFixed(1)}초`;
    cpmResultEl.textContent = cpm.toLocaleString('ko-KR');
    accuracyResultEl.textContent = `${accuracy}%`;
    statusEl.textContent = '완료';
    statusEl.classList.add('done');
    hintEl.textContent = '완료했습니다! 다시하기를 눌러 새 문장에 도전하세요.';
    inputEl.disabled = true;

    saveRecord({
      date: new Date().toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      seconds,
      cpm,
      accuracy
    });
  }

  function startNewRound() {
    // 직전 문장과 같은 문장이 연속으로 나오지 않도록 가능하면 제외합니다.
    const choices = SENTENCES.filter((sentence) => sentence !== targetSentence);
    const pool = choices.length ? choices : SENTENCES;
    targetSentence = pool[Math.floor(Math.random() * pool.length)];

    startedAt = null;
    finished = false;
    promptEl.textContent = targetSentence;
    inputEl.value = '';
    inputEl.disabled = false;
    statusEl.textContent = '준비';
    statusEl.classList.remove('done');
    hintEl.textContent = '시작하려면 입력창을 누르고 타이핑하세요.';
    timeResultEl.textContent = '0.0초';
    cpmResultEl.textContent = '0';
    accuracyResultEl.textContent = '100%';
    inputEl.focus();
  }

  // input 이벤트는 한글 IME 조합이 끝나기 전에도 발생할 수 있습니다.
  // 입력값을 자동 교정하거나 커서를 이동하지 않고, 현재 값을 읽어 결과만 갱신합니다.
  inputEl.addEventListener('input', () => {
    if (finished) return;

    if (startedAt === null && inputEl.value.length > 0) {
      startedAt = performance.now();
      statusEl.textContent = '연습 중';
      hintEl.textContent = '문장을 끝까지 입력하면 자동으로 기록됩니다.';
    }

    updateLiveResults();

    // 정확히 일치할 때만 완료 처리합니다. 조합 중 입력값도 그대로 유지합니다.
    if (inputEl.value === targetSentence) {
      finishGame();
    }
  });

  restartButton.addEventListener('click', startNewRound);

  renderHistory();
  startNewRound();
})();
