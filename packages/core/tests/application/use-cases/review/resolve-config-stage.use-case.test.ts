import {describe, expect, test} from "bun:test"

import type {IReviewConfigDTO} from "../../../../src/application/dto/review/review-config.dto"
import type {IRepositoryConfigLoader} from "../../../../src/application/ports/outbound/review/repository-config-loader.port"
import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"
import {ResolveConfigStageUseCase} from "../../../../src/application/use-cases/review/resolve-config-stage.use-case"
import type {ISystemSettingsProvider} from "../../../../src/application/ports/outbound/common/system-settings-provider.port"

const baseDefaultLayer: Partial<IReviewConfigDTO> = {
    severityThreshold: "MEDIUM",
    ignorePaths: [],
    maxSuggestionsPerFile: 5,
    maxSuggestionsPerCCR: 30,
}

class InMemorySystemSettingsProvider implements ISystemSettingsProvider {
    private readonly values: Readonly<Record<string, unknown>>

    public constructor(values: Readonly<Record<string, unknown>>) {
        this.values = values
    }

    public get<T>(key: string): Promise<T | undefined> {
        return Promise.resolve(this.values[key] as T | undefined)
    }

    public getMany<T>(keys: readonly string[]): Promise<ReadonlyMap<string, T>> {
        const result = new Map<string, T>()
        for (const key of keys) {
            const value = this.values[key]
            if (value !== undefined) {
                result.set(key, value as T)
            }
        }

        return Promise.resolve(result)
    }
}

class InMemoryRepositoryConfigLoader implements IRepositoryConfigLoader {
    public defaultLayer: Partial<IReviewConfigDTO> | null = null
    public organizationLayer: Partial<IReviewConfigDTO> | null = null
    public repositoryLayer: Partial<IReviewConfigDTO> | null = null
    public shouldThrow = false

    public loadConfig(repositoryId: string): Promise<Partial<IReviewConfigDTO> | null> {
        if (this.shouldThrow) {
            return Promise.reject(new Error("loader unavailable"))
        }

        expect(repositoryId).toBeDefined()
        return Promise.resolve(this.repositoryLayer)
    }

    public loadDefault(): Promise<Partial<IReviewConfigDTO> | null> {
        if (this.shouldThrow) {
            return Promise.reject(new Error("loader unavailable"))
        }

        return Promise.resolve(this.defaultLayer)
    }

    public loadOrganization(
        _organizationId: string,
        _teamId: string,
    ): Promise<Partial<IReviewConfigDTO> | null> {
        if (this.shouldThrow) {
            return Promise.reject(new Error("loader unavailable"))
        }

        return Promise.resolve(this.organizationLayer)
    }

    public loadRepository(_repositoryId: string): Promise<Partial<IReviewConfigDTO> | null> {
        if (this.shouldThrow) {
            return Promise.reject(new Error("loader unavailable"))
        }

        return Promise.resolve(this.repositoryLayer)
    }
}

/**
 * Creates baseline state for resolve-config tests.
 *
 * @param mergeRequest Merge request payload.
 * @returns Pipeline state.
 */
function createState(mergeRequest: Readonly<Record<string, unknown>>): ReviewPipelineState {
    return ReviewPipelineState.create({
        runId: "run-resolve-config",
        definitionVersion: "v1",
        mergeRequest,
        config: {},
    })
}

