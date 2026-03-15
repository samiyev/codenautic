import type {
    IBlameData,
    ICommitInfo,
    IFileOwnership,
    IFileOwnershipContributor,
    IGitProvider,
    IOwnershipContributor,
    IOwnershipProvider,
} from "@codenautic/core"

import {
    GIT_OWNERSHIP_PROVIDER_ERROR_CODE,
    GitOwnershipProviderError,
} from "./git-ownership-provider.error"

const DEFAULT_REF = "HEAD"
const DEFAULT_MAX_HISTORY_COUNT = 200
const DEFAULT_BUS_FACTOR_THRESHOLD = 0.8

interface IContributorOwnershipAccumulator {
    readonly contributorKey: string
    readonly name: string
    readonly email: string
    commitCount: number
    linesChanged: number
    lastCommitDate: string
    lastCommitDateMs: number
}

/**
 * Runtime options for git ownership provider.
 */
export interface IGitOwnershipProviderOptions {
    /**
     * Bound git provider instance for one repository context.
     */
    readonly gitProvider: IGitProvider

    /**
     * Git reference used for history and blame resolution.
     */
    readonly defaultRef?: string

    /**
     * Commit history limit per file ownership request.
     */
    readonly maxHistoryCount?: number

    /**
     * Contributor coverage ratio used to compute bus factor.
     */
    readonly busFactorThreshold?: number
}

/**
 * Ownership analytics provider backed by git history and blame APIs.
 */
export class GitOwnershipProvider implements IOwnershipProvider {
    private readonly gitProvider: IGitProvider
    private readonly defaultRef: string
    private readonly maxHistoryCount: number
    private readonly busFactorThreshold: number

    /**
     * Creates git ownership provider.
     *
     * @param options Runtime options.
     */
    public constructor(options: IGitOwnershipProviderOptions) {
        this.gitProvider = options.gitProvider
        this.defaultRef = validateDefaultRef(options.defaultRef ?? DEFAULT_REF)
        this.maxHistoryCount = validateMaxHistoryCount(
            options.maxHistoryCount ?? DEFAULT_MAX_HISTORY_COUNT,
        )
        this.busFactorThreshold = validateBusFactorThreshold(
            options.busFactorThreshold ?? DEFAULT_BUS_FACTOR_THRESHOLD,
        )
    }

    /**
     * Builds ownership snapshot for one repository file batch.
     *
     * @param repositoryId Repository identifier.
     * @param filePaths Repository-relative file paths.
     * @returns Ownership entries in input file order.
     */
    public async getFileOwnership(
        repositoryId: string,
        filePaths: readonly string[],
    ): Promise<readonly IFileOwnership[]> {
        const normalizedRepositoryId = validateRepositoryId(repositoryId)
        const normalizedFilePaths = filePaths.map((filePath): string => {
            return validateFilePath(filePath)
        })

        try {
            return Promise.all(
                normalizedFilePaths.map((filePath): Promise<IFileOwnership> => {
                    return this.buildOwnershipForFile(normalizedRepositoryId, filePath)
                }),
            )
        } catch (error) {
            throw wrapOwnershipFailure(error, normalizedRepositoryId)
        }
    }

    /**
     * Loads repository contributors mapped from provider contributor stats.
     *
     * @param repositoryId Repository identifier.
     * @returns Contributor summaries sorted by commits then name.
     */
    public async getContributors(repositoryId: string): Promise<readonly IOwnershipContributor[]> {
        const normalizedRepositoryId = validateRepositoryId(repositoryId)

        try {
            const stats = await this.gitProvider.getContributorStats(this.defaultRef, {
                maxCount: this.maxHistoryCount,
            })

            return stats
                .map((stat): IOwnershipContributor => {
                    return {
                        name: stat.name,
                        email: stat.email,
                        commitCount: stat.commitCount,
                    }
                })
                .sort(compareOwnershipContributors)
        } catch (error) {
            throw wrapContributorsFailure(error, normalizedRepositoryId)
        }
    }

    /**
     * Builds file ownership from commit history and blame ranges.
     *
     * @param repositoryId Repository identifier.
     * @param filePath Repository-relative file path.
     * @returns File ownership snapshot.
     */
    private async buildOwnershipForFile(
        repositoryId: string,
        filePath: string,
    ): Promise<IFileOwnership> {
        try {
            const [history, blameRanges] = await Promise.all([
                this.gitProvider.getCommitHistory(this.defaultRef, {
                    path: filePath,
                    maxCount: this.maxHistoryCount,
                }),
                this.gitProvider.getBlameData(filePath, this.defaultRef),
            ])

            return toFileOwnership(
                filePath,
                history,
                blameRanges,
                this.busFactorThreshold,
            )
        } catch (error) {
            throw wrapOwnershipFailure(error, repositoryId, filePath)
        }
    }
}

