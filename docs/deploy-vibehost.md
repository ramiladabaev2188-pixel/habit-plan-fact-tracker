# Деплой на VibeHost через Docker

Этот проект рассчитан на Docker-деплой Next.js в режиме `standalone`.

## Что выбрать в VibeHost

1. Откройте `Launchpad`.
2. Создайте проект.
3. Источник: `Git-репозиторий`.
4. URL репозитория:

```text
https://github.com/ramiladabaev2188-pixel/habit-plan-fact-tracker.git
```

5. Порт приложения: `3000`.
6. Если VibeHost использует Dockerfile из репозитория, build/run commands вручную не задавайте.

Dockerfile сам:

- ставит Node.js 20 на Debian, не Alpine;
- ставит только production-зависимости;
- собирает Next.js;
- запускает standalone server через `node server.js`.

## Переменные окружения

В проекте VibeHost откройте вкладку `Переменные` и добавьте:

```text
NEXT_PUBLIC_SUPABASE_URL=https://uknwpnyrcxmyytsiwdbl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ваш Supabase anon/publishable key>
SKIP_NEXT_BUILD_VALIDATION=1
```

`SKIP_NEXT_BUILD_VALIDATION=1` нужен только для constrained Docker build на VibeHost. Он отключает внутреннюю проверку TypeScript/ESLint во время `next build`, потому что эти проверки выполняются локально перед публикацией.

Если анализ VibeHost дополнительно просит тестовые переменные, их можно заполнить безопасными значениями. Они нужны только e2e-тестам и не используются приложением в production:

```text
NODE_ENV=production
E2E_BASE_URL=https://tracker-ramil.apps.vibehost.ru
E2E_EMAIL=not-used
E2E_PASSWORD=not-used
```

Сейчас в коде не используются:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `NEXT_PUBLIC_SITE_URL`;
- `APP_URL`;
- OpenAI / AI SDK / GigaChat ключи.

Не добавляйте secret/service role key в публичные переменные без необходимости.

## Supabase Auth URLs

В Supabase откройте `Authentication -> URL Configuration`.

Укажите:

```text
Site URL:
https://tracker-ramil.apps.vibehost.ru

Redirect URLs:
https://tracker-ramil.apps.vibehost.ru/**
http://localhost:3000/**
```

`localhost` нужен только для локальной разработки.

## Почему старые деплои падали

VibeHost free tier имеет жесткие лимиты CPU/RAM/disk во время Docker build.

Старые сборки падали из-за нескольких факторов:

- использовался Alpine, который тянул musl-зависимости Next.js;
- production build ставил dev-зависимости, включая Playwright;
- Next optional dependencies тянули `sharp` и лишние SWC-пакеты;
- в runtime stage копировался тяжелый `.next/cache`;
- несколько Docker stages дублировали `node_modules`.

Текущий Dockerfile снижает нагрузку:

- использует `node:20-bookworm-slim`;
- ставит `pnpm install --prod --frozen-lockfile --no-optional`;
- явно добавляет только нужный Next SWC для Linux glibc;
- копирует только `.next/standalone`, `.next/static` и `public`;
- исключает тесты, кеши, `.git`, локальные env и отчеты через `.dockerignore`.

## Если снова появляется Bus error / system error -122

Это почти всегда лимит Docker build окружения, а не ошибка приложения.

Проверьте по порядку:

1. В VibeHost подтянут последний коммит из GitHub.
2. В логах видно `FROM node:20-bookworm-slim`, а не `node:22-alpine`.
3. В логах видно `pnpm install --prod --frozen-lockfile --no-optional`.
4. Все env variables заполнены.
5. Порт проекта равен `3000`.
6. Supabase redirect URL содержит домен VibeHost.

Если ошибка остается на бесплатном тарифе, есть два практичных варианта:

- перейти на тариф с большим лимитом ресурсов;
- деплоить предварительно собранный архив, где уже нет dev-зависимостей и лишних кешей.

## Локальная проверка перед публикацией

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker build -t habit-plan-fact-tracker .
docker run --rm -p 3000:3000 `
  -e NEXT_PUBLIC_SUPABASE_URL="https://uknwpnyrcxmyytsiwdbl.supabase.co" `
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="<ваш ключ>" `
  habit-plan-fact-tracker
```

После запуска откройте:

```text
http://localhost:3000
```
