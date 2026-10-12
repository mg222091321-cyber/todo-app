const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const AUTHOR_KEY = "author-name";

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const counter = document.getElementById("counter");
const empty = document.getElementById("empty");
const progressFill = document.getElementById("progress-fill");
const progressBar = progressFill.parentElement;
const mascot = document.getElementById("mascot");
const bubble = document.getElementById("bubble");
const errorBox = document.getElementById("error");
const authorInput = document.getElementById("author-input");
const dueInput = document.getElementById("due-input");
const filterButtons = document.querySelectorAll(".filter");
const remaining = document.getElementById("remaining");

const COLUMNS = "id, text, done, author_name, due_date";
const DAY_MS = 24 * 60 * 60 * 1000;

const FILTERS = {
  all: { show: () => true, empty: "할 일이 없어요. 위에 입력해 보세요!" },
  active: { show: (t) => !t.done, empty: "진행 중인 할 일이 없어요." },
  done: { show: (t) => t.done, empty: "완료한 할 일이 없어요." },
};

let todos = [];
let filter = "all";

// 할 일 뽑기: 캐릭터를 누르면 룰렛처럼 돌다가 진행 중인 할 일 하나를 골라 준다
let pickedId = null;
let spinning = false;
let flash = null; // 잠깐 보여 줄 말풍선 문구
let flashTimer = null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const CONFETTI_COLORS = ["#ff6fa5", "#9f7aea", "#ffd166", "#6fd3ff", "#7be0a5"];

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    render();
  });
}

// 이름은 이 브라우저에만 기억한다. 저장이 막힌 환경에서는 매번 새로 적으면 된다
try {
  authorInput.value = localStorage.getItem(AUTHOR_KEY) || "";
} catch {}

authorInput.addEventListener("input", () => {
  try {
    localStorage.setItem(AUTHOR_KEY, authorInput.value.trim());
  } catch {}
});

function showError(action, error) {
  errorBox.textContent = `${action} 못했어요: ${error.message}`;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
}

// 권한 규칙에 막힌 수정·삭제는 오류 없이 0줄만 바뀌므로 직접 오류로 바꾼다
function requireRows(data, error) {
  if (error) return error;
  if (!data.length) return { message: "권한이 없거나 이미 사라진 할 일이에요" };
  return null;
}

// 마감이 가까운 순서, 마감이 없으면 맨 아래, 같으면 먼저 만든 순서.
// due_date는 "YYYY-MM-DD" 문자열이라 글자 비교가 곧 날짜 비교다
function byDueDate(a, b) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return a.id - b.id;
}

// 마감일까지 남은 날짜 수. 시간대 차이로 하루가 어긋나지 않게 날짜만 UTC로 비교한다
function daysLeft(dueDate) {
  const [y, m, d] = dueDate.split("-").map(Number);
  const now = new Date();
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY_MS
  );
}

function dueLabel(dueDate) {
  const [, m, d] = dueDate.split("-").map(Number);
  const left = daysLeft(dueDate);
  const tag = left === 0 ? "D-day" : left > 0 ? `D-${left}` : `D+${-left}`;
  return { text: `${m}/${d} ${tag}`, left };
}

async function load() {
  const { data, error } = await db
    .from("todos")
    .select(COLUMNS)
    .order("due_date", { nullsFirst: false })
    .order("id");
  if (error) return showError("할 일을 불러오지", error);
  clearError();
  todos = data;
  render();
}

function render() {
  list.innerHTML = "";
  todos.sort(byDueDate);
  const visible = todos.filter(FILTERS[filter].show);

  for (const todo of visible) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");
    if (todo.id === pickedId && !todo.done) li.classList.add("picked");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.setAttribute("aria-label", "완료 표시");
    checkbox.addEventListener("change", async () => {
      checkbox.disabled = true;
      const { data, error } = await db
        .from("todos")
        .update({ done: checkbox.checked })
        .eq("id", todo.id)
        .select("id");
      const failure = requireRows(data, error);
      if (failure) {
        checkbox.checked = todo.done;
        checkbox.disabled = false;
        return showError("완료 표시를 바꾸지", failure);
      }
      clearError();
      todo.done = checkbox.checked;
      if (todo.done) replay(mascot, "jump");
      if (todo.done && todo.id === pickedId) {
        pickedId = null;
        celebrate(checkbox);
        showFlash("뽑기 미션 성공! 최고예요 🎉");
      }
      render();
    });

    const text = document.createElement("span");
    text.className = "text";
    if (todo.author_name) {
      const author = document.createElement("strong");
      author.className = "author";
      author.textContent = `${todo.author_name}: `;
      text.append(author);
    }
    text.append(todo.text);
    text.title = "두 번 누르면 고칠 수 있어요";
    text.addEventListener("dblclick", () => startEdit(todo, text));

    const due = document.createElement("span");
    if (todo.due_date) {
      const label = dueLabel(todo.due_date);
      due.className = "due";
      if (!todo.done && label.left < 0) due.classList.add("overdue");
      else if (!todo.done && label.left <= 1) due.classList.add("soon");
      due.textContent = label.text;
      due.title = `마감일 ${todo.due_date}`;
    }

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "✕";
    del.setAttribute("aria-label", "삭제");
    del.addEventListener("click", async () => {
      del.disabled = true;
      const { data, error } = await db.from("todos").delete().eq("id", todo.id).select("id");
      const failure = requireRows(data, error);
      if (failure) {
        del.disabled = false;
        return showError("할 일을 지우지", failure);
      }
      clearError();
      todos = todos.filter((t) => t.id !== todo.id);
      render();
    });

    li.append(checkbox, text);
    if (todo.due_date) li.append(due);
    li.append(del);
    list.append(li);
  }

  const doneCount = todos.filter((t) => t.done).length;
  const percent = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;
  counter.textContent = `${doneCount}/${todos.length} 완료`;
  progressFill.style.width = `${percent}%`;
  progressBar.setAttribute("aria-valuenow", percent);
  remaining.textContent = `남은 할 일 ${todos.length - doneCount}개`;
  empty.textContent = FILTERS[filter].empty;
  empty.hidden = visible.length > 0;
  for (const button of filterButtons) {
    button.setAttribute("aria-pressed", button.dataset.filter === filter);
  }

  updateMascot(doneCount);
}

