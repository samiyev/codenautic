import {
    type IApiEnvironment,
    parseApiEnvironment,
} from "./config/api-env"

/**
 * Minimal HTTP server abstraction for API runtime.
 */
export interface IApiServer {
    /**
     * Stops HTTP server.
     */
    stop(): void
}

/**
 * Server factory options.
 */
export interface IApiServerFactoryOptions {
    port: number
    hostname: string
    fetch(request: Request): Response | Promise<Response>
}

/**
 * HTTP server factory abstraction.
 */
export type IApiServerFactory = (options: IApiServerFactoryOptions) => IApiServer

/**
 * API runtime object returned after successful startup.
 */
export interface IApiRuntime {
    environment: IApiEnvironment
    stop(): void
}

/**
 * Startup options for API runtime.
 */
export interface IStartApiOptions {
    env?: Record<string, string | undefined>
    factory?: IApiServerFactory
}

/**
 * Starts API runtime with validated environment.
 *
 * @param options Optional startup overrides for tests and composition.
 * @returns Running API runtime handle.
 * @throws Error When environment or server factory is invalid.
 */
export function startApi(options: IStartApiOptions = {}): Promise<IApiRuntime> {
    const environment = parseApiEnvironment(options.env ?? process.env)
    const factory = options.factory ?? bunServerFactory

    const server = factory({
        port: environment.port,
        hostname: environment.host,
        fetch(request: Request): Response {
            return handleRequest(request, environment)
        },
    })

    if (!hasStop(server)) {
        throw new Error("API server factory must return object with stop()")
    }

    return Promise.resolve({
        environment,
        stop(): void {
            server.stop()
        },
    })
}

/**
 * Handles API HTTP requests.
 *
 * @param request Incoming request.
 * @param environment Validated API environment.
 * @returns HTTP response.
 */
function handleRequest(request: Request, environment: IApiEnvironment): Response {
    const url = new URL(request.url)

    if (url.pathname === "/health" && environment.healthcheckEnabled === true) {
        return Response.json({
            status: "ok",
        })
    }

    return new Response("Not Found", {
        status: 404,
    })
}

/**
 * Default Bun HTTP server factory.
 *
 * @param options Server options.
 * @returns Bun server instance.
 */
function bunServerFactory(options: IApiServerFactoryOptions): IApiServer {
    return Bun.serve({
        port: options.port,
        hostname: options.hostname,
        fetch(request: Request): Response | Promise<Response> {
            return options.fetch(request)
        },
    })
}

/**
 * Runtime guard for server stop capability.
 *
 * @param value Unknown server value.
 * @returns True when value has stop() function.
 */
function hasStop(value: unknown): value is IApiServer {
    if (typeof value !== "object" || value === null) {
        return false
    }

    const candidate = value as Record<string, unknown>
    const stopMethod = Reflect.get(candidate, "stop")
    return typeof stopMethod === "function"
}
