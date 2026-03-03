import {describe, expect, test} from "bun:test"

import {SCAN_PHASE, SCAN_STATUS, type IScanProgress, type ScanPhase} from
    "../../../../../src/application/dto/scanning"
import type {IScanProgressRepository} from "../../../../../src/application/ports/outbound/scanning/scan-progress-repository"

class InMemoryScanProgressRepository implements IScanProgressRepository {
    private readonly records: IScanProgress[]

    public constructor() {
        this.records = []
    }

    public save(scanProgress: IScanProgress): Promise<void> {
        const existingIndex = this.records.findIndex(
            (record) => record.scanId === scanProgress.scanId,
        )

        if (existingIndex === -1) {
            this.records.push(scanProgress)
            return Promise.resolve()
        }

        this.records[existingIndex] = scanProgress
        return Promise.resolve()
    }

    public findByScanId(scanId: string): Promise<IScanProgress | null> {
        return Promise.resolve(
            this.records.find((record) => record.scanId === scanId) ?? null,
        )
    }

    public findByRepoId(repositoryId: string): Promise<readonly IScanProgress[]> {
        return Promise.resolve(
            this.records.filter((record) => record.repositoryId === repositoryId),
        )
    }

    public updateProgress(
        scanId: string,
        processedFiles: number,
        phase: ScanPhase,
    ): Promise<void> {
        const existingIndex = this.records.findIndex((record) => record.scanId === scanId)

        if (existingIndex === -1) {
            return Promise.resolve()
        }

        const current = this.records[existingIndex]
        if (current === undefined) {
            return Promise.resolve()
        }
        this.records[existingIndex] = {
            ...current,
            processedFiles,
            currentPhase: phase,
            updatedAt: "2026-03-03T12:22:00.000Z",
        }
        return Promise.resolve()
    }

    public markCompleted(scanId: string): Promise<void> {
        const existingIndex = this.records.findIndex((record) => record.scanId === scanId)

        if (existingIndex === -1) {
            return Promise.resolve()
        }

        const current = this.records[existingIndex]
        if (current === undefined) {
            return Promise.resolve()
        }
        this.records[existingIndex] = {
            ...current,
            status: SCAN_STATUS.COMPLETED,
            currentPhase: SCAN_PHASE.FINALIZATION,
            updatedAt: "2026-03-03T12:30:00.000Z",
        }
        return Promise.resolve()
    }

    public markFailed(scanId: string, errorMessage: string): Promise<void> {
        const existingIndex = this.records.findIndex((record) => record.scanId === scanId)

        if (existingIndex === -1) {
            return Promise.resolve()
        }

        const current = this.records[existingIndex]
        if (current === undefined) {
            return Promise.resolve()
        }
        this.records[existingIndex] = {
            ...current,
            status: SCAN_STATUS.FAILED,
            errorMessage,
            updatedAt: "2026-03-03T12:35:00.000Z",
        }
        return Promise.resolve()
    }
}

describe("IScanProgressRepository contract", () => {
    test("save и findByScanId возвращают сохранённый прогресс", async () => {
        const repository = new InMemoryScanProgressRepository()
        const progress: IScanProgress = {
            scanId: "scan-1",
            repositoryId: "repo-1",
            status: SCAN_STATUS.PENDING,
            totalFiles: 10,
            processedFiles: 1,
            currentPhase: SCAN_PHASE.FILE_DISCOVERY,
            startedAt: "2026-03-03T12:10:00.000Z",
            updatedAt: "2026-03-03T12:10:00.000Z",
        }

        await repository.save(progress)
        const saved = await repository.findByScanId("scan-1")

        expect(saved).toEqual(progress)
    })

    test("findByRepoId фильтрует только нужный репозиторий", async () => {
        const repository = new InMemoryScanProgressRepository()
        await repository.save({
            scanId: "scan-1",
            repositoryId: "repo-1",
            status: SCAN_STATUS.PENDING,
            totalFiles: 10,
            processedFiles: 1,
            currentPhase: SCAN_PHASE.FILE_DISCOVERY,
            startedAt: "2026-03-03T12:10:00.000Z",
            updatedAt: "2026-03-03T12:10:00.000Z",
        })
        await repository.save({
            scanId: "scan-2",
            repositoryId: "repo-2",
            status: SCAN_STATUS.SCANNING_FILES,
            totalFiles: 8,
            processedFiles: 2,
            currentPhase: SCAN_PHASE.FILE_PARSING,
            startedAt: "2026-03-03T12:11:00.000Z",
            updatedAt: "2026-03-03T12:11:00.000Z",
        })

        const repositoryRecords = await repository.findByRepoId("repo-1")

        expect(repositoryRecords).toHaveLength(1)
        expect(repositoryRecords[0]?.scanId).toBe("scan-1")
    })

    test("updateProgress, markCompleted и markFailed обновляют состояние", async () => {
        const repository = new InMemoryScanProgressRepository()
        await repository.save({
            scanId: "scan-1",
            repositoryId: "repo-1",
            status: SCAN_STATUS.PENDING,
            totalFiles: 10,
            processedFiles: 1,
            currentPhase: SCAN_PHASE.FILE_DISCOVERY,
            startedAt: "2026-03-03T12:10:00.000Z",
            updatedAt: "2026-03-03T12:10:00.000Z",
        })

        await repository.updateProgress("scan-1", 5, SCAN_PHASE.GRAPH_BUILDING)
        const progressed = await repository.findByScanId("scan-1")
        expect(progressed?.processedFiles).toBe(5)
        expect(progressed?.currentPhase).toBe(SCAN_PHASE.GRAPH_BUILDING)

        await repository.markCompleted("scan-1")
        const completed = await repository.findByScanId("scan-1")
        expect(completed?.status).toBe(SCAN_STATUS.COMPLETED)
        expect(completed?.currentPhase).toBe(SCAN_PHASE.FINALIZATION)

        await repository.markFailed("scan-1", "fatal error")
        const failed = await repository.findByScanId("scan-1")
        expect(failed?.status).toBe(SCAN_STATUS.FAILED)
        expect(failed?.errorMessage).toBe("fatal error")
    })

    test("операции над неизвестным scanId — no-op без ошибок", async () => {
        const repository = new InMemoryScanProgressRepository()

        await repository.updateProgress("missing", 2, SCAN_PHASE.FILE_PARSING)
        await repository.markCompleted("missing")
        await repository.markFailed("missing", "error")
        const missing = await repository.findByScanId("missing")
        expect(missing).toBeNull()
    })
})
