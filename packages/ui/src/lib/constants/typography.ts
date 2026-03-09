/**
 * Семантическая типографическая шкала для UI.
 * Новые компоненты должны использовать `TYPOGRAPHY.*` вместо raw Tailwind классов.
 *
 * @example
 * ```tsx
 * <h1 className={TYPOGRAPHY.pageTitle}>Dashboard</h1>
 * <p className={TYPOGRAPHY.bodyMuted}>No data available.</p>
 * ```
 */
export const TYPOGRAPHY = {
    /** Заголовок страницы (Space Grotesk, 2xl, semibold). */
    pageTitle: "font-display text-2xl font-semibold text-foreground",
    /** Заголовок секции/карточки (Space Grotesk, base, semibold). */
    sectionTitle: "font-display text-base font-semibold text-foreground",
    /** Основной текст (sm). */
    body: "text-sm text-foreground",
    /** Вторичный текст (sm, muted). */
    bodyMuted: "text-sm text-text-secondary",
    /** Подпись / caption (xs, subtle). */
    caption: "text-xs text-text-subtle",
    /** Label для form-полей (sm, medium weight). */
    label: "text-sm font-medium text-foreground",
} as const
