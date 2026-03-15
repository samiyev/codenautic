import {
    INLINE_COMMENT_SIDE,
    MERGE_REQUEST_DIFF_FILE_STATUS,
    type ICommentDTO,
    type IInlineCommentDTO,
    type IMergeRequestAuthorDTO,
    type IMergeRequestCommitDTO,
    type IMergeRequestDTO,
    type IMergeRequestDiffFileDTO,
    type InlineCommentSide,
    type MergeRequestDiffFileStatus,
} from "@codenautic/core"

/**
 * Provider-agnostic external git merge request payload.
 */
export interface IExternalGitMergeRequest {
    readonly id?: unknown
    readonly iid?: unknown
    readonly number?: unknown
    readonly title?: unknown
    readonly description?: unknown
    readonly sourceBranch?: unknown
    readonly source_branch?: unknown
    readonly targetBranch?: unknown
    readonly target_branch?: unknown
    readonly state?: unknown
    readonly author?: unknown
    readonly commits?: unknown
    readonly diffFiles?: unknown
    readonly changes?: unknown
    readonly [key: string]: unknown
}

/**
 * Provider-agnostic review comment payload returned by Git APIs.
 */
export interface IExternalGitReviewComment {
    readonly id?: unknown
    readonly body?: unknown
    readonly user?: unknown
    readonly created_at?: unknown
    readonly createdAt?: unknown
    readonly [key: string]: unknown
}

/**
 * GitHub review draft comment payload accepted by `pulls.createReview`.
 */
export interface IGitHubBatchReviewComment {
    readonly path: string
    readonly line: number
    readonly side: "LEFT" | "RIGHT"
    readonly body: string
}

const EMPTY_RECORD: Readonly<Record<string, unknown>> = {}

/**
 * Maps provider payload to platform-agnostic merge request DTO.
 *
 * @param payload External payload.
 * @returns Normalized merge request DTO.
 */
export function mapExternalMergeRequest(payload: IExternalGitMergeRequest): IMergeRequestDTO {
    const source = toRecord(payload) ?? EMPTY_RECORD

    return {
        id: readIdentifier(source, ["id", "iid"]),
        number: readNumber(source, ["number", "iid", "id"]),
        title: readString(source, ["title"]),
        description: readString(source, ["description"]),
        sourceBranch: readString(source, ["sourceBranch", "source_branch"]),
        targetBranch: readString(source, ["targetBranch", "target_branch"]),
        author: mapExternalAuthor(source["author"]),
        state: readString(source, ["state"], "unknown"),
        commits: mapExternalCommits(source["commits"]),
        diffFiles: mapExternalDiffFiles(resolveDiffFiles(source)),
    }
}

/**
 * Maps unknown external diff entries to normalized DTOs.
 *
 * @param rawDiffs Raw diff collection.
 * @returns Normalized diff DTO list.
 */
export function mapExternalDiffFiles(rawDiffs: unknown): readonly IMergeRequestDiffFileDTO[] {
    const diffs = toArray(rawDiffs)
    return diffs.map((entry) => {
        const record = toRecord(entry) ?? EMPTY_RECORD
        const patch = readStrictString(record, ["patch", "diff"])
        const oldPath = readOptionalString(record, ["oldPath", "old_path"])
        const base: IMergeRequestDiffFileDTO = {
            path: readString(record, ["path", "new_path", "filePath"]),
            status: normalizeDiffStatus(readString(record, ["status", "change_type"])),
            patch,
            hunks: normalizeHunks(record["hunks"], patch),
        }

        if (oldPath === undefined) {
            return base
        }

        return {
            ...base,
            oldPath,
        }
    })
}

/**
 * Converts inline comments to GitHub batch review comment payload.
 *
 * @param comments Inline comments from domain contract.
 * @returns GitHub review draft comments.
 */
export function toBatchReviewComments(
    comments: readonly IInlineCommentDTO[],
): readonly IGitHubBatchReviewComment[] {
    return comments.map((comment): IGitHubBatchReviewComment => {
        return {
            path: normalizeRequiredBatchText(comment.filePath, "comment.filePath"),
            line: normalizeBatchReviewLine(comment.line),
            side: normalizeBatchReviewSide(comment.side),
            body: normalizeRequiredBatchText(comment.body, "comment.body"),
        }
    })
}

