# 오늘 할 일

응원하는 캐릭터와 함께 쓰는 할 일 앱이에요. 할 일은 [Supabase](https://supabase.com) 데이터베이스에 저장돼요.

![오늘 할 일 앱 화면](docs/screenshot.png)

## 기능

- 할 일 추가, 완료 표시, 삭제
- 할 일 글자를 두 번 눌러 고치기 (Enter 저장, Esc 취소)
- 작성자 이름 적기 (안 적어도 돼요. 적은 이름은 브라우저에 기억돼요)
- 마감일 정하기 (안 정해도 돼요)
  - 마감이 가까운 순서로 정렬하고, 마감일이 없는 할 일은 맨 아래에 보여요
  - `D-3`, `D-day`, `D+2`처럼 남은 날짜를 보여 주고, 마감이 가깝거나 지나면 색으로 알려 줘요
- 전체·진행 중·완료 보기와 남은 할 일 개수
- 진행률 바와 응원 캐릭터
  - 할 일을 완료하면 캐릭터가 점프해요
  - 모두 끝내면 웃는 얼굴로 바뀌어요
- 오류가 나면 입력칸 아래에 이유를 보여 줘요

## 사용한 기술

- HTML, CSS, JavaScript (빌드 도구 없이 바로 실행)
- [Supabase](https://supabase.com): 데이터베이스
- [supabase-js](https://github.com/supabase/supabase-js) v2: CDN으로 불러와요

## 파일 구성

| 파일 | 설명 |
|---|---|
| `index.html` | 화면 구조와 응원 캐릭터(SVG 그림) |
| `app.js` | 할 일 불러오기·저장, 보기 선택, 정렬, 고치기 |
| `style.css` | 화면 모양, 캐릭터 색과 움직임, 어두운 모드 |
| `config.js` | Supabase 주소와 publishable key |
| `.mcp.json` | Claude Code에서 Supabase에 접속하는 설정 (토큰 없이 브라우저 로그인) |
| `docs/screenshot.png` | README에 쓰는 화면 사진 |

## 실행 방법

1. 저장소를 내려받아요.
   ```bash
   git clone https://github.com/mg222091321-cyber/todo-app.git
   cd todo-app
   ```
2. 로컬 서버를 켜요. (Python이 필요해요)
   ```bash
   python -m http.server 5500
   ```
3. 브라우저에서 http://localhost:5500 을 열어요.

다른 Supabase 프로젝트를 쓰려면 `config.js`의 주소와 publishable key를 바꾸고, 아래 SQL로 표를 만들어요.

## 데이터베이스 구조

할 일은 `todos` 표 하나에 저장돼요.

| 칸 | 종류 | 설명 |
|---|---|---|
| `id` | 숫자 (자동 증가) | 할 일 고유 번호 |
| `text` | 글자, 필수 | 할 일 내용 (빈칸 불가) |
| `done` | 참/거짓, 기본값 거짓 | 완료 여부 |
| `created_at` | 날짜·시간, 기본값 지금 | 만든 시각 |
| `author_name` | 글자, 선택 | 작성자 이름 (30자 이하) |
| `due_date` | 날짜, 선택 | 마감일 |
| `user_id` | uuid, 선택 | 지금은 쓰지 않아요 (예전 로그인 기능을 위해 만든 칸) |

처음부터 새로 만들 때는 Supabase SQL Editor에서 아래를 실행하면 돼요. 쓰지 않는 `user_id` 칸은 뺐어요.

```sql
create table public.todos (
  id bigint generated always as identity primary key,
  text text not null check (length(trim(text)) > 0),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  author_name text check (
    author_name is null
    or (length(trim(author_name)) > 0 and char_length(author_name) <= 30)
  ),
  due_date date
);

alter table public.todos enable row level security;

create policy "Anyone can view todos" on public.todos
  for select to anon, authenticated using (true);
create policy "Anyone can create todos" on public.todos
  for insert to anon, authenticated with check (true);
create policy "Anyone can update todos" on public.todos
  for update to anon, authenticated using (true) with check (true);
create policy "Anyone can delete todos" on public.todos
  for delete to anon, authenticated using (true);
```

## 보안 주의

- **연습용 설정이에요.** 지금 권한 규칙은 로그인 없이 **누구나 할 일을 읽고, 추가하고, 고치고, 지울 수 있어요.** 모르는 사람이 쓸 수 있는 곳에 공개하기 전에는 로그인을 붙여서 자기 할 일만 다루게 하는 등 권한을 좁혀야 해요.
- **`config.js`의 publishable key는 공개돼도 되는 열쇠예요.** 실제로 무엇을 할 수 있는지는 위의 권한 규칙이 정해요.
- **`sb_secret_…`로 시작하는 secret key는 절대 이 저장소나 브라우저 코드에 넣지 마세요.** 이 열쇠는 권한 규칙을 무시해요.
- 할 일 내용에는 글자 수 제한이 없어요.
