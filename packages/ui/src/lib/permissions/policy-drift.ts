import type { TUiRole } from "@/lib/permissions/ui-policy"

export const POLICY_DRIFT_EVENT_NAME = "codenautic:policy-drift"

export interface IPolicyDriftEventDetail {
    /** Новая роль после runtime изменения policy/entitlement. */
    readonly nextRole: TUiRole
    /** Причина изменения policy. */
    readonly reason: string
}

/**
 * Проверяет detail события policy drift.
 *
 * @param value Любое значение из CustomEvent.
 * @returns true если detail соответствует ожидаемой схеме.
 */
export function isPolicyDriftEventDetail(value: unknown): value is IPolicyDriftEventDetail {
    if (typeof value !== "object" || value === null) {
        return false
    }

    const candidate = value as {
        readonly nextRole?: unknown
        readonly reason?: unknown
    }

    const isRole =
        candidate.nextRole === "viewer" ||
        candidate.nextRole === "developer" ||
        candidate.nextRole === "lead" ||
        candidate.nextRole === "admin"

    return isRole && typeof candidate.reason === "string"
}
