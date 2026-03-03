/**
 * Набор известных permission key, используемых UI-RBAC.
 */
export const PERMISSION_KEYS = {
    reviewRead: "review:read",
    reviewWrite: "review:write",
    settingsRead: "settings:read",
    settingsWrite: "settings:write",
} as const

/** Ключ разрешения для UI flow. */
export type TPermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS]

/** Ответ от permissions endpoint. */
export interface IPermissionsResponse {
    /** Список разрешений для активного контекста. */
    readonly permissions: ReadonlyArray<TPermissionKey>
}
