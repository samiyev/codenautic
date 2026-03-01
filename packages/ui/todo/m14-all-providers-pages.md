# M14 — All Providers & Pages

> Источник: `packages/ui/TODO.md`

> **Задач (ui):** 11 | **Проверка:** Additional pages, settings, analytics

> **Результат milestone:** Готовы дополнительные страницы и настройки для полного пользовательского сценария.

## v0.11.0 — Additional Pages Part 1

> Issues, Integrations, Webhooks, Token usage, Org settings. ~100K tokens.

> **Результат версии:** Завершена версия «v0.11.0 — Additional Pages Part 1» в рамках M14; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| WEB-PAGE-006 | Реализовать issues tracking | TODO | Не начато | Реализация: List issues. Virtual scrolling. Filter by severity, status. Inline actions. Готово, если: для WEB-PAGE-006 ключевой пользовательский флоу проходит end-to-end в UI без ошибок, есть component + integration покрытие, проверены a11y (keyboard/focus/aria/contrast) и responsive для mobile/tablet/desktop; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |
| WEB-PAGE-007 | Реализовать integrations | TODO | Не начато | Реализация: Jira, Linear, Sentry, Slack. Connection status. Configure. Готово, если: для WEB-PAGE-007 ключевой пользовательский флоу проходит end-to-end в UI без ошибок, есть component + integration покрытие, проверены a11y (keyboard/focus/aria/contrast) и responsive для mobile/tablet/desktop; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |
| WEB-PAGE-008 | Реализовать webhook management | TODO | Не начато | Реализация: List webhooks. Create/delete. Secret rotation. Logs. Virtual scrolling. Готово, если: для WEB-PAGE-008 ключевой пользовательский флоу проходит end-to-end в UI без ошибок, есть component + integration покрытие, проверены a11y (keyboard/focus/aria/contrast) и responsive для mobile/tablet/desktop; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |
| WEB-PAGE-009 | Реализовать token usage | TODO | Не начато | Реализация: Usage by model, developer, CCR. Cost estimate. Date range. Готово, если: страница token usage корректно считает usage/cost по выбранному периоду и совпадает с данными backend API на контрольной выборке; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |
| WEB-PAGE-010 | Реализовать organization settings | TODO | Не начато | Реализация: Name, billing, members. BYOK. Audit logs. Готово, если: billing-настройки сохраняются идемпотентно, критичные действия подтверждаются, а ошибки оплаты отображаются пользователю без потери введённых данных; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |

---

## v0.12.0 — Additional Pages Part 2

> Team, Rules, Audit, SAML, BYOK. ~100K tokens.

> **Результат версии:** Завершена версия «v0.12.0 — Additional Pages Part 2» в рамках M14; инкремент готовит продукт к стабильному end-to-end сценарию в своем слое.

| ID | Задача | Статус | Результат | Acceptance Criteria |
|----------|--------------------|--------|-----------|---------------------|
| WEB-PAGE-011 | Реализовать team management | TODO | Не начато | Реализация: Create team. Add members. Assign repos. Role assignment. Готово, если: для WEB-PAGE-011 ключевой пользовательский флоу проходит end-to-end в UI без ошибок, есть component + integration покрытие, проверены a11y (keyboard/focus/aria/contrast) и responsive для mobile/tablet/desktop; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |
| WEB-PAGE-012 | Реализовать rules library | TODO | Не начато | Реализация: Browse pre-built rules. Import. Create custom. Test rules. Готово, если: для WEB-PAGE-012 ключевой пользовательский флоу проходит end-to-end в UI без ошибок, есть component + integration покрытие, проверены a11y (keyboard/focus/aria/contrast) и responsive для mobile/tablet/desktop; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |
| WEB-PAGE-013 | Реализовать audit logs | TODO | Не начато | Реализация: List changes. Virtual scrolling. Filter by actor, action. Date range. Export. Готово, если: для WEB-PAGE-013 ключевой пользовательский флоу проходит end-to-end в UI без ошибок, есть component + integration покрытие, проверены a11y (keyboard/focus/aria/contrast) и responsive для mobile/tablet/desktop; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |
| WEB-PAGE-014 | Реализовать sAML provider management | TODO | Не начато | Реализация: SAML config. OIDC config. Test SSO. Готово, если: SAML/OIDC настройка проходит master-data валидацию, тест SSO даёт диагностируемый результат success/failure и не сохраняет секреты в открытом виде; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |
| WEB-PAGE-015 | Реализовать bYOK management | TODO | Не начато | Реализация: Add API keys. Mask display. Rotation. Usage stats. Готово, если: BYOK ключи маскируются в UI, rotation не ломает активные интеграции, а удаление/обновление ключа корректно отражается в usage-метриках; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |
| WEB-COMP-008 | Реализовать rule editor (TipTap) | TODO | Не начато | Реализация: Rich text. Code blocks. Markdown. Dynamic import (lazy load TipTap). Готово, если: для WEB-COMP-008 ключевой пользовательский флоу проходит end-to-end в UI без ошибок, есть component + integration покрытие, проверены a11y (keyboard/focus/aria/contrast) и responsive для mobile/tablet/desktop; DoD: `cd packages/ui && bun run lint && bun run typecheck && bun run test`. |

---
