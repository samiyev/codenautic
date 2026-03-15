import {describe, expect, test} from "bun:test"

import type {IScanResult} from "@codenautic/core"

import {
    AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE,
    AstScanResultAggregatorError,
    AstScanResultAggregatorService,
    type AstScanResultAggregatorErrorCode,
} from "../../src/ast"

/**
 * Asserts typed AST scan result aggregator error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstScanResultAggregatorError(
    callback: () => Promise<unknown>,
    code: AstScanResultAggregatorErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstScanResultAggregatorError)

        if (error instanceof AstScanResultAggregatorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstScanResultAggregatorError to be thrown")
}

/**
 * Creates valid scan result fixture.
 *
 * @param overrides Optional override payload.
 * @returns Valid scan result fixture.
 */
function createScanResultFixture(
    overrides: Partial<IScanResult> = {},
): IScanResult {
    return {
        scanId: "scan-1",
        repositoryId: "repo-a",
        totalFiles: 1,
        totalNodes: 1,
        totalEdges: 1,
        languages: [
            {language: "TypeScript", fileCount: 1, loc: 10},
        ],
        duration: 100,
        completedAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    }
}

describe("AstScanResultAggregatorService", () => {
    test("aggregates scan results into deterministic summary", async () => {
        const aggregator = new AstScanResultAggregatorService()
        const summary = await aggregator.aggregate([
            createScanResultFixture({
                scanId: "scan-1",
                repositoryId: "repo-a",
                totalFiles: 2,
                totalNodes: 10,
                totalEdges: 7,
                languages: [
                    {language: "TypeScript", fileCount: 2, loc: 50},
                ],
                duration: 100,
                completedAt: "2026-01-01T00:00:00.000Z",
            }),
            createScanResultFixture({
                scanId: "scan-2",
                repositoryId: "repo-a",
                totalFiles: 1,
                totalNodes: 4,
                totalEdges: 2,
                languages: [
                    {language: "Python", fileCount: 1, loc: 30},
                ],
                duration: 200,
                completedAt: "2026-01-02T00:00:00.000Z",
            }),
            createScanResultFixture({
                scanId: "scan-3",
                repositoryId: "repo-b",
                totalFiles: 3,
                totalNodes: 9,
                totalEdges: 8,
                languages: [
                    {language: "TypeScript", fileCount: 1, loc: 20},
                    {language: "Go", fileCount: 2, loc: 40},
                ],
                duration: 150,
                completedAt: "2026-01-01T12:00:00.000Z",
            }),
        ])

        expect(summary.totalFiles).toBe(6)
        expect(summary.totalNodes).toBe(23)
        expect(summary.totalEdges).toBe(17)
        expect(summary.languages).toEqual([
            {language: "Go", fileCount: 2, loc: 40},
            {language: "Python", fileCount: 1, loc: 30},
            {language: "TypeScript", fileCount: 3, loc: 70},
        ])
        expect(summary.metrics).toEqual({
            scanCount: 3,
            repositoryCount: 2,
            totalDuration: 450,
            averageDuration: 150,
            minDuration: 100,
            maxDuration: 200,
            firstCompletedAt: "2026-01-01T00:00:00.000Z",
            lastCompletedAt: "2026-01-02T00:00:00.000Z",
        })
        expect(summary.repositories).toEqual([
            {
                repositoryId: "repo-a",
                scanCount: 2,
                totalFiles: 3,
                totalNodes: 14,
                totalEdges: 9,
                totalDuration: 300,
                averageDuration: 150,
                lastCompletedAt: "2026-01-02T00:00:00.000Z",
                lastScanId: "scan-2",
            },
            {
                repositoryId: "repo-b",
                scanCount: 1,
                totalFiles: 3,
                totalNodes: 9,
                totalEdges: 8,
                totalDuration: 150,
                averageDuration: 150,
                lastCompletedAt: "2026-01-01T12:00:00.000Z",
                lastScanId: "scan-3",
            },
        ])
    })

    test("returns stable idempotent output for repeated calls", async () => {
        const aggregator = new AstScanResultAggregatorService()
        const input: readonly IScanResult[] = [
            createScanResultFixture({
                scanId: "scan-b",
                repositoryId: "repo-b",
                totalFiles: 2,
                totalNodes: 5,
                totalEdges: 4,
                duration: 130,
                completedAt: "2026-02-01T10:00:00.000Z",
            }),
            createScanResultFixture({
                scanId: "scan-a",
                repositoryId: "repo-a",
                totalFiles: 1,
                totalNodes: 3,
                totalEdges: 2,
                duration: 90,
                completedAt: "2026-02-01T09:00:00.000Z",
            }),
        ]

        const first = await aggregator.aggregate(input)
        const second = await aggregator.aggregate(input)

        expect(first).toEqual(second)
    })

    test("throws typed errors for empty and invalid scan results", async () => {
        const aggregator = new AstScanResultAggregatorService()

        await expectAstScanResultAggregatorError(
            () => aggregator.aggregate([]),
            AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.EMPTY_SCAN_RESULTS,
        )
        await expectAstScanResultAggregatorError(
            () =>
                aggregator.aggregate([
                    createScanResultFixture({
                        duration: -1,
                    }),
                ]),
            AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_DURATION,
        )
        await expectAstScanResultAggregatorError(
            () =>
                aggregator.aggregate([
                    createScanResultFixture({
                        repositoryId: " ",
                    }),
                ]),
            AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_REPOSITORY_ID,
        )
        await expectAstScanResultAggregatorError(
            () =>
                aggregator.aggregate([
                    createScanResultFixture({
                        languages: [{language: " ", fileCount: 1, loc: 2}],
                    }),
                ]),
            AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_LANGUAGE,
        )
        await expectAstScanResultAggregatorError(
            () =>
                aggregator.aggregate([
                    createScanResultFixture({
                        completedAt: "invalid-timestamp",
                    }),
                ]),
            AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_COMPLETED_AT,
        )
    })
})
