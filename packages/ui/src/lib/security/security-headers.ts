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

const CONTENT_SECURITY_POLICY_DIRECTIVES = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "https://mcp.figma.com"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:", "https:"],
    "connect-src": ["'self'", "http://localhost:*", "https://*"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
} as const

/**
 * Формирует строку Content-Security-Policy из фиксированного списка директив.
 *
 * @returns Значение заголовка CSP.
 */
export function buildContentSecurityPolicy(): string {
    return Object.entries(CONTENT_SECURITY_POLICY_DIRECTIVES)
        .map(([directive, sources]): string => {
            return `${directive} ${sources.join(" ")}`
        })
        .join("; ")
}

/**
 * Возвращает полный набор security headers для frontend сервера.
 *
 * @returns Заголовки для Vite server/preview.
 */
export function createSecurityHeaders(): ISecurityHeaders {
    return {
        "Content-Security-Policy": buildContentSecurityPolicy(),
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    }
}
