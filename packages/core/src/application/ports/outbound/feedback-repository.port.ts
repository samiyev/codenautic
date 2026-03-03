import {type FeedbackType} from "../../../domain/events/feedback-received"
import {type SeverityLevel, SEVERITY_LEVEL} from "../../../domain/value-objects/severity.value-object"
import type {UniqueId} from "../../../domain/value-objects/unique-id.value-object"

/**
 * Allowed severity levels for feedback analytics filtering.
 */
export const FEEDBACK_ANALYSIS_SEVERITY_LEVELS = [
    SEVERITY_LEVEL.INFO,
    SEVERITY_LEVEL.LOW,
    SEVERITY_LEVEL.MEDIUM,
    SEVERITY_LEVEL.HIGH,
    SEVERITY_LEVEL.CRITICAL,
] as const

/**
 * Severity level used in feedback analytics filters.
 */
export type IFeedbackAnalysisSeverity = (typeof FEEDBACK_ANALYSIS_SEVERITY_LEVELS)[number]

/**
 * Single persisted feedback row.
 */
export interface IFeedbackRecord {
    /**
     * Review finding identifier.
     */
    readonly issueId: string

    /**
     * Review identifier.
     */
    readonly reviewId: string

    /**
     * Reviewed rule identifier.
     */
    readonly ruleId?: string

    /**
     * Optional comment text.
     */
    readonly comment?: string

    /**
     * Optional team scope where feedback originated.
     */
    readonly teamId?: string

    /**
     * Issue severity at time of feedback.
     */
    readonly severity?: SeverityLevel

    /**
     * Feedback type.
     */
    readonly type: FeedbackType

    /**
     * Identifier of user who submitted feedback.
     */
    readonly userId: UniqueId

    /**
     * Feedback creation timestamp.
     */
    readonly createdAt: Date
}

/**
 * Aggregate count by feedback type.
 */
export type IFeedbackTypeAggregate = Partial<Record<FeedbackType, number>>

/**
 * Analytics query for feedback buckets.
 */
export interface IFeedbackAnalysisCriteria {
    /**
     * Rule ids to include.
     */
    readonly ruleIds?: readonly string[]

    /**
     * Team ids to include.
     */
    readonly teamIds?: readonly string[]

    /**
     * Severities to include.
     */
    readonly severities?: readonly IFeedbackAnalysisSeverity[]
}

/**
 * Filter for query by review id.
 */
export interface IFeedbackReviewCriteria {
    /**
     * Review identifier.
     */
    readonly reviewId: string
}

/**
 * Filter for query by issue id.
 */
export interface IFeedbackIssueCriteria {
    /**
     * Issue identifier.
     */
    readonly issueId: string
}

/**
 * Feedback repository contract for analytical queries.
 */
export interface IFeedbackRepository {
    /**
     * Persists one feedback row.
     *
     * @param feedback Feedback row.
     */
    save(feedback: IFeedbackRecord): Promise<void>

    /**
     * Persists multiple feedback rows.
     *
     * @param feedbacks Feedback rows.
     */
    saveMany(feedbacks: readonly IFeedbackRecord[]): Promise<void>

    /**
     * Finds all feedback rows for one review.
     *
     * @param criteria Review filter.
     */
    findByReviewId(criteria: IFeedbackReviewCriteria): Promise<readonly IFeedbackRecord[]>

    /**
     * Finds all feedback rows for one issue.
     *
     * @param criteria Issue filter.
     */
    findByIssueId(criteria: IFeedbackIssueCriteria): Promise<readonly IFeedbackRecord[]>

    /**
     * Aggregates feedback by type for one review.
     *
     * @param criteria Review filter.
     */
    aggregateByType(criteria: IFeedbackReviewCriteria): Promise<IFeedbackTypeAggregate>

    /**
     * Finds feedback rows for optional criteria.
     *
     * @param criteria Optional filter criteria.
     * @returns Matching feedback rows.
     */
    findByFilter(criteria?: IFeedbackAnalysisCriteria): Promise<readonly IFeedbackRecord[]>

    /**
     * Counts feedbacks by rule id for quick health checks.
     *
     * @param ruleId Rule identifier.
     * @returns Total feedback count.
     */
    countByRuleId(ruleId: string): Promise<number>

    /**
     * Counts false-positive feedbacks for quick health checks.
     *
     * @param ruleId Rule identifier.
     * @returns False-positive count.
     */
    countFalsePositiveByRuleId(ruleId: string): Promise<number>
}
