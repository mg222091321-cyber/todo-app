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

let todos = [];

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

async function load() {
  const { data, error } = await db
    .from("todos")
    .select("id, text, done, author_name")
    .order("created_at")
    .order("id");
  if (error) return showError("할 일을 불러오지", error);
  clearError();
  todos = data;
  render();
}

function render() {
  list.innerHTML = "";

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");

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

    li.append(checkbox, text, del);
    list.append(li);
  }

  const doneCount = todos.filter((t) => t.done).length;
  const percent = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;
  counter.textContent = `${doneCount}/${todos.length} 완료`;
  progressFill.style.width = `${percent}%`;
  progressBar.setAttribute("aria-valuenow", percent);
  empty.hidden = todos.length > 0;

  updateMascot(doneCount);
}

function updateMascot(doneCount) {
  const left = todos.length - doneCount;
  let message;
  if (todos.length === 0) message = "오늘은 뭘 할까요? 적어 주세요!";
  else if (left === 0) message = "모두 완료! 정말 대단해요 🎉";
  else if (doneCount === 0) message = "화이팅! 하나씩 해봐요 ✨";
  else message = `좋아요! ${left}개만 더 하면 돼요 💪`;

  mascot.classList.toggle("happy", todos.length > 0 && left === 0);

  if (bubble.textContent !== message) {
    bubble.textContent = message;
    replay(bubble, "pop");
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
  const { data, error } = await db
    .from("todos")
    .insert({ text, author_name })
    .select("id, text, done, author_name")
    .single();
  button.disabled = false;
  if (error) return showError("할 일을 추가하지", error);

  clearError();
  todos.push(data);
  input.value = "";
  render();
});

render();
load();
