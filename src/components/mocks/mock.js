// モック専用。盤面と操作の部品を HTML に描く(本番では使わない)
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

// 入力したマス: { インデックス: 数字 }。誤りの数字は solution と違う値になる
const ENTERED = { 2: 4, 10: 7, 18: 5 };
// メモ: { インデックス: [数字] }
// 28 の 5 のメモは、選んだマス(誤りの 5)と同じ数字として強調する
const NOTES = { 3: [2, 6], 5: [2, 6, 8], 28: [2, 5] };
const SELECTED = 18;

const rowOf = (i) => Math.floor(i / 9);
const colOf = (i) => i % 9;
const blockOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
const related = (a, b) =>
  rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || blockOf(a) === blockOf(b);

function valueAt(i) {
  const given = Number(PUZZLE[i]);
  return given !== 0 ? given : (ENTERED[i] ?? 0);
}

function isWrong(i) {
  return ENTERED[i] !== undefined && ENTERED[i] !== Number(SOLUTION[i]);
}

function cellBackground(i, value) {
  if (i === SELECTED) return "bg-blue-200";
  const selectedValue = valueAt(SELECTED);
  const conflictsWithWrong = [...Array(81).keys()].some(
    (j) => isWrong(j) && j !== i && valueAt(j) === value && related(i, j),
  );
  if (isWrong(i) || (value !== 0 && conflictsWithWrong)) return "bg-red-100";
  if (value !== 0 && value === selectedValue) return "bg-blue-100";
  if (related(i, SELECTED)) return "bg-gray-100";
  return "bg-white";
}

function renderBoard(el, { hidden = false } = {}) {
  el.className = "relative grid aspect-square w-full grid-cols-9 border-2 border-gray-800 bg-white";
  el.setAttribute("role", "grid");
  el.setAttribute("aria-label", "数独の盤面");
  el.innerHTML = [...Array(81).keys()]
    .map((i) => {
      const value = hidden ? 0 : valueAt(i);
      const given = Number(PUZZLE[i]) !== 0;
      const wrong = !hidden && isWrong(i);
      const notes = hidden ? [] : (NOTES[i] ?? []);
      const right = colOf(i) === 8 ? "" : colOf(i) % 3 === 2 ? "border-r-2 border-r-gray-800" : "border-r border-r-gray-300";
      const bottom = rowOf(i) === 8 ? "" : rowOf(i) % 3 === 2 ? "border-b-2 border-b-gray-800" : "border-b border-b-gray-300";
      const bg = hidden ? "bg-white" : cellBackground(i, value);
      const ring = !hidden && i === SELECTED ? "outline outline-2 -outline-offset-2 outline-blue-700" : "";
      const text = given
        ? "font-bold text-gray-900"
        : wrong
          ? "font-medium text-red-700 underline underline-offset-2"
          : "font-medium text-blue-700";
      // 選んだマスと同じ数字のメモは、太字・青・丸で強調する
      const noteClass = (n) =>
        n === valueAt(SELECTED) ? "rounded-full bg-blue-200 font-bold text-blue-800" : "";
      const body = value
        ? `<span class="text-lg sm:text-2xl ${text}">${value}</span>`
        : `<span class="grid h-full w-full grid-cols-3 p-px text-[8px] leading-none text-gray-500 sm:text-[10px]">${[1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map((n) => `<span class="flex items-center justify-center ${notes.includes(n) ? noteClass(n) : ""}">${notes.includes(n) ? n : ""}</span>`)
            .join("")}</span>`;
      return `<div role="gridcell" class="flex aspect-square min-w-0 items-center justify-center ${right} ${bottom} ${bg} ${ring}">${body}</div>`;
    })
    .join("");
}

// 9 か所すべてに正解が入った数字
function completedDigits() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (n) => [...Array(81).keys()].filter((i) => valueAt(i) === n && !isWrong(i)).length === 9,
  );
}

