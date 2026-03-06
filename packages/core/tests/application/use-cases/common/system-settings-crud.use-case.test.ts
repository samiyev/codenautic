import {describe, expect, test} from "bun:test"

import type {ISystemSettingsRepository} from "../../../../src/application/ports/outbound/common/system-settings-repository.port"
import {GetSystemSettingUseCase} from "../../../../src/application/use-cases/common/get-system-setting.use-case"
import {UpsertSystemSettingUseCase} from "../../../../src/application/use-cases/common/upsert-system-setting.use-case"
import {ListSystemSettingsUseCase} from "../../../../src/application/use-cases/common/list-system-settings.use-case"
import {DeleteSystemSettingUseCase} from "../../../../src/application/use-cases/common/delete-system-setting.use-case"
import {ValidationError} from "../../../../src/domain/errors/validation.error"

class InMemorySystemSettingsRepository implements ISystemSettingsRepository {
    private readonly values = new Map<string, unknown>()

    public constructor(entries: Record<string, unknown> = {}) {
        for (const [key, value] of Object.entries(entries)) {
            this.values.set(key, value)
        }
    }

    public findByKey(key: string): Promise<{key: string; value: unknown} | null> {
        if (!this.values.has(key)) {
            return Promise.resolve(null)
        }

        return Promise.resolve({
            key,
            value: this.values.get(key),
        })
    }

    public findAll(): Promise<readonly {key: string; value: unknown}[]> {
        return Promise.resolve(
            Array.from(this.values.entries()).map(([key, value]) => {
                return {
                    key,
                    value,
                }
            }),
        )
    }

    public upsert(setting: {key: string; value: unknown}): Promise<void> {
        this.values.set(setting.key, setting.value)
        return Promise.resolve()
    }

    public deleteByKey(key: string): Promise<void> {
        this.values.delete(key)
        return Promise.resolve()
    }
}

describe("UpsertSystemSettingUseCase", () => {
    test("creates new setting", async () => {
        const repository = new InMemorySystemSettingsRepository()
        const useCase = new UpsertSystemSettingUseCase({
            systemSettingsRepository: repository,
        })

        const result = await useCase.execute({
            key: "review.defaults",
            value: {depth: "full"},
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected upsert system setting success")
        }

        expect(result.value.setting.key).toBe("review.defaults")
        const stored = await repository.findByKey("review.defaults")
        expect(stored?.value).toEqual({depth: "full"})
    })

    test("updates existing setting", async () => {
        const repository = new InMemorySystemSettingsRepository({
            "review.defaults": {depth: "shallow"},
        })
        const useCase = new UpsertSystemSettingUseCase({
            systemSettingsRepository: repository,
        })

        const result = await useCase.execute({
            key: "review.defaults",
            value: {depth: "full"},
        })

        expect(result.isOk).toBe(true)
        const stored = await repository.findByKey("review.defaults")
        expect(stored?.value).toEqual({depth: "full"})
    })

    test("rejects empty key", async () => {
        const useCase = new UpsertSystemSettingUseCase({
            systemSettingsRepository: new InMemorySystemSettingsRepository(),
        })

        const result = await useCase.execute({
            key: "   ",
            value: "x",
        })

        expect(result.isFail).toBe(true)
        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.fields[0]?.field).toBe("key")
    })

    test("rejects missing value", async () => {
        const useCase = new UpsertSystemSettingUseCase({
            systemSettingsRepository: new InMemorySystemSettingsRepository(),
        })

        const result = await useCase.execute({
            key: "review.defaults",
            value: undefined,
        })

        expect(result.isFail).toBe(true)
        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.fields[0]?.field).toBe("value")
    })
})

describe("GetSystemSettingUseCase", () => {
    test("returns setting when present", async () => {
        const repository = new InMemorySystemSettingsRepository({
            "review.defaults": {depth: "full"},
        })
        const useCase = new GetSystemSettingUseCase({
            systemSettingsRepository: repository,
        })

        const result = await useCase.execute({
            key: "review.defaults",
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected get system setting success")
        }

        expect(result.value.setting).toEqual({
            key: "review.defaults",
            value: {depth: "full"},
        })
    })

    test("rejects missing setting", async () => {
        const repository = new InMemorySystemSettingsRepository()
        const useCase = new GetSystemSettingUseCase({
            systemSettingsRepository: repository,
        })

        const result = await useCase.execute({
            key: "missing.key",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "key",
                message: "setting not found",
            },
        ])
    })

    test("rejects empty key", async () => {
        const repository = new InMemorySystemSettingsRepository()
        const useCase = new GetSystemSettingUseCase({
            systemSettingsRepository: repository,
        })

        const result = await useCase.execute({
            key: "   ",
        })

        expect(result.isFail).toBe(true)
        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.fields[0]?.field).toBe("key")
    })
})

describe("ListSystemSettingsUseCase", () => {
    test("lists settings", async () => {
        const repository = new InMemorySystemSettingsRepository({
            "review.defaults": {depth: "full"},
            "review.blocking_severities": ["HIGH"],
        })
        const useCase = new ListSystemSettingsUseCase({
            systemSettingsRepository: repository,
        })

        const result = await useCase.execute({})

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected list system settings success")
        }

        expect(result.value.total).toBe(2)
        expect(result.value.settings).toHaveLength(2)
    })
})

describe("DeleteSystemSettingUseCase", () => {
    test("deletes existing setting", async () => {
        const repository = new InMemorySystemSettingsRepository({
            "review.defaults": {depth: "full"},
        })
        const useCase = new DeleteSystemSettingUseCase({
            systemSettingsRepository: repository,
        })

        const result = await useCase.execute({
            key: "review.defaults",
        })

        expect(result.isOk).toBe(true)
        const stored = await repository.findByKey("review.defaults")
        expect(stored).toBeNull()
    })

    test("rejects missing setting", async () => {
        const repository = new InMemorySystemSettingsRepository()
        const useCase = new DeleteSystemSettingUseCase({
            systemSettingsRepository: repository,
        })

        const result = await useCase.execute({
            key: "missing.key",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "key",
                message: "setting not found",
            },
        ])
    })

    test("rejects empty key", async () => {
        const repository = new InMemorySystemSettingsRepository()
        const useCase = new DeleteSystemSettingUseCase({
            systemSettingsRepository: repository,
        })

        const result = await useCase.execute({
            key: "",
        })

        expect(result.isFail).toBe(true)
        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.fields[0]?.field).toBe("key")
    })
})