describe("ResolveConfigStageUseCase", () => {
    test("merges layered config as default -> organization -> repository", async () => {
        const loader = new InMemoryRepositoryConfigLoader()
        loader.defaultLayer = {
            ...baseDefaultLayer,
            severityThreshold: "LOW",
            ignorePaths: ["dist/**"],
            maxSuggestionsPerFile: 10,
        }
        loader.organizationLayer = {
            severityThreshold: "MEDIUM",
            maxSuggestionsPerCCR: 40,
            customRuleIds: ["org-rule"],
            promptOverrides: {
                categories: {
                    descriptions: {
                        bug: "org-bug",
                        performance: "org-performance",
                    },
                },
            },
        }
        loader.repositoryLayer = {
            severityThreshold: "HIGH",
            cadence: "strict",
            promptOverrides: {
                severity: {
                    flags: {
                        high: "repo-high",
                    },
                },
            },
        }

        const useCase = new ResolveConfigStageUseCase(loader)
        const state = createState({
            repositoryId: "repo-1",
            organizationId: "org-1",
            teamId: "team-1",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("config:resolved")
        const config = result.value.state.config
        expect(config["severityThreshold"]).toBe("HIGH")
        expect(config["maxSuggestionsPerFile"]).toBe(10)
        expect(config["maxSuggestionsPerCCR"]).toBe(40)
        expect(config["cadence"]).toBe("strict")
        expect(config["customRuleIds"]).toEqual(["org-rule"])
        expect(config["promptOverrides"]).toEqual({
            categories: {
                descriptions: {
                    bug: "org-bug",
                    performance: "org-performance",
                },
            },
            severity: {
                flags: {
                    high: "repo-high",
                },
            },
        })
    })

    test("falls back to settings defaults when loader default is missing", async () => {
        const loader = new InMemoryRepositoryConfigLoader()
        const settingsProvider = new InMemorySystemSettingsProvider({
            "review.defaults": {
                severityThreshold: "LOW",
                ignorePaths: ["generated/**"],
                maxSuggestionsPerFile: 8,
                maxSuggestionsPerCCR: 50,
                cadence: "automatic",
                customRuleIds: [],
            },
        })
        const useCase = new ResolveConfigStageUseCase(loader, undefined, settingsProvider)
        const state = createState({
            repositoryId: "repo-1",
            organizationId: "org-1",
            teamId: "team-1",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.state.config["severityThreshold"]).toBe("LOW")
        expect(result.value.state.config["maxSuggestionsPerCCR"]).toBe(50)
        expect(result.value.state.config["ignorePaths"]).toEqual(["generated/**"])
    })

    test("falls back to hardcoded defaults when settings are missing", async () => {
        const loader = new InMemoryRepositoryConfigLoader()
        const useCase = new ResolveConfigStageUseCase(loader)
        const state = createState({
            repositoryId: "repo-1",
            organizationId: "org-1",
            teamId: "team-1",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.state.config["severityThreshold"]).toBe("LOW")
        expect(result.value.state.config["maxSuggestionsPerCCR"]).toBe(50)
    })

    test("prefers new loadConfig method when implemented", async () => {
        const loader = new InMemoryRepositoryConfigLoader()
        loader.defaultLayer = baseDefaultLayer
        const useCase = new ResolveConfigStageUseCase(loader)
        const state = createState({
            repositoryId: "repo-1",
            organizationId: "org-1",
            teamId: "team-1",
        })
        loader.repositoryLayer = {
            severityThreshold: "LOW",
            ignorePaths: ["repo/**"],
        }

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.state.config["severityThreshold"]).toBe("LOW")
        expect(result.value.state.config["ignorePaths"]).toEqual(["repo/**"])
    })

    test("fails with not found error when organization id is missing", async () => {
        const loader = new InMemoryRepositoryConfigLoader()
        loader.defaultLayer = baseDefaultLayer
        const useCase = new ResolveConfigStageUseCase(loader)
        const state = createState({
            repositoryId: "repo-1",
            teamId: "team-1",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.originalError?.name).toBe("NotFoundError")
    })

    test("returns recoverable stage error when loader throws", async () => {
        const loader = new InMemoryRepositoryConfigLoader()
        loader.shouldThrow = true
        loader.defaultLayer = baseDefaultLayer

        const useCase = new ResolveConfigStageUseCase(loader)
        const state = createState({
            repositoryId: "repo-1",
            organizationId: "org-1",
            teamId: "team-1",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.recoverable).toBe(true)
        expect(result.error.message).toContain("resolve repository configuration")
    })
})
