/**
 * Supported external context source systems.
 */
export const EXTERNAL_CONTEXT_SOURCE = ["JIRA", "LINEAR", "SENTRY", "DATADOG", "POSTHOG"] as const

/**
 * Union of supported external context source systems.
 */
export type ExternalContextSource =
    (typeof EXTERNAL_CONTEXT_SOURCE)[number]

/**
 * Normalized external context payload shared across providers and pipeline enrichment.
 */
export interface IExternalContext {
    /**
     * External source that produced the context.
     */
    readonly source: ExternalContextSource

    /**
     * Unvalidated platform-specific context payload.
     */
    readonly data: unknown

    /**
     * Fetch timestamp.
     */
    readonly fetchedAt: Date
}

/**
 * External issue model for Jira platform.
 */
export interface IJiraTicket {
    readonly key: string
    readonly summary: string
    readonly status: string
}

/**
 * External issue model for Linear platform.
 */
export interface ILinearIssue {
    readonly id: string
    readonly title: string
    readonly state: string
}

/**
 * External error model for Sentry platform.
 */
export interface ISentryError {
    readonly id: string
    readonly title: string
    readonly stackTrace: readonly string[]
}
