import {FilePath, type IParsedSourceFileDTO} from "@codenautic/core"

import {
    AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE,
    AstCrossFileIssueAggregatorError,
} from "./ast-cross-file-issue-aggregator.error"

const DEFAULT_MAX_ISSUES = 200

const ISSUE_SEVERITY_ORDER = [
    "HIGH",
    "MEDIUM",
    "LOW",
] as const

const ISSUE_SOURCE_ORDER = [
    "CIRCULAR_DEPENDENCY",
    "INTERFACE_CONTRACT",
    "SHARED_STATE",
    "TYPE_FLOW",
    "BREAKING_CHANGE",
    "CUSTOM",
] as const

/**
 * Cross-file issue severity bucket.
 */
export const AST_CROSS_FILE_ISSUE_SEVERITY = {
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
} as const

/**
 * Cross-file issue severity literal.
 */
export type AstCrossFileIssueSeverity =
    (typeof AST_CROSS_FILE_ISSUE_SEVERITY)[keyof typeof AST_CROSS_FILE_ISSUE_SEVERITY]

/**
 * Cross-file issue source category.
 */
export const AST_CROSS_FILE_ISSUE_SOURCE = {
    CIRCULAR_DEPENDENCY: "CIRCULAR_DEPENDENCY",
    INTERFACE_CONTRACT: "INTERFACE_CONTRACT",
    SHARED_STATE: "SHARED_STATE",
    TYPE_FLOW: "TYPE_FLOW",
    BREAKING_CHANGE: "BREAKING_CHANGE",
    CUSTOM: "CUSTOM",
} as const

/**
 * Cross-file issue source literal.
 */
export type AstCrossFileIssueSource =
    (typeof AST_CROSS_FILE_ISSUE_SOURCE)[keyof typeof AST_CROSS_FILE_ISSUE_SOURCE]

/**
 * One raw cross-file issue entry for aggregation.
 */
export interface IAstCrossFileIssueInput {
    /**
     * Optional precomputed stable issue identifier.
     */
    readonly id?: string

    /**
     * Issue source category.
     */
    readonly source: AstCrossFileIssueSource

    /**
     * Issue severity bucket.
     */
    readonly severity: AstCrossFileIssueSeverity

    /**
     * Issue subtype from producer.
     */
    readonly type: string

    /**
     * Repository-relative primary file path.
     */
    readonly filePath: string

    /**
     * Stable human-readable issue message.
     */
    readonly message: string

    /**
     * Optional related file paths for cross-file context.
     */
    readonly relatedFilePaths?: readonly string[]
}

/**
 * One normalized aggregated cross-file issue.
 */
export interface IAstCrossFileIssue {
    /**
     * Stable deterministic issue identifier.
     */
    readonly id: string

    /**
     * Issue source category.
     */
    readonly source: AstCrossFileIssueSource

    /**
     * Issue severity bucket.
     */
    readonly severity: AstCrossFileIssueSeverity

    /**
     * Issue subtype from producer.
     */
    readonly type: string

    /**
     * Repository-relative primary file path.
     */
    readonly filePath: string

    /**
     * Stable human-readable issue message.
     */
    readonly message: string

    /**
     * Sorted unique related file paths.
     */
    readonly relatedFilePaths: readonly string[]
}

/**
 * Per-file aggregated issue summary.
 */
export interface IAstCrossFileIssueFileSummary {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * Number of issues assigned to file.
     */
    readonly issueCount: number

    /**
     * Number of high-severity issues in file.
     */
    readonly highSeverityCount: number

    /**
     * Number of unique related files referenced by file issues.
     */
    readonly relatedFileCount: number

    /**
     * Issue counts by severity for file.
     */
    readonly bySeverity: Record<AstCrossFileIssueSeverity, number>

    /**
     * Issue counts by source for file.
     */
    readonly bySource: Record<AstCrossFileIssueSource, number>
}

/**
 * Cross-file issue aggregation summary.
 */
