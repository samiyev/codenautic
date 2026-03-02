import {describe, expect, test} from "bun:test"

import {
    ApiConfigurationValidationError,
    ApiConfigModule,
    loadApiConfig,
    type IApiConfig,
    type IApiConfigOverrides,
} from "../../../src/api/config/api-config.module"

function createValidEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
    return {
        NODE_ENV: "development",
        ADMIN_API_KEY: "admin-key",
        MONGODB_URI: "mongodb://localhost:27017/codenautic",
        REDIS_URL: "redis://localhost:6379",
        ...overrides,
    }
}

describe("loadApiConfig", () => {
    test("loads validated configuration from environment", () => {
        const config = loadApiConfig({
            env: createValidEnv({
                API_HOST: "127.0.0.1",
                API_PORT: "4020",
                API_HEALTHCHECK_ENABLED: "false",
            }),
        })

        expect(config.runtime.nodeEnv).toBe("development")
        expect(config.runtime.processName).toBe("api")
        expect(config.server.host).toBe("127.0.0.1")
        expect(config.server.port).toBe(4020)
        expect(config.server.healthcheckEnabled).toBe(false)
        expect(config.security.adminApiKey).toBe("admin-key")
        expect(config.database.mongodbUri).toBe("mongodb://localhost:27017/codenautic")
        expect(config.cache.redisUrl).toBe("redis://localhost:6379")
    })

    test("applies overrides and validates final configuration", () => {
        const overrides: IApiConfigOverrides = {
            runtime: {
                processName: "api-custom",
            },
            server: {
                port: 5001,
            },
            security: {
                adminApiKey: "override-key",
            },
        }

        const config = loadApiConfig({
            env: createValidEnv(),
            overrides,
        })

        expect(config.runtime.processName).toBe("api-custom")
        expect(config.server.port).toBe(5001)
        expect(config.security.adminApiKey).toBe("override-key")
    })

    test("throws when overrides create invalid config", () => {
        expect(() => {
            return loadApiConfig({
                env: createValidEnv(),
                overrides: {
                    server: {
                        port: 0,
                    },
                },
            })
        }).toThrow(ApiConfigurationValidationError)
    })
})

describe("ApiConfigModule", () => {
    test("creates module from environment and returns immutable snapshots", () => {
        const module = ApiConfigModule.fromEnvironment({
            env: createValidEnv({
                API_PORT: "4900",
            }),
        })

        const serverConfig = module.getServerConfig()
        const runtimeConfig = module.getRuntimeConfig()

        expect(serverConfig.port).toBe(4900)
        expect(runtimeConfig.processName).toBe("api")

        const snapshot = module.getConfig()
        expect(snapshot.server.port).toBe(4900)

        ;(snapshot as {server: {port: number}}).server.port = 3200
        const freshSnapshot = module.getConfig()
        expect(freshSnapshot.server.port).toBe(4900)
    })

    test("constructs module from preloaded config", () => {
        const preloadedConfig: IApiConfig = {
            runtime: {
                nodeEnv: "test",
                processName: "api-tests",
            },
            server: {
                host: "0.0.0.0",
                port: 4100,
                healthcheckEnabled: true,
            },
            security: {
                adminApiKey: "key",
            },
            database: {
                mongodbUri: "mongodb://localhost:27017/tests",
            },
            cache: {
                redisUrl: "redis://localhost:6379/1",
            },
        }

        const module = new ApiConfigModule(preloadedConfig)

        expect(module.getRuntimeConfig().processName).toBe("api-tests")
        expect(module.getDatabaseConfig().mongodbUri).toBe("mongodb://localhost:27017/tests")
        expect(module.getSecurityConfig().adminApiKey).toBe("key")
        expect(module.getCacheConfig().redisUrl).toBe("redis://localhost:6379/1")
    })
})
