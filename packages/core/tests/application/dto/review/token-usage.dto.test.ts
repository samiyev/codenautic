import {describe, expect, test} from "bun:test"

import type {
    ITokenUsageBreakdownDTO,
    ITokenUsageByModelDTO,
    ITokenUsageByStageDTO,
    ITokenUsageDTO,
} from "../../../../src/application/dto/review/token-usage.dto"

describe("Token usage DTOs", () => {
    test("supports token usage summary payload", () => {
        const usage: ITokenUsageDTO = {
            input: 1200,
            output: 300,
            total: 1500,
        }

        expect(usage.total).toBe(1500)
    })

    test("supports token usage breakdown payload", () => {
        const byModel: ITokenUsageByModelDTO = {
            model: "gpt-5",
            input: 1000,
            output: 250,
            total: 1250,
        }
        const byStage: ITokenUsageByStageDTO = {
            stageId: "analyze",
            input: 800,
            output: 200,
            total: 1000,
        }

        const breakdown: ITokenUsageBreakdownDTO = {
            byModel: [byModel],
            byStage: [byStage],
        }

        expect(breakdown.byModel[0]?.model).toBe("gpt-5")
        expect(breakdown.byStage[0]?.stageId).toBe("analyze")
    })
})
