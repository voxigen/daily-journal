# Деплой Almanax на свой сервер (рядом с voxmarket)

Almanax собирается в Docker-контейнер, подключается к сети voxmarket и
обслуживается общим Caddy (он же выпускает TLS для `almanax.tech`).
Supabase остаётся облачным — база на сервере не нужна.

## 0. DNS (reg.ru)
Создай A-запись:

    almanax.tech.       A   138.16.160.5
    www.almanax.tech.   A   138.16.160.5   (по желанию)

Подожди, пока `nslookup almanax.tech` не отдаст 138.16.160.5 (обычно минуты, редко до часа).

## 1. Забрать код на сервер

    cd /root
    git clone https://github.com/voxigen/daily-journal.git almanax
    cd almanax

## 2. Прописать ключи Supabase

    cp .env.production.example .env
    nano .env          # вставь NEXT_PUBLIC_SUPABASE_URL и ..._ANON_KEY

## 3. Собрать и запустить

    docker compose up -d --build

Проверить, что контейнер поднялся и отвечает:

    docker ps | grep almanax
    docker exec almanax wget -qO- http://localhost:3000 | head -c 200

## 4. Добавить домен в Caddy
В Caddyfile voxmarket (см. `docker compose config` в /root/voxmarket) добавь блок:

    almanax.tech {
        reverse_proxy almanax:3000
    }

Затем перечитать конфиг без простоя:

    docker exec voxmarket-caddy-1 caddy reload --config /etc/caddy/Caddyfile

Caddy сам выпустит сертификат Let's Encrypt при первом заходе на https://almanax.tech.

## 5. Supabase → разрешить новый домен
Dashboard → Authentication → URL Configuration:
- Site URL: `https://almanax.tech`
- Redirect URLs: добавить `https://almanax.tech/auth/callback`

## Обновление после изменений в коде

    cd /root/almanax && git pull && docker compose up -d --build

Старые образы можно чистить: `docker image prune -f`