/**
 * Builds file ownership snapshot from history and blame payloads.
 *
 * @param filePath Repository-relative file path.
 * @param history Ordered commit history for file.
 * @param blameRanges File blame ranges.
 * @param busFactorThreshold Contributor coverage ratio.
 * @returns File ownership snapshot.
 */
function toFileOwnership(
    filePath: string,
    history: readonly ICommitInfo[],
    blameRanges: readonly IBlameData[],
    busFactorThreshold: number,
): IFileOwnership {
    const contributors = accumulateFileContributors(history, blameRanges)
    const contributorEntries = Array.from(contributors.values()).map(
        toFileOwnershipContributor,
    )
    contributorEntries.sort(compareFileOwnershipContributors)

    const latestHistoryCommit = resolveLatestHistoryCommit(history)
    const latestContributor = resolveLatestContributor(contributors)
    const lastModified = resolveLastModifiedMetadata(latestHistoryCommit, latestContributor)
    const primaryOwner = resolvePrimaryOwner(contributorEntries, lastModified.lastModifiedBy)
    const busFactor = calculateBusFactor(
        contributorEntries,
        busFactorThreshold,
        hasHistoryData(latestHistoryCommit),
    )

    return {
        filePath,
        primaryOwner,
        contributors: contributorEntries,
        lastModifiedBy: lastModified.lastModifiedBy,
        lastModifiedDate: lastModified.lastModifiedDate,
        busFactor,
    }
}

/**
 * Returns flag indicating whether commit history contains at least one entry.
 *
 * @param latestHistoryCommit Latest history commit candidate.
 * @returns True when history exists.
 */
function hasHistoryData(latestHistoryCommit: ICommitInfo | undefined): boolean {
    return latestHistoryCommit !== undefined
}

interface ILastModifiedMetadata {
    readonly lastModifiedBy: string
    readonly lastModifiedDate: string
}

/**
 * Resolves last-modified metadata from history-first source selection.
 *
 * @param latestHistoryCommit Latest history commit candidate.
 * @param latestContributor Latest contributor candidate from blame/history mix.
 * @returns Last-modified metadata pair.
 */
function resolveLastModifiedMetadata(
    latestHistoryCommit: ICommitInfo | undefined,
    latestContributor: IContributorOwnershipAccumulator | undefined,
): ILastModifiedMetadata {
    if (latestHistoryCommit !== undefined) {
        return {
            lastModifiedBy: latestHistoryCommit.authorName,
            lastModifiedDate: latestHistoryCommit.date,
        }
    }

    if (latestContributor !== undefined) {
        return {
            lastModifiedBy: latestContributor.name,
            lastModifiedDate: latestContributor.lastCommitDate,
        }
    }

    return {
        lastModifiedBy: "",
        lastModifiedDate: "",
    }
}

/**
 * Resolves primary owner using contributor ranking and fallback owner.
 *
 * @param contributors Sorted contributor list.
 * @param fallbackOwner Fallback owner when contributor list is empty.
 * @returns Primary owner name.
 */
function resolvePrimaryOwner(
    contributors: readonly IFileOwnershipContributor[],
    fallbackOwner: string,
): string {
    const dominantContributor = contributors[0]
    if (dominantContributor !== undefined) {
        return dominantContributor.name
    }

    return fallbackOwner
}

/**
 * Aggregates contributor metrics from commit history and blame ranges.
 *
 * @param history Ordered commit history for one file.
 * @param blameRanges Blame ranges for one file.
 * @returns Contributor accumulators keyed by contributor identity.
 */
function accumulateFileContributors(
    history: readonly ICommitInfo[],
    blameRanges: readonly IBlameData[],
): Map<string, IContributorOwnershipAccumulator> {
    const contributors = new Map<string, IContributorOwnershipAccumulator>()

    for (const commit of history) {
        const contributorKey = buildContributorKey(commit.authorName, commit.authorEmail)
        const accumulator = upsertContributor(
            contributors,
            contributorKey,
            commit.authorName,
            commit.authorEmail,
        )
        accumulator.commitCount += 1
        updateLastCommitDate(accumulator, commit.date)
    }

    for (const blameRange of blameRanges) {
        const contributorKey = buildContributorKey(
            blameRange.authorName,
            blameRange.authorEmail,
        )
        const accumulator = upsertContributor(
            contributors,
            contributorKey,
            blameRange.authorName,
            blameRange.authorEmail,
        )
        accumulator.linesChanged += resolveLineCount(blameRange)
        updateLastCommitDate(accumulator, blameRange.date)
    }

    return contributors
}

/**
 * Inserts contributor accumulator into map when key is missing.
 *
 * @param contributors Contributor map.
 * @param contributorKey Stable contributor key.
 * @param name Contributor display name.
 * @param email Contributor email.
 * @returns Contributor accumulator reference.
 */
