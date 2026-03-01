# Migrations

CLI-скрипт для загрузки default данных через Admin API.

## Использование

```bash
bun run migrate:seed
```

## Переменные окружения

| Переменная              | Default                 | Описание                                 |
|-------------------------|-------------------------|------------------------------------------|
| `MIGRATION_API_URL`     | `http://localhost:3000` | Базовый URL API                          |
| `MIGRATION_ADMIN_TOKEN` | `""`                    | Admin API key (header `x-admin-api-key`) |

В dev-режиме (ADMIN_API_KEY="" на сервере) токен не требуется.

## Данные

JSON файлы в `defaults/`:

| Файл                 | Записей | Описание                                 |
|----------------------|---------|------------------------------------------|
| `categories.json`    | 45      | Категории правил с весами                |
| `rules.json`         | 794     | Библиотечные правила code review         |
| `prompts.json`       | 23      | Шаблоны промптов                         |
| `expert-panels.json` | 2       | Панели экспертов (SafeGuard, Classifier) |
| `settings.json`      | 7       | Системные настройки                      |

## Порядок импорта

1. Categories (правила зависят от категорий через `buckets`)
2. Rules
3. Prompts
4. Expert Panels
5. Settings

## Идемпотентность

Скрипт безопасен для повторного запуска. Import use cases проверяют существование записей по уникальному ключу (uuid,
slug, name, key) и пропускают дубликаты.

## CI/CD

### Docker Compose

```yaml
services:
    api:
        # ...
        healthcheck:
            test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
            interval: 5s
            retries: 3

    migrate:
        image: oven/bun:1
        depends_on:
            api:
                condition: service_healthy
        command: bun run migrate:seed
        environment:
            MIGRATION_API_URL: http://api:3000
            MIGRATION_ADMIN_TOKEN: ${ADMIN_API_KEY}
```

### CI Pipeline

```yaml
- name: Deploy API
  run: # deploy step

- name: Seed default data
  run: |
      MIGRATION_API_URL=${{ vars.API_URL }} \
      MIGRATION_ADMIN_TOKEN=${{ secrets.ADMIN_API_KEY }} \
      bun run migrate:seed
```

## Retry

Скрипт включает retry логику:

- Health check: 3 попытки, 2с между попытками
- Импорт: 3 попытки, exponential backoff (2с, 4с, 8с)
- Timeout на запрос: 120с (для rules.json ~794 записей)
