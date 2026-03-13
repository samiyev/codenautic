import {describe, expect, test} from "bun:test"

import {type ITagInfo} from "../../../../src/application/dto/git"

describe("ITagInfo DTO contracts", () => {
    test("поддерживает lightweight и annotated tag metadata с associated commit", () => {
        const tag: ITagInfo = {
            name: "v1.2.0",
            sha: "tag-object-sha",
            isAnnotated: true,
            annotationMessage: "Release 1.2.0",
            date: "2026-03-14T10:15:00.000Z",
            commit: {
                sha: "commit-sha",
                message: "Prepare release",
                date: "2026-03-14T09:55:00.000Z",
            },
        }

        expect(tag.name).toBe("v1.2.0")
        expect(tag.sha).toBe("tag-object-sha")
        expect(tag.isAnnotated).toBe(true)
        expect(tag.annotationMessage).toBe("Release 1.2.0")
        expect(tag.commit.sha).toBe("commit-sha")
        expect(tag.commit.message).toBe("Prepare release")
    })
})
