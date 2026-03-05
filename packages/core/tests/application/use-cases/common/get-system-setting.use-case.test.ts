import {describe, expect, test} from "bun:test"

import type {ISystemSettingsProvider} from "../../../../src/application/ports/outbound/common/system-settings-provider.port"
import {GetSystemSettingUseCase} from "../../../../src/application/use-cases/common/get-system-setting.use-case"
import {ValidationError} from "../../../../src/domain/errors/validation.error"

class InMemorySystemSettingsProvider implements ISystemSettingsProvider {
    private readonly values: Map<string, unknown>

    public constructor(entries: Record<string, unknown>) {
        this.values = new Map<string, unknown>(Object.entries(entries))
    }

    public get<T>(key: string): Promise<T | undefined> {
        return Promise.resolve(this.values.get(key) as T | undefined)
    }

    public getMany<T>(keys: readonly string[]): Promise<ReadonlyMap<string, T>> {
        const result = new Map<string, T>()
        for (const key of keys) {
            const value = this.values.get(key)
            if (value !== undefined) {
                result.set(key, value as T)
            }
        }

        return Promise.resolve(result)
    }
}

class ThrowingSystemSettingsProvider implements ISystemSettingsProvider {
    public get<T>(key: string): Promise<T | undefined> {
        throw new Error(`boom:${key}`)
    }

    public getMany<T>(): Promise<ReadonlyMap<string, T>> {
        throw new Error("boom")
    }
}

describe("GetSystemSettingUseCase", () => {
    test("returns setting value when present", async () => {
        const provider = new InMemorySystemSettingsProvider({
            "review.defaults": {depth: "full"},
        })
        const useCase = new GetSystemSettingUseCase({
            systemSettingsProvider: provider,
        })

        const result = await useCase.execute({
            key: "review.defaults",
        })

        expect(result.isOk).toBe(true)
        expect(result.value).toEqual({
            key: "review.defaults",
            value: {depth: "full"},
        })
    })

    test("returns undefined value when missing", async () => {
        const provider = new InMemorySystemSettingsProvider({})
        const useCase = new GetSystemSettingUseCase({
            systemSettingsProvider: provider,
        })

        const result = await useCase.execute({
            key: "missing.key",
        })

        expect(result.isOk).toBe(true)
        expect(result.value).toEqual({
            key: "missing.key",
            value: undefined,
        })
    })

    test("returns validation error for empty key", async () => {
        const provider = new InMemorySystemSettingsProvider({})
        const useCase = new GetSystemSettingUseCase({
            systemSettingsProvider: provider,
        })

        const result = await useCase.execute({
            key: "   ",
        })

        expect(result.isFail).toBe(true)
        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.fields[0]?.field).toBe("key")
    })

    test("returns validation error when provider throws", async () => {
        const useCase = new GetSystemSettingUseCase({
            systemSettingsProvider: new ThrowingSystemSettingsProvider(),
        })

        const result = await useCase.execute({
            key: "review.defaults",
        })

        expect(result.isFail).toBe(true)
        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.fields[0]?.message).toContain("boom:review.defaults")
    })
})
