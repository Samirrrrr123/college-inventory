# Устройство приложения

## Как всё работает

```mermaid
flowchart LR
    Browser[React в браузере] --> Proxy[Caddy и Nginx]
    Proxy --> API[Express API]
    API --> Services[Проверки и бизнес-логика]
    Services --> Prisma[Prisma]
    Prisma --> DB[(PostgreSQL)]
```

- React показывает страницы и отправляет запросы к `/api`.
- Контроллеры принимают запросы, сервисы проверяют правила, репозитории работают с БД.
- Prisma описывает таблицы. Изменения применяются миграциями, seed добавляет тестовые данные.
- Docker Compose запускает приложение одной командой. На VPS Caddy добавляет HTTPS.
- API и база доступны через внутреннюю сеть Docker.

## Вход и роли

Пароли хранятся в виде bcrypt-хешей. После входа выдаются access JWT на 15 минут и refresh JWT на 7 дней. Access остаётся в памяти браузера, refresh — в HttpOnly cookie. Выход и смена пароля отзывают сессии.

Сервер проверяет роль и блокировку при каждом защищённом запросе. Преподаватель читает каталог и работает со своими заявками. Лаборант и администратор ведут каталог, рассматривают заявки и оформляют выдачи.

## Основные правила

- В заявке 1–20 предметов. Одобрение не резервирует технику.
- Выдача и возврат сохраняются целиком: ошибка по одному предмету отменяет всю операцию.
- Повторно выдать занятую технику или принять тот же возврат нельзя.
- Фото и PDF до 5 МБ хранятся в БД. Сервер проверяет тип, размер и права; скачивание требует входа.
- Все данные рабочих страниц постоянные. Отдельная демоверсия хранит изменения только до перезагрузки.
- Темы и язык сохраняются в браузере, пароли и токены туда не записываются.

## Схема БД

```mermaid
erDiagram
    Equipment ||--o{ Attachment : has
    User ||--o{ Attachment : uploads
    Role ||--o{ User : assigned
    User ||--o{ Session : opens
    User ||--o{ PasswordReset : requests
    User ||--o{ AuditEntry : performs
    Category ||--o{ Equipment : groups
    Room ||--o{ Equipment : contains
    Equipment ||--o{ Movement : has
    Room ||--o{ Movement : origin
    Room ||--o{ Movement : destination
    User ||--o{ Movement : records
    User ||--o{ EquipmentRequest : requests
    User o|--o{ EquipmentRequest : reviews
    EquipmentRequest ||--|{ RequestItem : includes
    Equipment ||--o{ RequestItem : requested
    EquipmentRequest o|--o| Loan : grounds
    User ||--o{ Loan : borrows
    User ||--o{ Loan : issues
    User o|--o{ Loan : accepts
    Loan ||--|{ LoanItem : includes
    Equipment ||--o{ LoanItem : issued

    Attachment {
        uuid id PK
        uuid equipmentId FK
        uuid uploadedById FK
        string name
        string contentType
        int size
        bytes content
        datetime createdAt
    }
    Role {
        uuid id PK
        string code UK
    }
    User {
        uuid id PK
        string name
        string email UK
        string passwordHash
        boolean isBlocked
        uuid roleId FK
        datetime createdAt
    }
    Session {
        uuid id PK
        uuid userId FK
        string refreshHash UK
        datetime expiresAt
        datetime createdAt
    }
    PasswordReset {
        uuid id PK
        uuid userId FK
        string tokenHash UK
        datetime expiresAt
    }
    AuditEntry {
        uuid id PK
        uuid actorId FK
        string action
        string entityType
        uuid entityId
        json details
        datetime createdAt
    }
    Category {
        uuid id PK
        string name UK
    }
    Room {
        uuid id PK
        string number
        string name
        string building
        int floor
    }
    Equipment {
        uuid id PK
        string name
        string inventoryNumber UK
        string serialNumber
        string description
        string status
        uuid categoryId FK
        uuid roomId FK
        datetime createdAt
        datetime updatedAt
    }
    Movement {
        uuid id PK
        uuid equipmentId FK
        uuid fromRoomId FK
        uuid toRoomId FK
        uuid actorId FK
        string reason
        datetime createdAt
    }
    EquipmentRequest {
        uuid id PK
        int number UK
        uuid requesterId FK
        uuid reviewerId FK
        string purpose
        string status
        string decisionNote
        datetime createdAt
        datetime reviewedAt
    }
    RequestItem {
        uuid requestId PK,FK
        uuid equipmentId PK,FK
    }
    Loan {
        uuid id PK
        int number UK
        uuid requestId FK,UK
        uuid recipientId FK
        uuid issuedById FK
        uuid returnedById FK
        datetime issuedAt
        datetime dueAt
        datetime returnedAt
    }
    LoanItem {
        uuid loanId PK,FK
        uuid equipmentId PK,FK
    }
```

В БД 14 таблиц. PK — первичный ключ, FK — внешний ключ, UK — уникальное поле. RequestItem и LoanItem связывают заявки и выдачи с несколькими предметами. Исторические записи защищены от случайного удаления внешними ключами.

## Запуск и API

Адреса и команды находятся в [README](../README.md), методы API — в [Swagger](https://85.8.201.148/api/docs/). Проверки описаны в [отчёте](testing-report.md).

Осталось подключить инвентаризацию, управление пользователями, общую статистику, аудит и экспорт.