/**
 * Maps provider review comment payload to generic comment DTO.
 *
 * @param comment Provider review comment payload.
 * @returns Generic comment DTO.
 */
export function reviewCommentToCommentDTO(comment: IExternalGitReviewComment): ICommentDTO {
    const source = toRecord(comment) ?? EMPTY_RECORD
    const user = toRecord(source["user"])

    return {
        id: readIdentifier(source, ["id"]),
        body: readString(source, ["body"]),
        author: readString(user, ["login", "name"]),
        createdAt: readString(source, ["created_at", "createdAt"]),
    }
}

/**
 * Resolves provider diff array from known fields.
 *
 * @param source Payload source.
 * @returns Diff-like value.
 */
function resolveDiffFiles(source: Readonly<Record<string, unknown>>): unknown {
    const diffFiles = source["diffFiles"]
    if (Array.isArray(diffFiles)) {
        return diffFiles
    }

    return source["changes"]
}

/**
 * Maps raw external author object to DTO.
 *
 * @param rawAuthor Raw author payload.
 * @returns Normalized author DTO.
 */
function mapExternalAuthor(rawAuthor: unknown): IMergeRequestAuthorDTO {
    const author = toRecord(rawAuthor)
    const username = readString(author, ["username", "login", "name"], "unknown")

    return {
        id: readIdentifier(author, ["id"], "unknown"),
        username,
        displayName: readString(author, ["displayName", "display_name", "name"], username),
    }
}

/**
 * Maps raw external commit collection.
 *
 * @param rawCommits Raw commits.
 * @returns Normalized commit DTO list.
 */
function mapExternalCommits(rawCommits: unknown): readonly IMergeRequestCommitDTO[] {
    const commits = toArray(rawCommits)

    return commits.map((commit) => {
        const record = toRecord(commit)

        return {
            id: readIdentifier(record, ["id", "sha"]),
            message: readString(record, ["message"]),
            author: readString(record, ["author", "author_name", "committer_name"]),
            timestamp: readString(record, ["timestamp", "created_at", "date"]),
        }
    })
}

/**
 * Normalizes provider status value to supported DTO status.
 *
 * @param rawStatus Raw status string.
 * @returns Normalized DTO status.
 */
function normalizeDiffStatus(rawStatus: string): MergeRequestDiffFileStatus {
    const normalized = rawStatus.trim().toLowerCase()

    if (normalized === "added" || normalized === "add" || normalized === "new") {
        return MERGE_REQUEST_DIFF_FILE_STATUS.ADDED
    }

    if (normalized === "deleted" || normalized === "delete" || normalized === "removed") {
        return MERGE_REQUEST_DIFF_FILE_STATUS.DELETED
    }

    if (normalized === "renamed" || normalized === "rename") {
        return MERGE_REQUEST_DIFF_FILE_STATUS.RENAMED
    }

    return MERGE_REQUEST_DIFF_FILE_STATUS.MODIFIED
}

/**
 * Builds hunk list from explicit hunks or patch body.
 *
 * @param rawHunks Optional hunks payload.
 * @param patch Normalized patch value.
 * @returns Normalized hunk list.
 */
function normalizeHunks(rawHunks: unknown, patch: string): readonly string[] {
    const explicitHunks: string[] = []
    const source = toArray(rawHunks)

    for (const entry of source) {
        if (typeof entry !== "string") {
            continue
        }

        const normalized = entry.trim()
        if (normalized.length > 0) {
            explicitHunks.push(normalized)
        }
    }

    if (explicitHunks.length > 0) {
        return explicitHunks
    }

    const trimmedPatch = patch.trim()
    if (trimmedPatch.length === 0) {
        return []
    }

    return [trimmedPatch]
}

/**
 * Normalizes required text for batch review payload fields.
 *
 * @param value Raw text value.
 * @param fieldName Field label used in error message.
 * @returns Trimmed non-empty string.
 */
function normalizeRequiredBatchText(value: string, fieldName: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error(`${fieldName} cannot be empty`)
    }

    return normalized
}

