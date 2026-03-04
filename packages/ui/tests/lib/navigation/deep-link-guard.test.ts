import { describe, expect, it } from "vitest"

import { resolveDeepLinkGuard, sanitizeDeepLinkPath } from "@/lib/navigation/deep-link-guard"

describe("deep-link guard", (): void => {
    it("удаляет чувствительные query параметры", (): void => {
        const sanitized = sanitizeDeepLinkPath("/reviews/412?api_key=secret&tab=summary&token=abc")

        expect(sanitized).toBe("/reviews/412?tab=summary")
    })

    it("разрешает доступный route в текущем tenant", (): void => {
        const result = resolveDeepLinkGuard("/reviews/412?tab=open", {
            isAuthenticated: true,
            role: "developer",
            tenantId: "platform-team",
        })

        expect(result.decision).toBe("allow")
        expect(result.sanitizedPath).toBe("/reviews/412?tab=open")
    })

    it("предлагает switch-org для route доступного в другом tenant", (): void => {
        const result = resolveDeepLinkGuard("/settings-team", {
            isAuthenticated: true,
            role: "admin",
            tenantId: "frontend-team",
        })

        expect(result.decision).toBe("switch_org")
        expect(result.switchTenantId).toBe("platform-team")
    })

    it("блокирует route без доступа и возвращает fallback", (): void => {
        const result = resolveDeepLinkGuard("/settings-unknown?secret=1", {
            isAuthenticated: true,
            role: "viewer",
            tenantId: "runtime-team",
        })

        expect(result.decision).toBe("deny")
        expect(result.sanitizedPath).toBe("/settings")
    })
})
