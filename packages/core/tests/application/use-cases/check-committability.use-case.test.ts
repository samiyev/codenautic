import {describe, expect, test} from "bun:test"

import {CheckCommittabilityUseCase} from "../../../src/application/use-cases/check-committability.use-case"

function createSuggestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: "s-1",
        filePath: "src/app.ts",
        lineStart: 10,
        lineEnd: 12,
        severity: "MEDIUM",
        category: "quality",
        message: "Use safer defaults",
        codeBlock: "function normalize(value: string): string {\n return value.trim()\n}",
        committable: true,
        rankScore: 50,
        ...overrides,
    }
}

function createFile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        path: "src/app.ts",
        patch: "+function existing(): void {}\n",
        ...overrides,
    }
}

describe("CheckCommittabilityUseCase", () => {
    test("returns validation error for invalid suggestion payload", async () => {
        const useCase = new CheckCommittabilityUseCase()

        const result = await useCase.execute({
            suggestion: {id: "broken"},
        })

        expect(result.isFail).toBe(true)
        expect(result.error.code).toBe("VALIDATION_ERROR")
    })

    test("marks upstream non-committable suggestions", async () => {
        const useCase = new CheckCommittabilityUseCase()

        const result = await useCase.execute({
            suggestion: createSuggestion({committable: false}),
            files: [createFile()],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.committable).toBe(false)
        expect(result.value.reason).toBe("upstream_non_committable")
    })

    test("returns false when syntax is invalid", async () => {
        const useCase = new CheckCommittabilityUseCase()

        const result = await useCase.execute({
            suggestion: createSuggestion({
                codeBlock: "function bad( {",
            }),
            files: [createFile()],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.committable).toBe(false)
        expect(result.value.reason).toBe("invalid_code_block_syntax")
    })

    test("returns false when code block is missing", async () => {
        const useCase = new CheckCommittabilityUseCase()

        const result = await useCase.execute({
            suggestion: createSuggestion({
                codeBlock: "",
            }),
            files: [createFile()],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.committable).toBe(false)
        expect(result.value.reason).toBe("missing_code_block")
    })

    test("returns false when suggestion already exists in file patch", async () => {
        const useCase = new CheckCommittabilityUseCase()

        const result = await useCase.execute({
            suggestion: createSuggestion({
                codeBlock: "function existing(): void {}",
                lineStart: 1,
                lineEnd: 1,
            }),
            files: [createFile()],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.committable).toBe(false)
        expect(result.value.reason).toBe("already_implemented")
    })

    test("returns false when sibling suggestion conflicts by line range", async () => {
        const useCase = new CheckCommittabilityUseCase()

        const result = await useCase.execute({
            suggestion: createSuggestion(),
            siblingSuggestions: [
                createSuggestion({
                    id: "s-2",
                    lineStart: 11,
                    lineEnd: 14,
                }),
            ],
            files: [createFile()],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.committable).toBe(false)
        expect(result.value.reason).toBe("conflict_with_other_suggestion:s-2")
    })

    test("returns true for valid committable suggestion without conflicts", async () => {
        const useCase = new CheckCommittabilityUseCase()

        const result = await useCase.execute({
            suggestion: createSuggestion({
                codeBlock: "const value = normalize(input)\nreturn value",
                lineStart: 20,
                lineEnd: 21,
            }),
            siblingSuggestions: [
                createSuggestion({
                    id: "s-2",
                    lineStart: 30,
                    lineEnd: 32,
                    codeBlock: "function another() {}",
                }),
            ],
            files: [createFile()],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.committable).toBe(true)
        expect(result.value.reason).toBeUndefined()
    })
})