/**
 * Normalizes batch review line number.
 *
 * @param line Raw line value.
 * @returns Positive line number.
 */
function normalizeBatchReviewLine(line: number): number {
    if (Number.isInteger(line) === false || line <= 0) {
        throw new Error("comment.line must be positive integer")
    }

    return line
}

/**
 * Normalizes inline side to GitHub side literals.
 *
 * @param side Raw inline side.
 * @returns GitHub side literal.
 */
function normalizeBatchReviewSide(side: InlineCommentSide): "LEFT" | "RIGHT" {
    return side === INLINE_COMMENT_SIDE.LEFT ? INLINE_COMMENT_SIDE.LEFT : INLINE_COMMENT_SIDE.RIGHT
}

/**
 * Reads required string by candidate keys.
 *
 * @param source Source record.
 * @param keys Candidate keys.
 * @param fallback Default value.
 * @returns Normalized string.
 */
function readString(
    source: Readonly<Record<string, unknown>> | null,
    keys: readonly string[],
    fallback = "",
): string {
    for (const key of keys) {
        const value = source?.[key]
        const normalized = toStringValue(value)

        if (normalized !== undefined) {
            return normalized
        }
    }

    return fallback
}

/**
 * Reads strict string by candidate keys without number coercion.
 *
 * @param source Source record.
 * @param keys Candidate keys.
 * @param fallback Default value.
 * @returns Normalized strict string.
 */
function readStrictString(
    source: Readonly<Record<string, unknown>> | null,
    keys: readonly string[],
    fallback = "",
): string {
    for (const key of keys) {
        const value = source?.[key]
        if (typeof value === "string") {
            return value.trim()
        }
    }

    return fallback
}

/**
 * Reads optional string by candidate keys.
 *
 * @param source Source record.
 * @param keys Candidate keys.
 * @returns Normalized optional string.
 */
function readOptionalString(
    source: Readonly<Record<string, unknown>> | null,
    keys: readonly string[],
): string | undefined {
    const value = readString(source, keys)
    if (value.length === 0) {
        return undefined
    }

    return value
}

/**
 * Reads numeric identifier from candidate fields.
 *
 * @param source Source record.
 * @param keys Candidate keys.
 * @param fallback Default value.
 * @returns Parsed number.
 */
function readNumber(
    source: Readonly<Record<string, unknown>> | null,
    keys: readonly string[],
    fallback = 0,
): number {
    for (const key of keys) {
        const value = source?.[key]
        const parsed = toNumberValue(value)

        if (parsed !== undefined) {
            return parsed
        }
    }

    return fallback
}

/**
 * Reads string identifier by candidate keys.
 *
 * @param source Source record.
 * @param keys Candidate keys.
 * @param fallback Default value.
 * @returns Identifier.
 */
function readIdentifier(
    source: Readonly<Record<string, unknown>> | null,
    keys: readonly string[],
    fallback = "",
): string {
    for (const key of keys) {
        const value = source?.[key]
        const parsed = toStringValue(value)

        if (parsed !== undefined) {
            return parsed
        }
    }

    return fallback
}

/**
 * Converts unknown to plain record.
 *
 * @param value Unknown candidate.
 * @returns Plain record or null.
 */
function toRecord(value: unknown): Readonly<Record<string, unknown>> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null
    }

    return value as Readonly<Record<string, unknown>>
}

/**
 * Converts unknown to readonly array.
 *
 * @param value Unknown candidate.
 * @returns Array or empty list.
 */
function toArray(value: unknown): readonly unknown[] {
    if (Array.isArray(value)) {
        return value
    }

    return []
}

/**
 * Converts unknown to trimmed string.
 *
 * @param value Unknown candidate.
 * @returns Trimmed string when available.
 */
function toStringValue(value: unknown): string | undefined {
    if (typeof value === "string") {
        return value.trim()
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value)
    }

    return undefined
}

/**
 * Converts unknown to finite number.
 *
 * @param value Unknown candidate.
 * @returns Parsed number.
 */
function toNumberValue(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value)
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number.parseInt(value, 10)
        if (Number.isFinite(parsed)) {
            return parsed
        }
    }

    return undefined
}
