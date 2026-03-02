/**
 * Review issue payload used in review results.
 *
 * This DTO intentionally uses only primitive values.
 */
export interface IReviewIssueDTO {
    readonly id: string
    readonly filePath: string
    readonly lineStart: number
    readonly lineEnd: number
    readonly severity: string
    readonly category: string
    readonly message: string
    readonly suggestion?: string
    readonly codeBlock?: string
    readonly rankScore: number
}

/**
 * Minimal review metrics payload for result transport.
 */
export interface IReviewResultMetricsDTO {
    readonly duration: number
}

/**
 * Review result DTO returned by pipeline/application boundaries.
 */
export interface IReviewResultDTO {
    readonly reviewId: string
    readonly status: string
    readonly issues: readonly IReviewIssueDTO[]
    readonly metrics: IReviewResultMetricsDTO | null
}
