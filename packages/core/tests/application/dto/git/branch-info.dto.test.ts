import {describe, expect, test} from "bun:test"

import type {IBranchInfo} from "../../../../src/application/dto/git"

describe("IBranchInfo", () => {
    test("поддерживает основные атрибуты ветки", () => {
        const branch: IBranchInfo = {
            name: "main",
            sha: "abc123",
            isDefault: true,
            isProtected: false,
        }

        expect(branch.name).toBe("main")
        expect(branch.sha).toBe("abc123")
        expect(branch.isDefault).toBe(true)
        expect(branch.isProtected).toBe(false)
    })
})
