import {describe, expect, test} from "bun:test"

import {
    type IApiServer,
    type IApiServerFactory,
    startApi,
} from "../../../src/api/bootstrap"

function createValidEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
    return {
        NODE_ENV: "test",
        ADMIN_API_KEY: "admin-key",
        MONGODB_URI: "mongodb://localhost:27017/codenautic",
        REDIS_URL: "redis://localhost:6379",
        ...overrides,
    }
}

describe("startApi", () => {
    test("starts API with validated configuration", async () => {
        const state: {
            receivedFactoryOptions?: {
                port: number
                hostname: string
            }
        } = {}

        const factory: IApiServerFactory = (options) => {
            state.receivedFactoryOptions = {
                port: options.port,
                hostname: options.hostname,
            }
            return {
                stop(): void {},
            }
        }

        const runtime = await startApi({
            env: createValidEnv({
                API_HOST: "127.0.0.1",
                API_PORT: "4123",
            }),
            factory,
        })

        const receivedFactoryOptions = state.receivedFactoryOptions
        if (receivedFactoryOptions === undefined) {
            throw new Error("Expected server factory options")
        }

        expect(receivedFactoryOptions.hostname).toBe("127.0.0.1")
        expect(receivedFactoryOptions.port).toBe(4123)
        expect(runtime.environment.port).toBe(4123)

        runtime.stop()
    })

    test("returns health endpoint when healthcheck is enabled", async () => {
        const state: {
            invokeHealthRequest?: () => Promise<unknown>
        } = {}

        const factory: IApiServerFactory = (options) => {
            state.invokeHealthRequest = async (): Promise<unknown> => {
                return Promise.resolve(
                    options.fetch(new Request("http://localhost/health")) as unknown,
                )
            }
            return {
                stop(): void {},
            }
        }

        await startApi({
            env: createValidEnv({
                API_HEALTHCHECK_ENABLED: "true",
            }),
            factory,
        })

        const invokeHealthRequest = state.invokeHealthRequest
        if (invokeHealthRequest === undefined) {
            throw new Error("Expected fetch handler")
        }

        const responseUnknown: unknown = await invokeHealthRequest()
        const response = ensureHttpLikeResponse(responseUnknown)
        expect(response.status).toBe(200)
        const payloadText = await response.text()
        expect(payloadText.includes("\"status\":\"ok\"")).toBe(true)
    })

    test("returns 404 for health endpoint when disabled", async () => {
        const state: {
            invokeHealthRequest?: () => Promise<unknown>
        } = {}

        const factory: IApiServerFactory = (options) => {
            state.invokeHealthRequest = async (): Promise<unknown> => {
                return Promise.resolve(
                    options.fetch(new Request("http://localhost/health")) as unknown,
                )
            }
            return {
                stop(): void {},
            }
        }

        await startApi({
            env: createValidEnv({
                API_HEALTHCHECK_ENABLED: "false",
            }),
            factory,
        })

        const invokeHealthRequest = state.invokeHealthRequest
        if (invokeHealthRequest === undefined) {
            throw new Error("Expected fetch handler")
        }

        const healthResponseUnknown: unknown = await invokeHealthRequest()
        const healthResponse = ensureHttpLikeResponse(healthResponseUnknown)
        expect(healthResponse.status).toBe(404)
    })

    test("throws when factory returns invalid server object", async () => {
        const invalidFactory = (() => {
            return {} as IApiServer
        }) satisfies IApiServerFactory

        await expectStartApiToThrow(
            {
                env: createValidEnv(),
                factory: invalidFactory,
            },
            "API server factory must return object with stop()",
        )
    })

    test("throws when factory returns null", async () => {
        const invalidFactory = (() => {
            return null as unknown as IApiServer
        }) satisfies IApiServerFactory

        await expectStartApiToThrow(
            {
                env: createValidEnv(),
                factory: invalidFactory,
            },
            "API server factory must return object with stop()",
        )
    })

    test("uses Bun.serve default factory when custom factory is not provided", async () => {
        const originalServe = Bun.serve
        let stopCalled = false
        const state: {
            receivedOptions?: {
                port: number
                hostname: string
                fetch(request: unknown): unknown
            }
        } = {}

        const patchedBun = Bun as unknown as {
            serve: (options: {
                port: number
                hostname: string
                fetch(request: unknown): unknown
            }) => IApiServer
        }
        patchedBun.serve = (options) => {
            state.receivedOptions = options
            return {
                stop(): void {
                    stopCalled = true
                },
            }
        }

        try {
            const runtime = await startApi({
                env: createValidEnv({
                    API_PORT: "4321",
                    API_HOST: "127.0.0.1",
                }),
            })

            const receivedOptions = state.receivedOptions
            if (receivedOptions === undefined) {
                throw new Error("Expected Bun.serve options")
            }

            expect(receivedOptions.port).toBe(4321)
            expect(receivedOptions.hostname).toBe("127.0.0.1")

            const healthResponseUnknown = await Promise.resolve(
                receivedOptions.fetch(new Request("http://localhost/health")),
            )
            const healthResponse = ensureHttpLikeResponse(healthResponseUnknown)
            expect(healthResponse.status).toBe(200)

            runtime.stop()
            expect(stopCalled).toBe(true)
        } finally {
            patchedBun.serve = originalServe as unknown as (
                options: {
                    port: number
                    hostname: string
                    fetch(request: unknown): unknown
                },
            ) => IApiServer
        }
    })

    test("fails fast when environment is invalid", async () => {
        await expectStartApiToThrow(
            {
                env: createValidEnv({
                    ADMIN_API_KEY: undefined,
                }),
            },
            "API environment validation failed",
        )
    })
})

/**
 * Asserts that API startup fails with message containing expected fragment.
 *
 * @param options Startup options for startApi.
 * @param expectedMessageFragment Expected error message fragment.
 * @returns Promise resolved when assertion completes.
 */
async function expectStartApiToThrow(
    options: Parameters<typeof startApi>[0],
    expectedMessageFragment: string,
): Promise<void> {
    try {
        await startApi(options)
        throw new Error("Expected startApi to throw")
    } catch (error: unknown) {
        if (!(error instanceof Error)) {
            throw error
        }

        expect(error.message.includes(expectedMessageFragment)).toBe(true)
    }
}

/**
 * Normalizes unknown fetch output to Response.
 *
 * @param value Unknown fetch output.
 * @returns Response object.
 * @throws Error When value is not Response.
 */
interface IHttpLikeResponse {
    status: number
    text(): Promise<string>
}

/**
 * Validates unknown response shape used in tests.
 *
 * @param value Unknown response-like value.
 * @returns Narrowed response helper.
 * @throws Error When response shape is invalid.
 */
function ensureHttpLikeResponse(value: unknown): IHttpLikeResponse {
    if (typeof value !== "object" || value === null) {
        throw new Error("Expected object response")
    }

    const candidate = value as {
        status?: unknown
        text?: unknown
    }
    const statusValue = candidate.status
    const textMethod = candidate.text

    if (typeof statusValue !== "number") {
        throw new Error("Expected numeric status")
    }
    if (typeof textMethod !== "function") {
        throw new Error("Expected text() function")
    }

    return {
        status: statusValue,
        async text(): Promise<string> {
            const textResult = (textMethod as (this: unknown) => unknown).call(value)
            const resolvedText = await Promise.resolve(textResult)
            if (typeof resolvedText !== "string") {
                throw new Error("Expected text() to resolve string")
            }

            return resolvedText
        },
    }
}
