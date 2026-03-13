import {describe, expect, test} from "bun:test"

import {
    type ITemporalCouplingEdge,
    type ITemporalCouplingOptions,
} from "../../../../src/application/dto/git"

describe("ITemporalCouplingEdge DTO contracts", () => {
    test("поддерживает edge-list temporal coupling payload", () => {
        const edge: ITemporalCouplingEdge = {
            sourcePath: "src/app.ts",
            targetPath: "src/review.ts",
            strength: 0.75,
            sharedCommitCount: 3,
            lastSeenAt: "2026-03-08T18:15:00.000Z",
        }

        expect(edge.sourcePath).toBe("src/app.ts")
        expect(edge.targetPath).toBe("src/review.ts")
        expect(edge.strength).toBe(0.75)
        expect(edge.sharedCommitCount).toBe(3)
    })

    test("поддерживает temporal coupling filters с commit window и batch file paths", () => {
        const options: ITemporalCouplingOptions = {
            since: "2026-01-01T00:00:00.000Z",
            until: "2026-03-10T00:00:00.000Z",
            maxCount: 50,
            path: "src/features",
            filePath: "src/index.ts",
            filePaths: ["src/index.ts", "src/review.ts"],
        }

        expect(options.maxCount).toBe(50)
        expect(options.path).toBe("src/features")
        expect(options.filePath).toBe("src/index.ts")
        expect(options.filePaths).toEqual(["src/index.ts", "src/review.ts"])
    })
})