function renderControls(el, { disabled = false, noteMode = false } = {}) {
  const completed = completedDigits();
  const state = disabled ? "disabled" : "";
  const dim = disabled ? "opacity-40" : "";
  const action = (label, extra = "bg-white") =>
    `<button ${state} class="h-12 min-w-0 rounded-lg border px-1 text-sm font-medium ${dim} ${extra}">${label}</button>`;
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((n) =>
      completed.includes(n)
        ? `<button disabled class="h-12 rounded-lg border border-gray-200 bg-gray-200 text-xl font-medium text-gray-400 md:h-16 ${dim}">${n}</button>`
        : `<button ${state} class="h-12 rounded-lg border bg-white text-xl font-medium md:h-16 ${dim}">${n}</button>`,
    )
    .join("");
  el.innerHTML = `
    <div class="grid grid-cols-4 gap-2 md:grid-cols-2">
      ${action("元に戻す")}
      ${action("やり直し", "bg-white text-gray-400")}
      ${action("消す")}
      ${action("メモ", noteMode ? "border-blue-700 bg-blue-700 text-white" : "bg-white")}
    </div>
    <div class="mt-2 grid grid-cols-5 gap-2 min-[480px]:grid-cols-9 md:grid-cols-3">${digits}</div>`;
}

function dialogHtml({ title, body, content = "", buttons }) {
  const buttonHtml = buttons
    .map(
      (b) =>
        `<button class="h-11 flex-1 rounded-lg border px-3 text-sm font-medium ${b.primary ? "border-blue-700 bg-blue-700 text-white" : "bg-white"}">${b.label}</button>`,
    )
    .join("");
  return `
    <div class="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
      <div role="alertdialog" aria-modal="true" aria-label="${title}" class="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 class="text-lg font-bold">${title}</h2>
        <p class="mt-2 text-sm text-gray-700">${body}</p>
        ${content}
        <div class="mt-5 flex gap-2">${buttonHtml}</div>
      </div>
    </div>`;
}

function renderHome(root, { showContinue = true, generating = false, dialog = null } = {}) {
  const state = generating ? "disabled" : "";
  const dim = generating ? "opacity-40" : "";
  const levels = ["かんたん", "ふつう", "むずかしい"]
    .map((l) => `<button ${state} class="h-14 rounded-lg border bg-white text-lg font-medium ${dim}">${l}</button>`)
    .join("");
  root.innerHTML = `
    <main class="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <h1 class="text-center text-3xl font-bold">数独パズル</h1>
      ${showContinue ? `<button ${state} class="h-14 rounded-lg bg-blue-700 text-lg font-medium text-white ${dim}">続きから(かんたん・12:34)</button>` : ""}
      <section class="flex flex-col gap-3">
        <h2 class="font-bold">新しいゲーム</h2>
        ${levels}
      </section>
      ${generating ? `<p role="status" class="text-center text-sm text-gray-700">問題を作っています…</p>` : ""}
      <a href="#" class="flex h-11 items-center justify-center font-medium text-blue-700 underline">成績</a>
    </main>
    ${dialog ? dialogHtml(dialog) : ""}`;
}

// noteMode: メモの状態(背景を薄い黄色にし、「メモ入力中」を出す)
// completeDigit: その数字の空欄をすべて正解で埋める(入れ終わった数字のボタンを見せる)
function renderPlay(root, { hidden = false, disabled = false, mistakes = 1, time = "12:34", pauseLabel = "一時停止", completeDigit = 0, noteMode = false } = {}) {
  if (completeDigit) {
    for (const i of Array(81).keys()) {
      if (Number(SOLUTION[i]) === completeDigit && Number(PUZZLE[i]) === 0) ENTERED[i] = completeDigit;
    }
  }
  root.innerHTML = `
    <main class="w-full flex-1 ${noteMode ? "bg-yellow-100" : ""}">
    <div class="mx-auto w-full max-w-4xl px-4 py-4">
      <header class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <a href="#" class="flex h-11 items-center font-medium text-blue-700 underline">ホーム</a>
        <span class="font-medium">かんたん</span>
        <span aria-live="polite">間違い ${mistakes}/3</span>
        <span class="tabular-nums">${time}</span>
        <button class="h-11 rounded-lg border bg-white px-3 font-medium">${pauseLabel}</button>
      </header>
      <div class="mt-2 grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <p role="status" class="h-5 text-center text-sm font-bold text-yellow-900">${noteMode ? "メモ入力中" : `<span class="sr-only">数字入力中</span>`}</p>
          <div class="relative mt-1">
            <div id="board"></div>
            <div id="overlay"></div>
          </div>
        </div>
        <div class="md:pt-6"><div id="controls"></div></div>
      </div>
    </div>
    </main>`;
  renderBoard(root.querySelector("#board"), { hidden });
  renderControls(root.querySelector("#controls"), { disabled, noteMode });
}
