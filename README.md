# Habit Plan Fact Tracker

Личный аналитический центр развития: план/факт привычек, цели, сферы жизни, дневной ввод, заметки, отчеты, финансы, здоровье, авто, работа, эксперименты, таймлайн, личная доска задач и командный контур.

Проект не использует AI API. OpenAI, AI SDK, LangChain и внешние LLM не подключены. Все рекомендации и выводы считаются локально rule-based функциями.

## Стек

- Next.js App Router, React, TypeScript
- Tailwind CSS, shadcn/ui-style компоненты
- Supabase Auth и Supabase Database
- Recharts
- React Hook Form, Zod
- date-fns
- Vitest
- PWA: manifest, service worker, offline fallback, install prompt

## Основные разделы

- `/dashboard` — центр управления: темп месяца, следующий лучший шаг, сферы жизни, риски, цели, финансы, здоровье, авто, работа.
- `/daily` — быстрый дневной ввод факта, причины невыполнения, дневная заметка, энергия, отмена последнего изменения.
- `/planner` — месяцы, категории, задачи, веса, генерация и утверждение плана.
- `/growth` — индекс развития по сферам жизни.
- `/goals` — цели, прогресс, зачем, версия себя, связь с регулярными задачами.
- `/tasks` — личная доска задач с привязкой к целям, привычкам и месяцу.
- `/analytics`, `/weekly`, `/monthly-report`, `/history` — аналитика, недельный разбор, месячный отчет, история.
- `/experiments`, `/timeline` — эксперименты над собой и карта жизни.
- `/finance`, `/health`, `/car`, `/work` — практические контуры.
- `/team` — командный слой поверх личных планов.
- `/notes`, `/checks`, `/settings` — заметки, качество данных, настройки.

## Supabase

В проекте используются миграции из `supabase/migrations`. Применяйте их по порядку.

Ключевые группы таблиц:

- база трекера: `profiles`, `categories`, `tasks`, `months`, `daily_plans`, `daily_facts`, `daily_notes`;
- цели и развитие: `life_areas`, `goals`, `goal_tasks`;
- рефлексия: `notes`, `weekly_reviews`, `experiments`, `experiment_checkins`, `life_events`;
- практические контуры: `finance_snapshots`, `finance_goals`, `health_logs`, `cars`, `car_service_items`, `car_service_logs`, `work_projects`, `work_cases`, `work_skills`;
- личная доска: `personal_boards`, `personal_board_columns`, `personal_board_tasks`, `personal_board_comments`;
- команда: `teams`, `team_members`, `team_invites`, `team_goals`, `team_challenges`, `team_boards`;
- настройки: `user_preferences`, `change_logs`.

RLS включен на пользовательских таблицах. Запросы дополнительно фильтруются по `user_id` в server actions. Утвержденный план нельзя уменьшить, закрытый месяц защищает факты от случайного редактирования.

## Локальный запуск

1. Установите зависимости:

```bash
pnpm install
```

2. Создайте `.env.local`:

```bash
cp .env.example .env.local
```

3. Заполните переменные:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Примените SQL из `supabase/migrations` в Supabase SQL Editor.

5. Запустите приложение:

```bash
pnpm dev
```

6. Откройте:

```text
http://localhost:3000
```

## Телефон в одной Wi-Fi сети

Локальный запуск с телефона работает только пока ноутбук включен.

```bash
pnpm dev:lan
```

Или запустите файл:

```text
Запустить трекер для телефона.cmd
```

Открывайте на телефоне адрес вида:

```text
http://192.168.x.x:3000/daily
```

Если страница не открывается, проверьте, что телефон и ноутбук в одной Wi-Fi сети, а Windows Firewall разрешает Node.js для частной сети.

## Онлайн-деплой

Для доступа с телефона и для друзей, когда ноутбук выключен, нужен облачный деплой.

Подходит Netlify или Vercel:

1. Запушьте проект в GitHub.
2. Подключите репозиторий к Netlify/Vercel.
3. Build command:

```bash
pnpm run build
```

4. Для Netlify publish directory обычно:

```text
.next
```

5. Добавьте environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

6. В Supabase Auth добавьте домен сайта:

```text
https://your-site.netlify.app/**
```

или домен Vercel.

## PWA и уведомления

PWA файлы:

- `public/manifest.json`
- `public/sw.js`
- `public/icons/icon.svg`
- `public/icons/maskable.svg`
- `/offline`

Локальные browser notifications настраиваются в `/settings`. Они работают без backend worker, когда приложение открыто и браузер дал разрешение.

## Импорт и экспорт

В `/settings` есть:

- экспорт всех данных пользователя в JSON;
- экспорт выбранного месяца;
- импорт JSON с предварительной проверкой.

Импорт не должен использоваться как замена миграциям Supabase. Сначала применяются миграции, затем импортируются данные.

## Проверки качества

```bash
pnpm typecheck
pnpm test
pnpm build
```

В `package.json` сейчас нет отдельного `lint` script. TypeScript и production build являются обязательной проверкой перед публикацией.

Тесты покрывают:

- метрики план/факт;
- рекомендации;
- генератор планов;
- validators;
- growth;
- reflection;
- rhythm;
- team metrics;
- `Life Center`;
- практические расчеты finance/health/car.

Playwright e2e пока не настроен.

## Безопасность

- Используется Supabase Auth.
- Секретных service-role ключей в клиенте быть не должно.
- В `.env.local` хранится только публичный anon key Supabase.
- RLS ограничивает пользовательские данные.
- Server actions проверяют пользователя через `requireUser`.
- Командный доступ отделен от личного редактирования: участники видят общий прогресс, но не редактируют чужие личные планы.

## Roadmap

- Playwright smoke/e2e тесты.
- Offline queue для дневных фактов.
- Более глубокая синхронизация финансовых целей и обычных целей.
- Расширенные автособытия timeline.
- Push-уведомления через отдельный backend worker.
- PDF-экспорт отчетов.