export interface IAstCrossFileIssueAggregatorSummary {
    /**
     * Number of analyzed files (after optional filter).
     */
    readonly scannedFileCount: number

    /**
     * Number of returned issues.
     */
    readonly issueCount: number

    /**
     * Number of files containing issues.
     */
    readonly fileCount: number

    /**
     * Number of high-severity returned issues.
     */
    readonly highSeverityCount: number

    /**
     * Whether issue output was truncated.
     */
    readonly truncated: boolean

    /**
     * Number of omitted issues after truncation.
     */
    readonly truncatedIssueCount: number

    /**
     * Returned issue counts by severity.
     */
    readonly bySeverity: Record<AstCrossFileIssueSeverity, number>

    /**
     * Returned issue counts by source.
     */
    readonly bySource: Record<AstCrossFileIssueSource, number>
}

/**
 * Cross-file issue aggregation result payload.
 */
export interface IAstCrossFileIssueAggregatorResult {
    /**
     * Deterministic sorted aggregated issues.
     */
    readonly issues: readonly IAstCrossFileIssue[]

    /**
     * Deterministic file-level summaries.
     */
    readonly fileSummaries: readonly IAstCrossFileIssueFileSummary[]

    /**
     * Aggregated summary.
     */
    readonly summary: IAstCrossFileIssueAggregatorSummary
}

/**
 * Runtime input for cross-file issue aggregation.
 */
export interface IAstCrossFileIssueAggregatorInput {
    /**
     * Parsed source files used for file-path validation.
     */
    readonly files: readonly IParsedSourceFileDTO[]

    /**
     * Raw issue entries from cross-file detectors.
     */
    readonly issues: readonly IAstCrossFileIssueInput[]

    /**
     * Optional file-path subset filter.
     */
    readonly filePaths?: readonly string[]

    /**
     * Optional max number of returned issues.
     */
    readonly maxIssues?: number
}

/**
 * Options for cross-file issue aggregator service.
 */
export interface IAstCrossFileIssueAggregatorServiceOptions {
    /**
     * Optional default max number of returned issues.
     */
    readonly defaultMaxIssues?: number
}

/**
 * Cross-file issue aggregator contract.
 */
export interface IAstCrossFileIssueAggregatorService {
    /**
     * Aggregates cross-file issues into deterministic normalized projection.
     *
     * @param input Parsed files, issues and optional runtime settings.
     * @returns Deterministic aggregated issue payload.
     */
    aggregate(
        input: IAstCrossFileIssueAggregatorInput,
    ): Promise<IAstCrossFileIssueAggregatorResult>
}

interface IAggregationContext {
    readonly allFilePathSet: ReadonlySet<string>
    readonly sourceFilePathSet: ReadonlySet<string>
}

interface IMutableFileSummary {
    readonly filePath: string
    issueCount: number
    highSeverityCount: number
    readonly bySeverity: Record<AstCrossFileIssueSeverity, number>
    readonly bySource: Record<AstCrossFileIssueSource, number>
    readonly relatedPathSet: Set<string>
}

/**
 * Aggregates issues produced by cross-file analyzers.
 */
export class AstCrossFileIssueAggregatorService
    implements IAstCrossFileIssueAggregatorService
{
    private readonly defaultMaxIssues: number

    /**
     * Creates cross-file issue aggregator service.
     *
     * @param options Optional aggregator configuration.
     */
    public constructor(options: IAstCrossFileIssueAggregatorServiceOptions = {}) {
        this.defaultMaxIssues = validateMaxIssues(
            options.defaultMaxIssues ?? DEFAULT_MAX_ISSUES,
        )
    }

    /**
     * Aggregates cross-file issues into deterministic normalized projection.
     *
     * @param input Parsed files, issues and optional runtime settings.
     * @returns Deterministic aggregated issue payload.
     */
    public aggregate(
        input: IAstCrossFileIssueAggregatorInput,
    ): Promise<IAstCrossFileIssueAggregatorResult> {
        const context = normalizeAggregationContext(input.files, input.filePaths)
        const maxIssues = validateMaxIssues(input.maxIssues ?? this.defaultMaxIssues)
        const normalizedIssues = normalizeIssues(input.issues, context)
        const truncatedIssues = normalizedIssues.slice(0, maxIssues)
        const truncatedIssueCount = Math.max(0, normalizedIssues.length - truncatedIssues.length)
        const fileSummaries = buildFileSummaries(truncatedIssues)

        return Promise.resolve({
            issues: truncatedIssues,
            fileSummaries,
            summary: createSummary(
                context.sourceFilePathSet.size,
                truncatedIssues,
                fileSummaries.length,
                truncatedIssueCount,
            ),
        })
    }
}

