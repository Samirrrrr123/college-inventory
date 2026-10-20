# Инвентарь

Веб-приложение для учёта оборудования и аудиторий колледжа.

## Возможности

- Каталог оборудования, поиск, фильтры и карточки.
- Заявки, выдачи, возвраты, перемещения и инвентаризация.
- Три роли: преподаватель, лаборант, администратор.
- Профиль, управление пользователями, статистика и аудит.
- Светлая, тёмная и системная тема, RU/EN, адаптивный интерфейс.
- Экспорт XLSX и загрузка файлов после подключения backend.

Регистрация, вход, JWT-сессии, восстановление и смена пароля, профиль и история аккаунта работают с PostgreSQL. После входа открывается `/app/equipment`. Каталог, аудитории и категории используют настоящий API: CRUD, серверные поиск, фильтры, сортировка и пагинация. Преподаватель просматривает каталог, лаборант и администратор изменяют его; права проверяет сервер. Ссылка восстановления выводится в журнал backend; реальная отправка письма не используется.

Заявки, выдачи, возвраты, инвентаризация и управление пользователями пока доступны отдельно в демоверсии: изменения действуют до обновления страницы. При смене аудитории оборудования настоящий API уже сохраняет перемещение; отдельный интерфейс истории перемещений ещё не подключён. Файлы, экспорт и статистика БД также не подключены.

## Стек

React, TypeScript, Vite, React Router, Tailwind CSS.

Backend: Node.js, Express, Prisma, PostgreSQL. Инфраструктура: Docker Compose, GitHub Actions. Тесты: Vitest, Testing Library, Supertest, Playwright.

## Участники

- **Самир** — дизайн, frontend, тесты интерфейса, общий запуск, CI и деплой; для подключения форм также добавлен модуль аккаунтов.
- **Артём** — backend предметной области, расширение БД, API и серверные тесты.

## Общий запуск

Нужны Docker с Compose и Node.js 24 для создания локальной конфигурации. Из корня репозитория:

```sh
node scripts/setup-env.mjs
docker compose up --build
```

Приложение: http://127.0.0.1:8080/login. Swagger: http://127.0.0.1:8080/api/docs/.

Тестовые аккаунты: `admin@college.test`, `technician@college.test`, `teacher@college.test`. Пароль задан в локальном `.env` как `SEED_PASSWORD`. Повторный seed сохраняет существующие пароли. Регистрация создаёт только преподавателя. База хранится в Docker volume.

## Публикация на VPS

Для VPS с публичным IPv4 откройте входящие TCP-порты 22, 80, 443 и UDP-порт 443. Создайте локальную конфигурацию и добавьте в `.env` публичный IP и email для уведомлений о сертификате:

```sh
node scripts/setup-env.mjs
printf '\nPUBLIC_HOST=203.0.113.10\nACME_EMAIL=admin@example.com\n' >> .env
docker compose -f compose.yaml -f compose.production.yaml up --build --detach --wait
```

Вместо примеров указываются настоящий IP и email. Production-конфигурация запускает Caddy перед приложением, получает короткоживущий сертификат Let’s Encrypt для IP и автоматически продлевает его. Приложение открывается по `https://PUBLIC_HOST`; HTTP перенаправляется на HTTPS. Секреты остаются только в `.env` на сервере.

## Запуск frontend

Нужны Node.js 24 и pnpm 11.25.0.

```sh
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev
```

Приложение: http://127.0.0.1:5173.
Форма входа: http://127.0.0.1:5173/login.

Для работы API без Compose нужен PostgreSQL. Скопируйте `backend/.env.example` в `backend/.env`, задайте адрес БД, разные случайные секреты и тестовый пароль, затем выполните:

```sh
pnpm --dir backend install --frozen-lockfile
pnpm --dir backend generate
pnpm --dir backend migrate
pnpm --dir backend seed
pnpm --dir backend dev
```

Frontend перенаправляет `/api` на порт 3001. Рабочие разделы: `/app/equipment`, `/app/rooms`, `/app/categories`, `/account`. Демоверсия остальных операций доступна отдельно по ссылке внизу страницы.

## Проверки

```sh
pnpm --dir frontend lint
pnpm --dir frontend format:check
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend build
pnpm --dir frontend exec playwright install chromium
pnpm --dir frontend test:e2e
```

## Материалы

- [Макеты Figma](https://www.figma.com/design/jIVQxAXjthCzGjexpRL1J6)
- [Пользовательские истории](docs/user-stories.md)
- [Архитектура и текущая схема БД](docs/architecture.md)
- [Отчёт о тестировании текущего этапа](docs/testing-report.md)
- [Задачи GitHub](https://github.com/Samirrrrr123/college-inventory/issues)
- [Доска задач](https://github.com/users/Samirrrrr123/projects/1/views/1)
- [Информация для интеграции frontend](docs/frontend-handoff.md)
- [Готовый модуль аккаунтов и продолжение backend](docs/auth-handoff.md)
- [Черновик договорённостей по API](docs/api-proposal.md)

Изменения добавляются через feature-ветки и Pull Request с автоматическими проверками. Публичная ссылка появится после интеграции предметной области и деплоя.
