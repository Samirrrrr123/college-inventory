# Устройство приложения

React показывает страницы и отправляет запросы в Express API. Контроллер принимает запрос, сервис проверяет правила, репозиторий обращается к PostgreSQL через Prisma. Caddy и Nginx передают запросы на VPS.

## Основные правила

- Пароли защищены bcrypt. Access JWT хранится в памяти страницы, refresh JWT в HttpOnly cookie. Выход и смена пароля закрывают сеансы.
- Сервер проверяет роль и владельца записи. Преподаватель видит только свои заявки и выдачи. Каталог оборудования общий.
- В заявке от 1 до 20 разных предметов. Доступность проверяется при выдаче. Комплект выдаётся и возвращается целиком.
- Файлы PNG, JPG и PDF до 5 МБ хранятся в БД. Проверяются размер, тип и права.
- Инвентаризация сохраняет состав аудитории. Завершённый результат нельзя изменить.
- Перемещения доступны сотрудникам, журнал аудита только администратору. Поиск и страницы обрабатывает сервер.
- Последнего активного администратора нельзя отключить. Смена роли и блокировка закрывают сеансы.
- XLSX использует фильтры каталога, до 5000 строк. Пользовательский текст не превращается в формулы.

## Схема БД

16 таблиц. PK означает первичный ключ, FK внешний ключ, UK уникальное поле. RequestItem и LoanItem связывают заявки и выдачи с несколькими предметами. Изменения применяются миграциями, seed добавляет тестовые данные.

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

[API в Swagger](https://85.8.201.148/api/docs/) · [Запуск](../README.md) · [Проверки](testing-report.md)
