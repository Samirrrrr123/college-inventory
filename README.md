# Учёт оборудования и аудиторий колледжа

Приложение «Инвентарь»: каталог техники, заявки, выдача и возврат, перемещения и инвентаризация.

[Сайт](https://85.8.201.148/login) · [Swagger](https://85.8.201.148/api/docs/) · [Figma](https://www.figma.com/design/jIVQxAXjthCzGjexpRL1J6)

## Возможности

Три роли: преподаватель, лаборант и администратор. Есть регистрация, вход, восстановление пароля, профиль и история. Права проверяет сервер.

В каталоге работают поиск, фильтры, сортировка и страницы. Сотрудники ведут оборудование и аудитории, рассматривают заявки, выдают и принимают технику. Файлы: PNG, JPG и PDF до 5 МБ. Данные сохраняются в PostgreSQL.

Есть обзор с графиком, управление пользователями, журнал действий, темы и RU/EN. XLSX выгружает найденный список по фильтрам, до 5000 строк. Интерфейс работает на телефоне и компьютере.

## Стек и вклад

React, TypeScript strict, Vite, React Router, Tailwind CSS. API: Node.js и Express. БД: PostgreSQL и Prisma. Запуск: Docker Compose. Проверки: GitHub Actions, Vitest, Testing Library, Supertest и Playwright.

Первоначальные зоны ответственности:

- **Ясинов Самир Парвизович, 4p1.23:** Figma, frontend, подключение API, тесты интерфейса, CI и размещение.
- **Николаиди Артём Георгиевич, 4p1.23:** backend, REST API, PostgreSQL, миграции и серверные тесты.

Интеграция и общие проверки — совместные. Фактические изменения сохранены в Git и PR. В презентации каждый читает пять слайдов.

## Запуск

Нужны Docker Compose и Node.js 24. В корне проекта:

```sh
node scripts/setup-env.mjs
docker compose up --build
```

Сайт: http://127.0.0.1:8080/login. API: http://127.0.0.1:8080/api/docs/.

Тестовые аккаунты: `admin@college.test`, `technician@college.test`, `teacher@college.test`. Пароль берётся из `SEED_PASSWORD` в созданном `.env`. В репозиторий секреты не добавляются. Ссылка восстановления пароля выводится в журнал backend.

## Сервер

UFO Hosting, Haedus[RU], Россия. Ubuntu 24.04, 2 vCPU, 2 ГБ RAM, диск 40 ГБ. IP: 85.8.201.148. Проект: `/opt/college-inventory`.

Caddy обеспечивает HTTPS, Nginx отдаёт интерфейс и передаёт запросы к API. PostgreSQL закрыт от интернета. Подключение по SSH-ключу, настройки в `.env`, копии БД в `/var/backups/college-inventory`.

Перед обновлением сохранить копию БД. Затем:

```sh
git pull --ff-only origin main
docker compose -f compose.yaml -f compose.production.yaml up --build --detach --wait
```

## Материалы

- [Общая документация PDF](docs/project-documentation.pdf)
- [Презентация PowerPoint](docs/presentation.pptx)
- [15 пользовательских историй](docs/user-stories.md)
- [Архитектура и схема БД](docs/architecture.md)
- [Проверки и исправленные ошибки](docs/testing-report.md)
- [Задачи и доска](docs/kanban.md)

Индивидуальные отчёты и дневники каждый сдаёт отдельно. Изменения в коде проходят через ветки, PR и CI.