function upsertContributor(
    contributors: Map<string, IContributorOwnershipAccumulator>,
    contributorKey: string,
    name: string,
    email: string,
): IContributorOwnershipAccumulator {
    const existing = contributors.get(contributorKey)
    if (existing !== undefined) {
        return existing
    }

    const created: IContributorOwnershipAccumulator = {
        contributorKey,
        name,
        email,
        commitCount: 0,
        linesChanged: 0,
        lastCommitDate: "",
        lastCommitDateMs: Number.NEGATIVE_INFINITY,
    }
    contributors.set(contributorKey, created)

    return created
}

/**
 * Converts one accumulator into external ownership contributor DTO.
 *
 * @param contributor Contributor accumulator.
 * @returns File ownership contributor DTO.
 */
function toFileOwnershipContributor(
    contributor: IContributorOwnershipAccumulator,
): IFileOwnershipContributor {
    return {
        name: contributor.name,
        commitCount: contributor.commitCount,
        lastCommitDate: contributor.lastCommitDate,
        linesChanged: contributor.linesChanged,
    }
}

/**
 * Resolves latest commit from history by timestamp.
 *
 * @param history Ordered commit history for one file.
 * @returns Latest commit or undefined.
 */
function resolveLatestHistoryCommit(
    history: readonly ICommitInfo[],
): ICommitInfo | undefined {
    let latestCommit: ICommitInfo | undefined
    let latestMs = Number.NEGATIVE_INFINITY

    for (const commit of history) {
        const commitDateMs = Date.parse(commit.date)
        if (Number.isFinite(commitDateMs) && commitDateMs > latestMs) {
            latestMs = commitDateMs
            latestCommit = commit
        }
    }

    return latestCommit
}

/**
 * Resolves latest contributor by timestamp.
 *
 * @param contributors Contributor accumulator map.
 * @returns Latest contributor or undefined.
 */
function resolveLatestContributor(
    contributors: ReadonlyMap<string, IContributorOwnershipAccumulator>,
): IContributorOwnershipAccumulator | undefined {
    let latest: IContributorOwnershipAccumulator | undefined
    let latestMs = Number.NEGATIVE_INFINITY

    for (const contributor of contributors.values()) {
        if (contributor.lastCommitDateMs > latestMs) {
            latestMs = contributor.lastCommitDateMs
            latest = contributor
        }
    }

    return latest
}

/**
 * Updates contributor last-commit timestamp when value is newer.
 *
 * @param contributor Contributor accumulator.
 * @param commitDate ISO timestamp.
 */
function updateLastCommitDate(
    contributor: IContributorOwnershipAccumulator,
    commitDate: string,
): void {
    const commitDateMs = Date.parse(commitDate)

    if (!Number.isFinite(commitDateMs)) {
        return
    }

    if (commitDateMs > contributor.lastCommitDateMs) {
        contributor.lastCommitDateMs = commitDateMs
        contributor.lastCommitDate = commitDate
    }
}

/**
 * Returns line count represented by one blame range.
 *
 * @param blameRange One blame range.
 * @returns Positive line count.
 */
function resolveLineCount(blameRange: IBlameData): number {
    const span = blameRange.lineEnd - blameRange.lineStart + 1
    return span > 0 ? span : 0
}

/**
 * Calculates bus factor as minimal number of contributors covering threshold ratio.
 *
 * @param contributors File contributor list.
 * @param threshold Coverage ratio in range (0, 1].
 * @param useCommitCounts True when commit history is available.
 * @returns File bus factor.
 */
function calculateBusFactor(
    contributors: readonly IFileOwnershipContributor[],
    threshold: number,
    useCommitCounts: boolean,
): number {
    if (contributors.length === 0) {
        return 0
    }

    const contributions = contributors
        .map((contributor): number => {
            return useCommitCounts ? contributor.commitCount : contributor.linesChanged
        })
        .filter((value): boolean => value > 0)
        .sort((left, right): number => right - left)

    if (contributions.length === 0) {
        return 0
    }

    const total = contributions.reduce((sum, value): number => sum + value, 0)
    const required = total * threshold
    let covered = 0

    for (let index = 0; index < contributions.length; index += 1) {
        covered += contributions[index] ?? 0
        if (covered >= required) {
            return index + 1
        }
    }

    return contributions.length
}

/**
 * Builds stable contributor key using email when possible.
 *
 * @param name Contributor display name.
 * @param email Contributor email.
 * @returns Stable contributor key.
 */
function buildContributorKey(name: string, email: string): string {
    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedEmail.length > 0) {
        return `email:${normalizedEmail}`
    }

    return `name:${name.trim().toLowerCase()}`
}

/**
 * Comparator for ownership contributor summaries.
 *
 * @param left Left contributor.
 * @param right Right contributor.
 * @returns Negative when left must be before right.
 */
