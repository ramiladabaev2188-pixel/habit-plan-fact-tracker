# VPS deploy за 250-350 рублей в месяц

Для текущего проекта самый предсказуемый вариант в бюджете до 350 рублей - маленький VPS в РФ и деплой через GitHub Actions.

## Почему не PaaS

VibeHost и Render падают на сборке или окружении. У проекта много Next.js маршрутов, server actions, Supabase SSR и тестовые зависимости. На бесплатных контейнерах это нестабильно.

На VPS мы делаем иначе:

1. GitHub Actions собирает проект на мощностях GitHub.
2. На VPS отправляется уже готовая `.next/standalone` сборка.
3. Сервер только запускает `node server.js`.

Так даже недорогой VPS не тратит память на сборку Next.js.

## Рекомендованный вариант

Берите VPS/VDS в РФ с минимальными характеристиками:

- 1 vCPU;
- 1 GB RAM минимум;
- 10+ GB SSD;
- Ubuntu 22.04 или 24.04;
- публичный IPv4;
- цена до 350 руб/мес.

Практичный кандидат: FirstVDS с тарифом от 249 руб/мес. Если при заказе есть выбор, берите Ubuntu 24.04.

## Первичная настройка сервера

Подключитесь по SSH и выполните:

```bash
apt update
apt install -y curl nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
```

Node должен быть версии 22.x.

Откройте порт 3000 временно для проверки, если включен firewall:

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow 3000
ufw --force enable
```

## GitHub secrets

В GitHub откройте:

`Repository -> Settings -> Secrets and variables -> Actions`

Добавьте Repository secrets:

```text
VPS_HOST=<ip сервера>
VPS_USER=root
VPS_SSH_KEY=<приватный SSH ключ для доступа к серверу>
NEXT_PUBLIC_SUPABASE_URL=https://uknwpnyrcxmyytsiwdbl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key из Supabase>
NEXT_PUBLIC_SITE_URL=http://<ip сервера>:3000
```

Добавьте Repository variable:

```text
ENABLE_VPS_DEPLOY=1
```

## Запуск деплоя

В GitHub:

`Actions -> Deploy VPS -> Run workflow`

После успешного workflow приложение будет доступно:

```text
http://<ip сервера>:3000
```

## Supabase Auth

В Supabase:

`Authentication -> URL Configuration`

Site URL:

```text
http://<ip сервера>:3000
```

Redirect URLs:

```text
http://<ip сервера>:3000/**
http://localhost:3000/**
```

Когда подключите домен и HTTPS, замените IP на домен.

## Nginx для домена

После покупки/подключения домена создайте файл:

```bash
nano /etc/nginx/sites-available/habit-plan-fact-tracker
```

Содержимое:

```nginx
server {
    listen 80;
    server_name your-domain.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Активируйте:

```bash
ln -s /etc/nginx/sites-available/habit-plan-fact-tracker /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## HTTPS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.ru
```

После этого в GitHub secret `NEXT_PUBLIC_SITE_URL` и Supabase URL Configuration нужно поставить:

```text
https://your-domain.ru
```

## Проверка

```bash
systemctl status habit-plan-fact-tracker
journalctl -u habit-plan-fact-tracker -n 100 --no-pager
curl http://127.0.0.1:3000
```
