import { describe, expect, it } from "vitest"

import {
    isMultiTabSyncMessage,
    MULTI_TAB_SYNC_CHANNEL,
    TENANT_STORAGE_KEY,
    UI_ROLE_STORAGE_KEY,
    THEME_MODE_STORAGE_KEY,
    THEME_PRESET_STORAGE_KEY,
} from "@/lib/sync/multi-tab-consistency"

describe("multi-tab consistency payload", (): void => {
    it("валидирует tenant sync сообщение", (): void => {
        const isValid = isMultiTabSyncMessage({
            tenantId: "platform-team",
            type: "tenant",
        })

        expect(isValid).toBe(true)
    })

    it("валидирует permissions sync сообщение", (): void => {
        const isValid = isMultiTabSyncMessage({
            role: "lead",
            type: "permissions",
        })

        expect(isValid).toBe(true)
    })

    it("отклоняет некорректный payload", (): void => {
        const isValid = isMultiTabSyncMessage({
            role: "super-admin",
            type: "permissions",
        })

        expect(isValid).toBe(false)
    })

    it("when type is theme, then returns true", (): void => {
        const isValid = isMultiTabSyncMessage({ type: "theme" })
        expect(isValid).toBe(true)
    })

    it("when value is null, then returns false", (): void => {
        expect(isMultiTabSyncMessage(null)).toBe(false)
    })

    it("when value is undefined, then returns false", (): void => {
        expect(isMultiTabSyncMessage(undefined)).toBe(false)
    })

    it("when value is a string, then returns false", (): void => {
        expect(isMultiTabSyncMessage("tenant")).toBe(false)
    })

    it("when value is a number, then returns false", (): void => {
        expect(isMultiTabSyncMessage(42)).toBe(false)
    })

    it("when value is an empty object, then returns false", (): void => {
        expect(isMultiTabSyncMessage({})).toBe(false)
    })

    it("when type is unknown string, then returns false", (): void => {
        expect(isMultiTabSyncMessage({ type: "unknown" })).toBe(false)
    })

    it("when type is tenant but tenantId is invalid, then returns false", (): void => {
        expect(isMultiTabSyncMessage({ type: "tenant", tenantId: "unknown-team" })).toBe(false)
    })

    it("when type is tenant and tenantId is frontend-team, then returns true", (): void => {
        expect(isMultiTabSyncMessage({ type: "tenant", tenantId: "frontend-team" })).toBe(true)
    })

    it("when type is tenant and tenantId is runtime-team, then returns true", (): void => {
        expect(isMultiTabSyncMessage({ type: "tenant", tenantId: "runtime-team" })).toBe(true)
    })

    it("when type is permissions and role is viewer, then returns true", (): void => {
        expect(isMultiTabSyncMessage({ type: "permissions", role: "viewer" })).toBe(true)
    })

    it("when type is permissions and role is developer, then returns true", (): void => {
        expect(isMultiTabSyncMessage({ type: "permissions", role: "developer" })).toBe(true)
    })

    it("when type is permissions and role is admin, then returns true", (): void => {
        expect(isMultiTabSyncMessage({ type: "permissions", role: "admin" })).toBe(true)
    })

    it("when type is permissions but role is missing, then returns false", (): void => {
        expect(isMultiTabSyncMessage({ type: "permissions" })).toBe(false)
    })

    it("when type is tenant but tenantId is missing, then returns false", (): void => {
        expect(isMultiTabSyncMessage({ type: "tenant" })).toBe(false)
    })

    it("when type is tenant and tenantId is number, then returns false", (): void => {
        expect(isMultiTabSyncMessage({ type: "tenant", tenantId: 123 })).toBe(false)
    })
})

describe("multi-tab sync constants", (): void => {
    it("when MULTI_TAB_SYNC_CHANNEL is accessed, then returns expected value", (): void => {
        expect(MULTI_TAB_SYNC_CHANNEL).toBe("codenautic:multi-tab-sync")
    })

    it("when TENANT_STORAGE_KEY is accessed, then returns expected value", (): void => {
        expect(TENANT_STORAGE_KEY).toBe("codenautic:tenant:active")
    })

    it("when UI_ROLE_STORAGE_KEY is accessed, then returns expected value", (): void => {
        expect(UI_ROLE_STORAGE_KEY).toBe("codenautic:rbac:role")
    })

    it("when THEME_MODE_STORAGE_KEY is accessed, then returns expected value", (): void => {
        expect(THEME_MODE_STORAGE_KEY).toBe("cn:theme-mode")
    })

    it("when THEME_PRESET_STORAGE_KEY is accessed, then returns expected value", (): void => {
        expect(THEME_PRESET_STORAGE_KEY).toBe("cn:theme-preset")
    })
})
