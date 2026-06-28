# Deploy на Render Free

Render сейчас самый быстрый бесплатный вариант для запуска проекта без Docker-ошибок VibeHost.

## 1. Создание сервиса

1. Зайдите на `https://render.com`.
2. New -> Web Service.
3. Подключите GitHub репозиторий `habit-plan-fact-tracker`.
4. Выберите ветку `main`.
5. Runtime/Environment: Docker.
6. Plan: Free.
7. Render должен увидеть `render.yaml` и `Dockerfile`.

## 2. Переменные окружения

Добавьте:

```text
NEXT_PUBLIC_SUPABASE_URL=https://uknwpnyrcxmyytsiwdbl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ваш anon public key из Supabase>
NEXT_PUBLIC_SITE_URL=https://<имя-сервиса>.onrender.com
SKIP_NEXT_BUILD_VALIDATION=1
NEXT_TELEMETRY_DISABLED=1
```

`NEXT_PUBLIC_SITE_URL` можно заполнить после первого создания сервиса, когда Render покажет публичный URL.

## 3. Supabase Auth

В Supabase откройте Authentication -> URL Configuration.

Site URL:

```text
https://<имя-сервиса>.onrender.com
```

Redirect URLs:

```text
https://<имя-сервиса>.onrender.com/**
http://localhost:3000/**
```

Старые Netlify/VibeHost URL можно оставить временно.

## 4. Проверка

1. Откройте публичный Render URL.
2. Войдите через email/password.
3. Проверьте `/dashboard`, `/daily`, `/planner`, `/goals`.
4. Проверьте вход с телефона без VPN.

## 5. Ограничения Render Free

- сервис может засыпать при простое;
- первый запуск после сна может быть медленным;
- если Supabase недоступен без VPN, перенос только фронтенда это не исправит.
