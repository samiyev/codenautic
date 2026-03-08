/**
 * Набор security headers для UI runtime и preview-среды.
 */
export interface ISecurityHeaders extends Readonly<Record<string, string>> {
    readonly "Content-Security-Policy": string
    readonly "X-Frame-Options": string
    readonly "X-Content-Type-Options": string
    readonly "Referrer-Policy": string
    readonly "Strict-Transport-Security": string
    readonly "Permissions-Policy": string
}

/**
 * Опции генерации CSP для разных режимов запуска UI.
 */
export interface IContentSecurityPolicyOptions {
    /**
     * Разрешает Vite dev runtime, который использует inline preamble и HMR transport.
     */
    readonly allowDevRuntime?: boolean
}

/**
 * Формирует строку Content-Security-Policy из фиксированного списка директив.
 *
 * @param options Опции генерации политики.
 * @returns Значение заголовка CSP.
 */
export function buildContentSecurityPolicy(options?: IContentSecurityPolicyOptions): string {
    const directives = createContentSecurityPolicyDirectives(options)

    return Object.entries(directives)
        .map(([directive, sources]): string => {
            return `${directive} ${sources.join(" ")}`
        })
        .join("; ")
}

/**
 * Возвращает полный набор security headers для frontend сервера.
 *
 * @param options Опции генерации security headers.
 * @returns Заголовки для Vite server/preview.
 */
export function createSecurityHeaders(options?: IContentSecurityPolicyOptions): ISecurityHeaders {
    return {
        "Content-Security-Policy": buildContentSecurityPolicy(options),
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    }
}

/**
 * Собирает набор CSP-директив для выбранного режима запуска.
 *
 * @param options Опции генерации политики.
 * @returns Объект директив CSP.
 */
function createContentSecurityPolicyDirectives(
    options?: IContentSecurityPolicyOptions,
): Record<string, ReadonlyArray<string>> {
    const allowDevRuntime = options?.allowDevRuntime === true
    const scriptSources = ["'self'"]
    const connectSources = ["'self'", "http://localhost:*", "http://127.0.0.1:*", "https://*"]

    if (allowDevRuntime) {
        scriptSources.push("'unsafe-inline'", "'unsafe-eval'", "blob:")
        connectSources.push("ws://localhost:*", "ws://127.0.0.1:*")
    }

    scriptSources.push("https://mcp.figma.com")

    return {
        "default-src": ["'self'"],
        "script-src": scriptSources,
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "font-src": ["'self'", "data:", "https:"],
        "connect-src": connectSources,
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "object-src": ["'none'"],
        "worker-src": ["'self'", "blob:"],
        "manifest-src": ["'self'"],
    }
}