// 할 일 글자를 입력칸으로 바꿔 고친다. Enter·포커스 이동은 저장, Esc는 취소
function startEdit(todo, textEl) {
  const field = document.createElement("input");
  field.type = "text";
  field.className = "edit";
  field.value = todo.text;
  field.setAttribute("aria-label", "할 일 고치기");
  textEl.replaceWith(field);
  field.focus();
  field.select();

  let busy = false;
  let finished = false;

  async function finish(save) {
    if (busy || finished) return;
    const next = field.value.trim();
    // 비우거나 그대로면 저장할 게 없으니 원래 글자로 돌아간다
    if (!save || !next || next === todo.text) {
      finished = true;
      return render();
    }

    busy = true;
    field.disabled = true;
    const { data, error } = await db
      .from("todos")
      .update({ text: next })
      .eq("id", todo.id)
      .select("id");
    busy = false;
    const failure = requireRows(data, error);
    if (failure) {
      field.disabled = false;
      field.focus();
      return showError("할 일을 고치지", failure);
    }
    finished = true;
    clearError();
    todo.text = next;
    render();
  }

  field.addEventListener("keydown", (e) => {
    // 한글을 조합하는 중의 Enter는 글자 확정용이라 저장하지 않는다
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      finish(false);
    }
  });
  field.addEventListener("blur", () => finish(true));
}

function updateMascot(doneCount) {
  const left = todos.length - doneCount;
  const picked = todos.find((t) => t.id === pickedId && !t.done);
  let message;
  if (flash) message = flash;
  else if (picked) message = `🎯 "${shorten(picked.text)}" 먼저 해 볼까요?`;
  else if (todos.length === 0) message = "오늘은 뭘 할까요? 적어 주세요!";
  else if (left === 0) message = "모두 완료! 정말 대단해요 🎉";
  else if (doneCount === 0) message = "화이팅! 하나씩 해봐요 ✨";
  else message = `좋아요! ${left}개만 더 하면 돼요 💪`;

  mascot.classList.toggle("happy", todos.length > 0 && left === 0);

  if (spinning) return;
  if (bubble.textContent !== message) {
    bubble.textContent = message;
    replay(bubble, "pop");
  }
}

function shorten(text, max = 18) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function showFlash(message) {
  flash = message;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash = null;
    render();
  }, 3000);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function spin() {
  if (spinning) return;
  const candidates = todos.filter((t) => !t.done);
  if (!candidates.length) {
    showFlash(todos.length ? "다 끝냈는데요? 뽑을 게 없어요 😎" : "뽑을 할 일이 없어요! 먼저 적어 주세요");
    return render();
  }

  const winner = candidates[Math.floor(Math.random() * candidates.length)];
  pickedId = null;
  flash = null;
  render();

  // 처음엔 빠르게, 점점 느려지며 후보를 넘겨 보다가 당첨된 할 일에서 멈춘다
  if (!reducedMotion && candidates.length > 1) {
    spinning = true;
    mascot.classList.add("spinning");
    let i = Math.floor(Math.random() * candidates.length);
    for (let delay = 50; delay < 280; delay *= 1.12) {
      bubble.textContent = `🎲 ${shorten(candidates[i++ % candidates.length].text)}`;
      await sleep(delay);
    }
    mascot.classList.remove("spinning");
    spinning = false;
  }

  pickedId = winner.id;
  replay(mascot, "jump");
  render();
}

mascot.addEventListener("click", spin);
mascot.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    spin();
  }
});

// 체크박스 자리에서 색종이를 사방으로 터뜨린다
function celebrate(fromEl) {
  if (reducedMotion) return;
  const { left, top, width, height } = fromEl.getBoundingClientRect();
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 90;
    piece.style.left = `${left + width / 2}px`;
    piece.style.top = `${top + height / 2}px`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--dy", `${Math.sin(angle) * distance - 40}px`);
    piece.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    document.body.append(piece);
    setTimeout(() => piece.remove(), 1100);
  }
}

// 같은 애니메이션을 다시 재생하기 위해 클래스를 뗐다 붙인다
function replay(el, className) {
  el.classList.remove(className);
  el.getBoundingClientRect(); // SVG에는 offsetWidth가 없어서 이걸로 리플로우를 일으킨다
  el.classList.add(className);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  const button = form.querySelector("button");
  button.disabled = true;
  const author_name = authorInput.value.trim() || null;
  const due_date = dueInput.value || null;
  const { data, error } = await db
    .from("todos")
    .insert({ text, author_name, due_date })
    .select(COLUMNS)
    .single();
  button.disabled = false;
  if (error) return showError("할 일을 추가하지", error);

  clearError();
  todos.push(data);
  input.value = "";
  dueInput.value = "";
  render();
});

render();
load();
