/**
 * Suggested issue/comment payload produced by review pipeline.
 *
 * This DTO intentionally uses only primitive values.
 */
export interface ISuggestionDTO {
    readonly id: string
    readonly filePath: string
    readonly lineStart: number
    readonly lineEnd: number
    readonly severity: string
    readonly category: string
    readonly message: string
    readonly codeBlock?: string
    readonly committable: boolean
    readonly rankScore: number
}
