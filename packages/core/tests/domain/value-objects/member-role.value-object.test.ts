import {describe, expect, test} from "bun:test"

import {
    MEMBER_ROLE,
    MemberRole,
} from "../../../src/domain/value-objects/member-role.value-object"

describe("MemberRole", () => {
    test("creates role with expected priority", () => {
        const owner = MemberRole.create("OWNER")
        const admin = MemberRole.create("ADMIN")
        const member = MemberRole.create("MEMBER")
        const viewer = MemberRole.create("VIEWER")

        expect(owner.priority).toBe(1)
        expect(admin.priority).toBe(2)
        expect(member.priority).toBe(3)
        expect(viewer.priority).toBe(4)
    })

    test("normalizes role input and returns stable string representation", () => {
        const role = MemberRole.create("  admin  ")

        expect(role.toString()).toBe(MEMBER_ROLE.ADMIN)
        expect(role.priority).toBe(2)
    })

    test("throws for unsupported role", () => {
        expect(() => {
            MemberRole.create("guest")
        }).toThrow("Unsupported member role: guest")
    })

    test("hasPermission uses priority ordering", () => {
        const owner = MemberRole.create("OWNER")
        const admin = MemberRole.create("ADMIN")
        const member = MemberRole.create("MEMBER")
        const viewer = MemberRole.create("VIEWER")

        expect(owner.hasPermission(admin)).toBe(true)
        expect(admin.hasPermission(owner)).toBe(false)
        expect(member.hasPermission(viewer)).toBe(true)
        expect(viewer.hasPermission(member)).toBe(false)
    })

    test("isHigherThan compares role priorities", () => {
        const owner = MemberRole.create("OWNER")
        const admin = MemberRole.create("ADMIN")
        const member = MemberRole.create("MEMBER")

        expect(owner.isHigherThan(admin)).toBe(true)
        expect(admin.isHigherThan(member)).toBe(true)
        expect(member.isHigherThan(admin)).toBe(false)
        expect(member.isHigherThan(member)).toBe(false)
    })
})