/**
 * Validates max issue cap.
 *
 * @param maxIssues Raw cap value.
 * @returns Validated max issue cap.
 */
function validateMaxIssues(maxIssues: number): number {
    if (Number.isSafeInteger(maxIssues) === false || maxIssues < 1) {
        throw new AstCrossFileIssueAggregatorError(
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_MAX_ISSUES,
            {maxIssues},
        )
    }

    return maxIssues
}

/**
 * Normalizes parsed files and optional file-path subset.
 *
 * @param files Parsed source files.
 * @param filePaths Optional file-path subset filter.
 * @returns Normalized immutable aggregation context.
 */
function normalizeAggregationContext(
    files: readonly IParsedSourceFileDTO[],
    filePaths?: readonly string[],
): IAggregationContext {
    if (files.length === 0) {
        throw new AstCrossFileIssueAggregatorError(
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.EMPTY_FILES,
        )
    }

    const normalizedFilePaths = normalizeParsedFilePaths(files)
    const allFilePathSet = new Set<string>(normalizedFilePaths)

    if (filePaths === undefined) {
        return {
            allFilePathSet,
            sourceFilePathSet: new Set(normalizedFilePaths),
        }
    }

    const normalizedFilterPaths = normalizeFilterFilePaths(filePaths)
    const sourceFilePathSet = new Set<string>()

    for (const filePath of normalizedFilterPaths) {
        if (allFilePathSet.has(filePath)) {
            sourceFilePathSet.add(filePath)
        }
    }

    return {
        allFilePathSet,
        sourceFilePathSet,
    }
}

/**
 * Normalizes parsed file paths and rejects duplicates.
 *
 * @param files Parsed source files.
 * @returns Sorted unique parsed file paths.
 */
function normalizeParsedFilePaths(files: readonly IParsedSourceFileDTO[]): readonly string[] {
    const filePathSet = new Set<string>()

    for (const file of files) {
        const normalizedFilePath = normalizeFilePath(
            file.filePath,
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_FILE_PATH,
        )

        if (filePathSet.has(normalizedFilePath)) {
            throw new AstCrossFileIssueAggregatorError(
                AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.DUPLICATE_FILE_PATH,
                {filePath: normalizedFilePath},
            )
        }

        filePathSet.add(normalizedFilePath)
    }

    return [...filePathSet].sort((left, right) => left.localeCompare(right))
}

/**
 * Normalizes optional file-path filter.
 *
 * @param filePaths Raw filter paths.
 * @returns Sorted unique normalized filter paths.
 */
