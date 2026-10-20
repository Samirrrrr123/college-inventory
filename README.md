# Инвентарь

Веб-приложение для учёта оборудования и аудиторий колледжа.

## Возможности

- Каталог оборудования, поиск, фильтры и карточки.
- Заявки, выдачи, возвраты, перемещения и инвентаризация.
- Три роли: преподаватель, лаборант, администратор.
- Профиль, управление пользователями, статистика и аудит.
- Светлая, тёмная и системная тема, RU/EN, адаптивный интерфейс.
- Экспорт XLSX и загрузка файлов после подключения backend.

Сейчас доступен frontend с демонстрационными данными. Изменения данных действуют до обновления страницы; настоящая авторизация и серверные операции ещё не подключены.

Готовы формы входа, регистрации и восстановления пароля с проверкой полей. До подключения API они не создают аккаунты и не меняют пароли.

## Стек

React, TypeScript, Vite, React Router, Tailwind CSS.

Backend: Node.js, Express, Prisma, PostgreSQL. Инфраструктура: Docker Compose, GitHub Actions. Тесты: Vitest, Testing Library, Supertest, Playwright.

## Участники

- **Самир** — дизайн, frontend, тесты интерфейса, общий запуск, CI и деплой.
- **Артём** — backend, БД, авторизация, API и серверные тесты.

## Запуск frontend

Нужны Node.js 24 и pnpm 11.25.0.

```sh
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend dev
```

Приложение: http://127.0.0.1:5173.
Форма входа: http://127.0.0.1:5173/login.

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
- [Задачи GitHub](https://github.com/Samirrrrr123/college-inventory/issues)
- [Доска задач](https://github.com/users/Samirrrrr123/projects/1/views/1)
- [Информация для интеграции frontend](docs/frontend-handoff.md)
- [Черновик договорённостей по API](docs/api-proposal.md)

Изменения добавляются через feature-ветки и Pull Request с автоматическими проверками. Общий запуск через `docker compose up`, тестовые аккаунты для backend и публичная ссылка будут добавлены после интеграции и деплоя.
