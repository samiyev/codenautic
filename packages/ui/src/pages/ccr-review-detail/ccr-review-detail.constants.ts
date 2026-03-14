/**
 * Константы страницы детального просмотра CCR review.
 */

import type { TSafeGuardFilterId, TReviewerFeedbackReason } from "./ccr-review-detail.types"

/**
 * Порядок фильтров SafeGuard pipeline.
 * Определяет последовательность применения фильтров: дедупликация, проверка
 * галлюцинаций, фильтрация по severity.
 */
const SAFEGUARD_FILTER_SEQUENCE: ReadonlyArray<TSafeGuardFilterId> = [
    "dedup",
    "hallucination",
    "severity",
]

/**
 * Причины отклонения reviewer feedback.
 * Каждому типу причины сопоставлено человекочитаемое объяснение,
 * почему feedback не может быть применён.
 */
const FEEDBACK_REJECTION_REASONS: Readonly<Record<TReviewerFeedbackReason, string>> = {
    duplicate: "No canonical finding was eligible for merge in the current safety window.",
    false_positive: "Evidence bundle confirms the finding and blocks false-positive dismissal.",
    irrelevant: "Rule is mandatory for the active policy and cannot be ignored.",
}

export { FEEDBACK_REJECTION_REASONS, SAFEGUARD_FILTER_SEQUENCE }
