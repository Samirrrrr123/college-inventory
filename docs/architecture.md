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
- Инвентаризация фиксирует состав аудитории при начале. Все предметы нужно отметить; после завершения ответы не меняются. Сама проверка не меняет статусы или расположение техники.
- Все данные рабочих страниц постоянные. Отдельная демоверсия хранит изменения только до перезагрузки.
- Темы и язык сохраняются в браузере, пароли и токены туда не записываются.
- Только администратор меняет роли и блокировку пользователей. При изменении доступа старые сессии закрываются. Последний активный администратор защищён, в том числе от одновременных изменений.

## Схема БД

```mermaid
erDiagram
    Room ||--o{ InventoryCheck : checked
    User ||--o{ InventoryCheck : starts
    User o|--o{ InventoryCheck : completes
    InventoryCheck ||--|{ InventoryItem : includes
    Equipment ||--o{ InventoryItem : recorded
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
    InventoryCheck {
        uuid id PK
        int number UK
        uuid roomId FK
        uuid createdById FK
        uuid completedById FK
        datetime createdAt
        datetime completedAt
    }
    InventoryItem {
        uuid checkId PK,FK
        uuid equipmentId PK,FK
        string equipmentName
        string inventoryNumber
        string statusAtStart
        boolean found
        datetime checkedAt
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

В БД 16 таблиц. PK — первичный ключ, FK — внешний ключ, UK — уникальное поле. RequestItem и LoanItem связывают заявки и выдачи с несколькими предметами. InventoryItem хранит сведения о предмете на момент проверки. Исторические записи защищены от случайного удаления внешними ключами.

## Запуск и API

Адреса и команды находятся в [README](../README.md), методы API — в [Swagger](https://85.8.201.148/api/docs/). Проверки описаны в [отчёте](testing-report.md).

Модуль backend/src/history читает существующие Movement и AuditEntry без создания второго источника истории. GET /api/movements доступен technician/admin, GET /api/audit — только admin. Фильтры, порядок и пагинация выполняются на сервере; страница и total читаются в одном repeatable-read снимке. Четыре новых индекса поддерживают чтение истории. Интерфейсы /app/movements и /app/audit используют существующий API-клиент, сессии и компоненты. Подробнее — в [передаче](history-handoff.md). Статистика и XLSX остаются отдельными блоками.
