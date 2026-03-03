import {FEEDBACK_TYPE, type FeedbackType} from "../events/feedback-received"
import {UniqueId} from "./unique-id.value-object"

/**
 * Supported issue feedback types.
 */
export const ISSUE_FEEDBACK_TYPE = FEEDBACK_TYPE

/**
 * Feedback type literal for issue-level feedback.
 */
export type IssueFeedbackType = FeedbackType

/**
 * Input arguments for issue feedback factory.
 */
export interface IIssueFeedbackProps {
    /**
     * Identifier of reported issue.
     */
    readonly issueId: string | UniqueId

    /**
     * Identifier of review this issue belongs to.
     */
    readonly reviewId: string | UniqueId

    /**
     * Feedback type.
     */
    readonly type: IssueFeedbackType

    /**
     * Author identifier.
     */
    readonly userId: string | UniqueId

    /**
     * Optional free-text comment.
     */
    readonly comment?: string

    /**
     * Creation timestamp.
     */
    readonly createdAt?: Date
}

/**
 * Immutable value object for review issue feedback.
 */
export class IssueFeedback {
    private readonly issueIdValue: UniqueId
    private readonly reviewIdValue: UniqueId
    private readonly typeValue: IssueFeedbackType
    private readonly userIdValue: UniqueId
    private readonly commentValue: string | undefined
    private readonly createdAtValue: Date

    /**
     * Creates issue feedback value object.
     *
     * @param issueId Issue identifier.
     * @param reviewId Review identifier.
     * @param type Feedback type.
     * @param userId Author identifier.
     * @param comment Optional comment.
     * @param createdAt Created at timestamp.
     */
    private constructor(props: IIssueFeedbackProps) {
        this.issueIdValue = normalizeUniqueId(props.issueId)
        this.reviewIdValue = normalizeUniqueId(props.reviewId)
        this.typeValue = normalizeType(props.type)
        this.userIdValue = normalizeUniqueId(props.userId)
        this.commentValue = normalizeComment(props.comment)
        this.createdAtValue = new Date(props.createdAt ?? new Date())
        Object.freeze(this)
    }

    /**
     * Creates issue feedback from raw properties.
     *
     * @param props Issue feedback payload.
     * @returns Issue feedback value object.
     */
    public static create(props: IIssueFeedbackProps): IssueFeedback {
        return new IssueFeedback({
            ...props,
            createdAt: props.createdAt ?? new Date(),
        })
    }

    /**
     * Feedback issue identifier.
     *
     * @returns Immutable unique id.
     */
    public get issueId(): UniqueId {
        return this.issueIdValue
    }

    /**
     * Associated review identifier.
     *
     * @returns Immutable review unique id.
     */
    public get reviewId(): UniqueId {
        return this.reviewIdValue
    }

    /**
     * Feedback type.
     *
     * @returns Strongly typed type.
     */
    public get type(): IssueFeedbackType {
        return this.typeValue
    }

    /**
     * Feedback author identifier.
     *
     * @returns Immutable author unique id.
     */
    public get userId(): UniqueId {
        return this.userIdValue
    }

    /**
     * Optional comment.
     *
     * @returns Comment or undefined.
     */
    public get comment(): string | undefined {
        return this.commentValue
    }

    /**
     * Creation timestamp.
     *
     * @returns Immutable copy of creation date.
     */
    public get createdAt(): Date {
        return new Date(this.createdAtValue)
    }
}

/**
 * Normalizes unique identifier input.
 *
 * @param value Raw unique identifier.
 * @returns Normalized unique identifier.
 */
function normalizeUniqueId(value: string | UniqueId): UniqueId {
    if (value instanceof UniqueId) {
        return value
    }

    return UniqueId.create(value)
}

/**
 * Normalizes feedback type input.
 *
 * @param value Raw feedback type.
 * @returns Normalized type.
 */
function normalizeType(value: IssueFeedbackType): IssueFeedbackType {
    const candidates = Object.values(ISSUE_FEEDBACK_TYPE)
    if (candidates.includes(value)) {
        return value
    }

    throw new Error(`Unsupported issue feedback type: ${value}`)
}

/**
 * Normalizes comment text.
 *
 * @param value Raw comment.
 * @returns Trimmed comment or undefined.
 */
function normalizeComment(value: string | undefined): string | undefined {
    if (value === undefined) {
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}
