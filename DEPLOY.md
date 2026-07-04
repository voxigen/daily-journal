# Деплой Almanax на свой сервер (рядом с voxmarket)

Almanax = Next.js-контейнер + свой Postgres, всё в Docker. Обслуживается общим
Caddy (он же выпускает TLS для `almanax.tech`). Фото хранятся на диске (volume).

## 0. DNS (reg.ru)
Отредактируй парковочные записи (карандаш), не создавай новые:

    A   @     → 138.16.160.5
    A   www   → 138.16.160.5

Подожди, пока `nslookup almanax.tech 8.8.8.8` не отдаст 138.16.160.5.

## 1. Swap (важно на 2 ГБ RAM — иначе сборка может упасть по OOM)

    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab

## 2. Забрать код

    cd /root
    git clone https://github.com/voxigen/daily-journal.git almanax
    cd almanax

## 3. Секреты

    cp .env.production.example .env
    nano .env
    #   POSTGRES_PASSWORD  — openssl rand -hex 24
    #   SESSION_SECRET     — openssl rand -hex 32

## 4. Собрать и запустить (Postgres + приложение)

    docker compose up -d --build

Проверить:

    docker compose ps
    docker exec almanax wget -qO- http://localhost:3000/login | head -c 120

Схема БД создаётся автоматически при первом старте Postgres (db/init.sql).

## 5. Домен в Caddy
Открой `/root/voxmarket/Caddyfile`, в КОНЕЦ добавь отдельный блок
(не трогая существующий `{$DOMAIN} { ... }`):

    almanax.tech {
        reverse_proxy almanax:3000
    }

Перечитать без простоя:

    docker exec voxmarket-caddy-1 caddy reload --config /etc/caddy/Caddyfile

Caddy сам выпустит сертификат при первом заходе на https://almanax.tech.

## 6. Первый аккаунт
Открой https://almanax.tech — на экране входа нажми «Зарегистрироваться»,
заведи почту+пароль. Аккаунт создаётся сразу (без подтверждения по почте).

## Обновление после изменений в коде

    cd /root/almanax && git pull && docker compose up -d --build
    docker image prune -f

## Схема БД менялась?
init.sql применяется только при ПЕРВОМ старте (пустой том). Later-миграции —
вручную: `docker exec -it almanax-db-1 psql -U almanax -d almanax` и выполнить SQL
(или через любой клиент). Держи db/init.sql и lib/db/schema.ts в синхроне.
