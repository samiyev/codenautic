import {describe, expect, test} from "bun:test"

import {NotFoundError} from "../../../../src/domain/errors/not-found.error"
import {ValidationError} from "../../../../src/domain/errors/validation.error"
import {
    REPOSITORY_INDEX_STATUS,
    type IRepositoryIndex,
} from "../../../../src/application/dto/scanning"
import {GetRepositoryIndexUseCase} from "../../../../src/application/use-cases/scanning/get-repository-index.use-case"
import type {IRepositoryIndexRepository} from "../../../../src/application/ports/outbound/scanning/repository-index-repository"

class InMemoryRepositoryIndexRepository implements IRepositoryIndexRepository {
    private readonly records: IRepositoryIndex[]

    public constructor() {
        this.records = []
    }

    public getByRepositoryId(repositoryId: string): Promise<IRepositoryIndex | null> {
        return Promise.resolve(
            this.records.find((record) => record.repositoryId === repositoryId) ?? null,
        )
    }

    public save(repositoryIndex: IRepositoryIndex): Promise<void> {
        const existingIndex = this.records.findIndex(
            (record) => record.repositoryId === repositoryIndex.repositoryId,
        )

        if (existingIndex === -1) {
            this.records.push(repositoryIndex)
            return Promise.resolve()
        }

        this.records[existingIndex] = repositoryIndex
        return Promise.resolve()
    }

    public updateStatus(
        _repositoryId: string,
        _status: typeof REPOSITORY_INDEX_STATUS[keyof typeof REPOSITORY_INDEX_STATUS],
    ): Promise<void> {
        return Promise.resolve()
    }

    public updateLastScan(
        _repositoryId: string,
        _scanId: string,
        _scannedAt: string,
    ): Promise<void> {
        return Promise.resolve()
    }
}

describe("GetRepositoryIndexUseCase", () => {
    test("возвращает индекс репозитория по repoId", async () => {
        const repository = new InMemoryRepositoryIndexRepository()
        const expected: IRepositoryIndex = {
            repositoryId: "gh:repo-1",
            defaultBranch: "main",
            totalFiles: 8,
            totalLoc: 1024,
            languages: [],
            status: REPOSITORY_INDEX_STATUS.INDEXED,
        }
        await repository.save(expected)

        const useCase = new GetRepositoryIndexUseCase({
            repositoryIndexRepository: repository,
        })
        const result = await useCase.execute({
            repoId: "gh:repo-1",
        })

        expect(result.isOk).toBe(true)
        expect(result.value.repositoryId).toBe(expected.repositoryId)
        expect(result.value.status).toBe(REPOSITORY_INDEX_STATUS.INDEXED)
    })

    test("валидация проваливается для некорректного repoId", async () => {
        const useCase = new GetRepositoryIndexUseCase({
            repositoryIndexRepository: new InMemoryRepositoryIndexRepository(),
        })
        const result = await useCase.execute({
            repoId: "repo-1",
        })

        expect(result.isFail).toBe(true)
        expect(result.error).toBeInstanceOf(ValidationError)
        const validationError = result.error as ValidationError
        expect(validationError.fields).toEqual([{
            field: "repoId",
            message: "RepositoryId must match format <platform>:<id>",
        }])
    })

    test("возвращает NotFoundError, если индекс отсутствует или не проиндексирован", async () => {
        const repository = new InMemoryRepositoryIndexRepository()
        await repository.save({
            repositoryId: "gh:repo-2",
            defaultBranch: "main",
            totalFiles: 0,
            totalLoc: 0,
            languages: [],
            status: REPOSITORY_INDEX_STATUS.NOT_INDEXED,
        })

        const useCase = new GetRepositoryIndexUseCase({
            repositoryIndexRepository: repository,
        })
        const notFound = await useCase.execute({
            repoId: "gh:repo-3",
        })

        expect(notFound.isFail).toBe(true)
        expect(notFound.error).toBeInstanceOf(NotFoundError)
        expect((notFound.error as NotFoundError).code).toBe("NOT_FOUND")
        expect((notFound.error as NotFoundError).entityType).toBe("RepositoryIndex")

        const notIndexed = await useCase.execute({
            repoId: "gh:repo-2",
        })

        expect(notIndexed.isFail).toBe(true)
        expect(notIndexed.error).toBeInstanceOf(NotFoundError)
        expect((notIndexed.error as NotFoundError).entityId).toBe("gh:repo-2")
    })
})