function normalizeFilterFilePaths(filePaths: readonly string[]): readonly string[] {
    if (filePaths.length === 0) {
        throw new AstCrossFileIssueAggregatorError(
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    }

    const normalizedPathSet = new Set<string>()

    for (const filePath of filePaths) {
        normalizedPathSet.add(
            normalizeFilePath(filePath, AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_FILE_PATH),
        )
    }

    return [...normalizedPathSet].sort((left, right) => left.localeCompare(right))
}

/**
 * Normalizes and validates one repository-relative file path.
 *
 * @param filePath Raw file path.
 * @param code Error code emitted on invalid path.
 * @returns Normalized path.
 */
function normalizeFilePath(
    filePath: string,
    code:
        | typeof AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_FILE_PATH
        | typeof AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_RELATED_FILE_PATH,
): string {
    try {
        return FilePath.create(filePath).toString()
    } catch {
        throw new AstCrossFileIssueAggregatorError(code, {filePath})
    }
}

/**
 * Normalizes raw issue payload into deterministic unique sorted issue list.
 *
 * @param issues Raw issue payload.
 * @param context Normalized aggregation context.
 * @returns Deterministic normalized issue list.
 */
function normalizeIssues(
    issues: readonly IAstCrossFileIssueInput[],
    context: IAggregationContext,
): readonly IAstCrossFileIssue[] {
    const normalizedIssues = new Map<string, IAstCrossFileIssue>()

    for (const issue of issues) {
        const normalizedIssue = normalizeIssue(issue, context)
        if (normalizedIssue === undefined) {
            continue
        }

        if (normalizedIssues.has(normalizedIssue.id) === false) {
            normalizedIssues.set(normalizedIssue.id, normalizedIssue)
        }
    }

    return [...normalizedIssues.values()].sort(compareIssues)
}

/**
 * Normalizes one issue entry.
 *
 * @param issue Raw issue entry.
 * @param context Normalized aggregation context.
 * @returns Normalized issue, or undefined when filtered out.
 */
function normalizeIssue(
    issue: IAstCrossFileIssueInput,
    context: IAggregationContext,
): IAstCrossFileIssue | undefined {
    const filePath = normalizeFilePath(
        issue.filePath,
        AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_FILE_PATH,
    )

    if (context.allFilePathSet.has(filePath) === false) {
        throw new AstCrossFileIssueAggregatorError(
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.ISSUE_FILE_NOT_FOUND,
            {filePath},
        )
    }

    if (context.sourceFilePathSet.has(filePath) === false) {
        return undefined
    }

    const source = validateSource(issue.source)
    const severity = validateSeverity(issue.severity)
    const type = validateIssueType(issue.type)
    const message = validateIssueMessage(issue.message)
    const relatedFilePaths = normalizeRelatedFilePaths(
        issue.relatedFilePaths ?? [],
        filePath,
        context.allFilePathSet,
    )
    const id = normalizeIssueId(issue.id) ?? createIssueId({
        source,
        severity,
        type,
        filePath,
        message,
        relatedFilePaths,
    })

    return {
        id,
        source,
        severity,
        type,
        filePath,
        message,
        relatedFilePaths,
    }
}

/**
 * Validates issue source.
 *
 * @param source Raw source.
 * @returns Validated source.
 */
function validateSource(source: string): AstCrossFileIssueSource {
    if (
        source === AST_CROSS_FILE_ISSUE_SOURCE.CIRCULAR_DEPENDENCY ||
        source === AST_CROSS_FILE_ISSUE_SOURCE.INTERFACE_CONTRACT ||
        source === AST_CROSS_FILE_ISSUE_SOURCE.SHARED_STATE ||
        source === AST_CROSS_FILE_ISSUE_SOURCE.TYPE_FLOW ||
        source === AST_CROSS_FILE_ISSUE_SOURCE.BREAKING_CHANGE ||
        source === AST_CROSS_FILE_ISSUE_SOURCE.CUSTOM
    ) {
        return source
    }

    throw new AstCrossFileIssueAggregatorError(
        AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_SOURCE,
        {source},
    )
}

/**
 * Validates issue severity.
 *
 * @param severity Raw severity.
 * @returns Validated severity.
 */
function validateSeverity(severity: string): AstCrossFileIssueSeverity {
    if (
        severity === AST_CROSS_FILE_ISSUE_SEVERITY.HIGH ||
        severity === AST_CROSS_FILE_ISSUE_SEVERITY.MEDIUM ||
        severity === AST_CROSS_FILE_ISSUE_SEVERITY.LOW
    ) {
        return severity
    }

    throw new AstCrossFileIssueAggregatorError(
        AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_SEVERITY,
        {severity},
    )
}

/**
 * Validates issue subtype.
 *
 * @param issueType Raw issue subtype.
 * @returns Trimmed validated issue subtype.
 */
function validateIssueType(issueType: string): string {
    const normalizedIssueType = issueType.trim()

    if (normalizedIssueType.length === 0) {
        throw new AstCrossFileIssueAggregatorError(
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_ISSUE_TYPE,
            {issueType},
        )
    }

    return normalizedIssueType
}

/**
 * Validates issue message.
 *
 * @param message Raw issue message.
 * @returns Trimmed validated issue message.
 */
function validateIssueMessage(message: string): string {
    const normalizedMessage = message.trim()

    if (normalizedMessage.length === 0) {
        throw new AstCrossFileIssueAggregatorError(
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_ISSUE_MESSAGE,
        )
    }

    return normalizedMessage
}

/**
 * Normalizes optional issue id.
 *
 * @param issueId Raw optional issue id.
 * @returns Trimmed issue id or undefined when absent.
 */
function normalizeIssueId(issueId?: string): string | undefined {
    if (issueId === undefined) {
        return undefined
    }

    const normalizedIssueId = issueId.trim()
    if (normalizedIssueId.length === 0) {
        throw new AstCrossFileIssueAggregatorError(
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_ISSUE_ID,
            {issueId},
        )
    }

    return normalizedIssueId
}

/**
 * Normalizes related file paths.
 *
 * @param relatedFilePaths Raw related file paths.
 * @param primaryFilePath Primary issue file path.
 * @param allFilePathSet Parsed file-path set.
 * @returns Sorted unique normalized related file paths.
 */
function normalizeRelatedFilePaths(
    relatedFilePaths: readonly string[],
    primaryFilePath: string,
    allFilePathSet: ReadonlySet<string>,
): readonly string[] {
    const normalizedPathSet = new Set<string>()

    for (const relatedFilePath of relatedFilePaths) {
        const normalizedFilePath = normalizeFilePath(
            relatedFilePath,
            AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.INVALID_RELATED_FILE_PATH,
        )

        if (allFilePathSet.has(normalizedFilePath) === false) {
            throw new AstCrossFileIssueAggregatorError(
                AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE.RELATED_FILE_NOT_FOUND,
                {filePath: normalizedFilePath},
            )
        }

        if (normalizedFilePath !== primaryFilePath) {
            normalizedPathSet.add(normalizedFilePath)
        }
    }

    return [...normalizedPathSet].sort((left, right) => left.localeCompare(right))
}

/**
 * Builds deterministic fallback issue identifier.
 *
 * @param issue Normalized issue fields.
 * @returns Stable issue identifier.
 */
function createIssueId(issue: Omit<IAstCrossFileIssue, "id">): string {
    return [
        issue.source,
        issue.severity,
        issue.type,
        issue.filePath,
        issue.relatedFilePaths.join(","),
        issue.message,
    ].join("|")
}

/**
 * Compares issues deterministically by severity, file and source footprint.
 *
 * @param left Left issue.
 * @param right Right issue.
 * @returns Sort result.
 */
function compareIssues(left: IAstCrossFileIssue, right: IAstCrossFileIssue): number {
    if (left.severity !== right.severity) {
        return ISSUE_SEVERITY_ORDER.indexOf(left.severity) - ISSUE_SEVERITY_ORDER.indexOf(right.severity)
    }

    if (left.filePath !== right.filePath) {
        return left.filePath.localeCompare(right.filePath)
    }

    if (left.source !== right.source) {
        return ISSUE_SOURCE_ORDER.indexOf(left.source) - ISSUE_SOURCE_ORDER.indexOf(right.source)
    }

    if (left.type !== right.type) {
        return left.type.localeCompare(right.type)
    }

    return left.id.localeCompare(right.id)
}

/**
 * Builds deterministic per-file summaries from normalized issues.
 *
 * @param issues Normalized issues.
 * @returns Deterministic file summaries.
 */
function buildFileSummaries(
    issues: readonly IAstCrossFileIssue[],
): readonly IAstCrossFileIssueFileSummary[] {
    const summaryByFilePath = new Map<string, IMutableFileSummary>()

    for (const issue of issues) {
        const summary = readOrCreateFileSummary(summaryByFilePath, issue.filePath)
        summary.issueCount += 1
        summary.bySeverity[issue.severity] += 1
        summary.bySource[issue.source] += 1

        if (issue.severity === AST_CROSS_FILE_ISSUE_SEVERITY.HIGH) {
            summary.highSeverityCount += 1
        }

        for (const relatedFilePath of issue.relatedFilePaths) {
            summary.relatedPathSet.add(relatedFilePath)
        }
    }

    return [...summaryByFilePath.values()]
        .map((summary): IAstCrossFileIssueFileSummary => {
            return {
                filePath: summary.filePath,
                issueCount: summary.issueCount,
                highSeverityCount: summary.highSeverityCount,
                relatedFileCount: summary.relatedPathSet.size,
                bySeverity: summary.bySeverity,
                bySource: summary.bySource,
            }
        })
        .sort((left, right) => left.filePath.localeCompare(right.filePath))
}

/**
 * Reads mutable per-file summary from map or creates new one.
 *
 * @param summaryByFilePath Mutable summary map.
 * @param filePath Summary file path.
 * @returns Mutable summary bucket.
 */
function readOrCreateFileSummary(
    summaryByFilePath: Map<string, IMutableFileSummary>,
    filePath: string,
): IMutableFileSummary {
    const existingSummary = summaryByFilePath.get(filePath)
    if (existingSummary !== undefined) {
        return existingSummary
    }

    const createdSummary: IMutableFileSummary = {
        filePath,
        issueCount: 0,
        highSeverityCount: 0,
        bySeverity: createEmptyBySeverityRecord(),
        bySource: createEmptyBySourceRecord(),
        relatedPathSet: new Set<string>(),
    }
    summaryByFilePath.set(filePath, createdSummary)
    return createdSummary
}

/**
 * Creates empty issue-by-severity record.
 *
 * @returns Zero-initialized severity record.
 */
function createEmptyBySeverityRecord(): Record<AstCrossFileIssueSeverity, number> {
    return {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
    }
}

/**
 * Creates empty issue-by-source record.
 *
 * @returns Zero-initialized source record.
 */
function createEmptyBySourceRecord(): Record<AstCrossFileIssueSource, number> {
    return {
        CIRCULAR_DEPENDENCY: 0,
        INTERFACE_CONTRACT: 0,
        SHARED_STATE: 0,
        TYPE_FLOW: 0,
        BREAKING_CHANGE: 0,
        CUSTOM: 0,
    }
}

/**
 * Creates summary payload from normalized aggregation output.
 *
 * @param scannedFileCount Number of scanned files.
 * @param issues Returned issues.
 * @param fileCount Number of files with issues.
 * @param truncatedIssueCount Omitted issue count after truncation.
 * @returns Aggregated summary payload.
 */
function createSummary(
    scannedFileCount: number,
    issues: readonly IAstCrossFileIssue[],
    fileCount: number,
    truncatedIssueCount: number,
): IAstCrossFileIssueAggregatorSummary {
    const bySeverity = createEmptyBySeverityRecord()
    const bySource = createEmptyBySourceRecord()
    let highSeverityCount = 0

    for (const issue of issues) {
        bySeverity[issue.severity] += 1
        bySource[issue.source] += 1

        if (issue.severity === AST_CROSS_FILE_ISSUE_SEVERITY.HIGH) {
            highSeverityCount += 1
        }
    }

    return {
        scannedFileCount,
        issueCount: issues.length,
        fileCount,
        highSeverityCount,
        truncated: truncatedIssueCount > 0,
        truncatedIssueCount,
        bySeverity,
        bySource,
    }
}