function compareOwnershipContributors(
    left: IOwnershipContributor,
    right: IOwnershipContributor,
): number {
    if (left.commitCount !== right.commitCount) {
        return right.commitCount - left.commitCount
    }

    const nameOrder = left.name.localeCompare(right.name)
    if (nameOrder !== 0) {
        return nameOrder
    }

    return left.email.localeCompare(right.email)
}

/**
 * Comparator for file ownership contributors.
 *
 * @param left Left contributor.
 * @param right Right contributor.
 * @returns Negative when left must be before right.
 */
function compareFileOwnershipContributors(
    left: IFileOwnershipContributor,
    right: IFileOwnershipContributor,
): number {
    if (left.commitCount !== right.commitCount) {
        return right.commitCount - left.commitCount
    }

    if (left.linesChanged !== right.linesChanged) {
        return right.linesChanged - left.linesChanged
    }

    const leftMs = Date.parse(left.lastCommitDate)
    const rightMs = Date.parse(right.lastCommitDate)
    if (Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs !== rightMs) {
        return rightMs - leftMs
    }

    return left.name.localeCompare(right.name)
}

/**
 * Validates repository identifier.
 *
 * @param repositoryId Repository identifier.
 * @returns Normalized repository identifier.
 */
function validateRepositoryId(repositoryId: string): string {
    const normalized = repositoryId.trim()
    if (normalized.length === 0) {
        throw new GitOwnershipProviderError(
            GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_REPOSITORY_ID,
            {repositoryId},
        )
    }
    return normalized
}

/**
 * Validates repository-relative file path.
 *
 * @param filePath File path.
 * @returns Normalized file path.
 */
function validateFilePath(filePath: string): string {
    const normalized = filePath.trim()
    if (normalized.length === 0) {
        throw new GitOwnershipProviderError(
            GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
    return normalized
}

/**
 * Validates default git ref.
 *
 * @param defaultRef Ref candidate.
 * @returns Normalized git ref.
 */
function validateDefaultRef(defaultRef: string): string {
    const normalized = defaultRef.trim()
    if (normalized.length === 0) {
        throw new GitOwnershipProviderError(
            GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_DEFAULT_REF,
        )
    }
    return normalized
}

/**
 * Validates max history count.
 *
 * @param maxHistoryCount History count candidate.
 * @returns Validated history count.
 */
function validateMaxHistoryCount(maxHistoryCount: number): number {
    if (!Number.isInteger(maxHistoryCount) || maxHistoryCount <= 0) {
        throw new GitOwnershipProviderError(
            GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_MAX_HISTORY_COUNT,
        )
    }
    return maxHistoryCount
}

/**
 * Validates bus factor threshold.
 *
 * @param threshold Threshold candidate.
 * @returns Validated threshold.
 */
function validateBusFactorThreshold(threshold: number): number {
    if (threshold <= 0 || threshold > 1 || Number.isNaN(threshold)) {
        throw new GitOwnershipProviderError(
            GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_BUS_FACTOR_THRESHOLD,
        )
    }
    return threshold
}

/**
 * Wraps unknown ownership loading failure into typed provider error.
 *
 * @param error Original error.
 * @param repositoryId Repository identifier.
 * @param filePath Optional file path.
 * @returns Typed ownership provider error.
 */
function wrapOwnershipFailure(
    error: unknown,
    repositoryId: string,
    filePath?: string,
): GitOwnershipProviderError {
    if (error instanceof GitOwnershipProviderError) {
        return error
    }

    return new GitOwnershipProviderError(
        GIT_OWNERSHIP_PROVIDER_ERROR_CODE.GET_FILE_OWNERSHIP_FAILED,
        {
            repositoryId,
            filePath,
            operation: filePath !== undefined ? "getFileOwnership" : undefined,
            causeMessage: resolveCauseMessage(error),
        },
    )
}

/**
 * Wraps unknown contributors loading failure into typed provider error.
 *
 * @param error Original error.
 * @param repositoryId Repository identifier.
 * @returns Typed ownership provider error.
 */
function wrapContributorsFailure(
    error: unknown,
    repositoryId: string,
): GitOwnershipProviderError {
    if (error instanceof GitOwnershipProviderError) {
        return error
    }

    return new GitOwnershipProviderError(
        GIT_OWNERSHIP_PROVIDER_ERROR_CODE.GET_CONTRIBUTORS_FAILED,
        {
            repositoryId,
            operation: "getContributors",
            causeMessage: resolveCauseMessage(error),
        },
    )
}

/**
 * Resolves safe lower-level cause message from unknown error.
 *
 * @param error Unknown error payload.
 * @returns Cause message or undefined.
 */
function resolveCauseMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === "string") {
        return error
    }
    return undefined
}
