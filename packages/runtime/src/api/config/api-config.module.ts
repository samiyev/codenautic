import {z} from "zod"

import {
    parseApiEnvironment,
    type IApiEnvironment,
} from "./api-env"

/**
 * Runtime section for API configuration.
 */
export interface IApiRuntimeConfig {
    nodeEnv: IApiEnvironment["nodeEnv"]
    processName: string
}

/**
 * Server section for API configuration.
 */
export interface IApiServerConfig {
    host: string
    port: number
    healthcheckEnabled: boolean
}

/**
 * Security section for API configuration.
 */
export interface IApiSecurityConfig {
    adminApiKey: string
}

/**
 * Database section for API configuration.
 */
export interface IApiDatabaseConfig {
    mongodbUri: string
}

/**
 * Cache section for API configuration.
 */
export interface IApiCacheConfig {
    redisUrl: string
}

/**
 * Aggregated API configuration.
 */
export interface IApiConfig {
    runtime: IApiRuntimeConfig
    server: IApiServerConfig
    security: IApiSecurityConfig
    database: IApiDatabaseConfig
    cache: IApiCacheConfig
}

/**
 * Optional override values for API configuration.
 */
export interface IApiConfigOverrides {
    runtime?: Partial<IApiRuntimeConfig>
    server?: Partial<IApiServerConfig>
    security?: Partial<IApiSecurityConfig>
    database?: Partial<IApiDatabaseConfig>
    cache?: Partial<IApiCacheConfig>
}

/**
 * Loading options for API configuration.
 */
export interface ILoadApiConfigOptions {
    env?: Record<string, string | undefined>
    overrides?: IApiConfigOverrides
}

const apiConfigSchema = z.object({
    runtime: z.object({
        nodeEnv: z.enum(["development", "test", "production"]),
        processName: z.string().min(1),
    }),
    server: z.object({
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        healthcheckEnabled: z.boolean(),
    }),
    security: z.object({
        adminApiKey: z.string().min(1),
    }),
    database: z.object({
        mongodbUri: z.string().min(1),
    }),
    cache: z.object({
        redisUrl: z.string().min(1),
    }),
})

/**
 * Error raised when API configuration fails validation.
 */
export class ApiConfigurationValidationError extends Error {
    /**
     * Creates configuration validation error.
     *
     * @param message Validation diagnostics.
     */
    public constructor(message: string) {
        super(message)
        this.name = "ApiConfigurationValidationError"
    }
}

/**
 * Loads and validates API configuration from environment and optional overrides.
 *
 * @param options Loading options.
 * @returns Fully validated API configuration.
 * @throws ApiConfigurationValidationError When final config is invalid.
 */
export function loadApiConfig(options: ILoadApiConfigOptions = {}): IApiConfig {
    const env = parseApiEnvironment(options.env ?? process.env)
    const baseConfig = createConfigFromEnvironment(env)
    const mergedConfig = mergeConfig(baseConfig, options.overrides)

    return validateApiConfig(mergedConfig)
}

/**
 * API configuration module wrapper.
 */
export class ApiConfigModule {
    private readonly config: IApiConfig

    /**
     * Creates module from preloaded config.
     *
     * @param config Preloaded API config.
     */
    public constructor(config: IApiConfig) {
        this.config = validateApiConfig(config)
    }

    /**
     * Creates module from environment source.
     *
     * @param options Loading options.
     * @returns Config module instance.
     */
    public static fromEnvironment(options: ILoadApiConfigOptions = {}): ApiConfigModule {
        return new ApiConfigModule(loadApiConfig(options))
    }

    /**
     * Returns full config snapshot.
     *
     * @returns Deep-cloned API config.
     */
    public getConfig(): IApiConfig {
        return cloneConfig(this.config)
    }

    /**
     * Returns runtime config snapshot.
     *
     * @returns Runtime config.
     */
    public getRuntimeConfig(): IApiRuntimeConfig {
        return cloneConfig(this.config).runtime
    }

    /**
     * Returns server config snapshot.
     *
     * @returns Server config.
     */
    public getServerConfig(): IApiServerConfig {
        return cloneConfig(this.config).server
    }

    /**
     * Returns security config snapshot.
     *
     * @returns Security config.
     */
    public getSecurityConfig(): IApiSecurityConfig {
        return cloneConfig(this.config).security
    }

    /**
     * Returns database config snapshot.
     *
     * @returns Database config.
     */
    public getDatabaseConfig(): IApiDatabaseConfig {
        return cloneConfig(this.config).database
    }

    /**
     * Returns cache config snapshot.
     *
     * @returns Cache config.
     */
    public getCacheConfig(): IApiCacheConfig {
        return cloneConfig(this.config).cache
    }
}

/**
 * Creates base API config from parsed environment.
 *
 * @param env Parsed API environment.
 * @returns Base config.
 */
function createConfigFromEnvironment(env: IApiEnvironment): IApiConfig {
    return {
        runtime: {
            nodeEnv: env.nodeEnv,
            processName: "api",
        },
        server: {
            host: env.host,
            port: env.port,
            healthcheckEnabled: env.healthcheckEnabled,
        },
        security: {
            adminApiKey: env.adminApiKey,
        },
        database: {
            mongodbUri: env.mongodbUri,
        },
        cache: {
            redisUrl: env.redisUrl,
        },
    }
}

/**
 * Merges overrides into base config.
 *
 * @param baseConfig Base config.
 * @param overrides Optional overrides.
 * @returns Merged config.
 */
function mergeConfig(baseConfig: IApiConfig, overrides?: IApiConfigOverrides): IApiConfig {
    if (overrides === undefined) {
        return cloneConfig(baseConfig)
    }

    return {
        runtime: {
            ...baseConfig.runtime,
            ...(overrides.runtime ?? {}),
        },
        server: {
            ...baseConfig.server,
            ...(overrides.server ?? {}),
        },
        security: {
            ...baseConfig.security,
            ...(overrides.security ?? {}),
        },
        database: {
            ...baseConfig.database,
            ...(overrides.database ?? {}),
        },
        cache: {
            ...baseConfig.cache,
            ...(overrides.cache ?? {}),
        },
    }
}

/**
 * Validates and normalizes API config.
 *
 * @param input Raw config input.
 * @returns Validated config.
 * @throws ApiConfigurationValidationError When validation fails.
 */
function validateApiConfig(input: IApiConfig): IApiConfig {
    const parsed = apiConfigSchema.safeParse(input)

    if (!parsed.success) {
        const diagnostics = parsed.error.issues
            .map((issue) => {
                const path = issue.path.join(".")
                if (path.length === 0) {
                    return issue.message
                }
                return `${path}: ${issue.message}`
            })
            .join("; ")

        throw new ApiConfigurationValidationError(`API config validation failed: ${diagnostics}`)
    }

    return cloneConfig(parsed.data)
}

/**
 * Produces deep clone of configuration object.
 *
 * @param config Source config.
 * @returns Cloned config.
 */
function cloneConfig(config: IApiConfig): IApiConfig {
    return {
        runtime: {
            nodeEnv: config.runtime.nodeEnv,
            processName: config.runtime.processName,
        },
        server: {
            host: config.server.host,
            port: config.server.port,
            healthcheckEnabled: config.server.healthcheckEnabled,
        },
        security: {
            adminApiKey: config.security.adminApiKey,
        },
        database: {
            mongodbUri: config.database.mongodbUri,
        },
        cache: {
            redisUrl: config.cache.redisUrl,
        },
    }
}
