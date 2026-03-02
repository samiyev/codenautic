import {describe, expect, test} from "bun:test"

import {
    ApiEnvironmentValidationError,
    parseApiEnvironment,
} from "../../../src/api/config/api-env"

function createValidEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
    return {
        NODE_ENV: "development",
        ADMIN_API_KEY: "admin-key",
        MONGODB_URI: "mongodb://localhost:27017/codenautic",
        REDIS_URL: "redis://localhost:6379",
        ...overrides,
    }
}

describe("parseApiEnvironment", () => {
    test("parses required variables and applies optional defaults", () => {
        const result = parseApiEnvironment(createValidEnv())

        expect(result.nodeEnv).toBe("development")
        expect(result.adminApiKey).toBe("admin-key")
        expect(result.mongodbUri).toBe("mongodb://localhost:27017/codenautic")
        expect(result.redisUrl).toBe("redis://localhost:6379")
        expect(result.host).toBe("0.0.0.0")
        expect(result.port).toBe(3000)
        expect(result.healthcheckEnabled).toBe(true)
    })

    test("parses optional variables when explicitly provided", () => {
        const result = parseApiEnvironment(
            createValidEnv({
                NODE_ENV: "production",
                API_HOST: "127.0.0.1",
                API_PORT: "4010",
                API_HEALTHCHECK_ENABLED: "false",
            }),
        )

        expect(result.nodeEnv).toBe("production")
        expect(result.host).toBe("127.0.0.1")
        expect(result.port).toBe(4010)
        expect(result.healthcheckEnabled).toBe(false)
    })

    test("fails fast with diagnostics for missing required variable", () => {
        expect(() => {
            return parseApiEnvironment(
                createValidEnv({
                    ADMIN_API_KEY: undefined,
                }),
            )
        }).toThrow(ApiEnvironmentValidationError)

        try {
            parseApiEnvironment(
                createValidEnv({
                    ADMIN_API_KEY: undefined,
                }),
            )
        } catch (error: unknown) {
            if (!(error instanceof ApiEnvironmentValidationError)) {
                throw error
            }

            expect(error.message.includes("API environment validation failed")).toBe(true)
            expect(error.message.includes("ADMIN_API_KEY")).toBe(true)
        }
    })

    test("fails fast for invalid optional values", () => {
        expect(() => {
            return parseApiEnvironment(
                createValidEnv({
                    API_PORT: "0",
                    API_HEALTHCHECK_ENABLED: "maybe",
                }),
            )
        }).toThrow(ApiEnvironmentValidationError)
    })

    test("uses fallback diagnostics when zod issue path is empty", () => {
        expect(() => {
            return parseApiEnvironment("invalid-env" as unknown as Record<string, string | undefined>)
        }).toThrow(ApiEnvironmentValidationError)

        try {
            parseApiEnvironment("invalid-env" as unknown as Record<string, string | undefined>)
        } catch (error: unknown) {
            if (!(error instanceof ApiEnvironmentValidationError)) {
                throw error
            }

            expect(error.message.includes("API environment validation failed")).toBe(true)
            expect(error.message.includes("Invalid input")).toBe(true)
        }
    })
})
