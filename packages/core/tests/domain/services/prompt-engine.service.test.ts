import {describe, expect, test} from "bun:test"

import {PromptEngineService} from "../../../src/domain/services/prompt-engine.service"

describe("PromptEngineService", () => {
    test("extracts variables in insertion order and unique", () => {
        const service = new PromptEngineService()
        const variables = service.extractVariables("Hello {{ name }}, review {{id}} says {{name}}.")

        expect(variables).toEqual(["name", "id"])
    })

    test("renders template with variables", () => {
        const service = new PromptEngineService()
        const result = service.render("Hello {{ name }}, severity {{severity}}", {
            name: "alice",
            severity: "high",
        })

        expect(result).toBe("Hello alice, severity high")
    })

    test("renders empty string for missing variable", () => {
        const service = new PromptEngineService()
        const result = service.render("Missing {{missing}} value", {
            existing: "x",
        })

        expect(result).toBe("Missing  value")
    })

    test("validates template length", () => {
        const service = new PromptEngineService({
            maxTemplateLength: 5,
        })
        const result = service.validate("more than five")

        expect(result.isFail).toBe(true)
        if (result.isFail) {
            expect(result.error.fields).toEqual([
                {
                    field: "template",
                    message: "Template must be at most 5 characters",
                },
            ])
        }
    })

    test("validates non-empty template", () => {
        const service = new PromptEngineService()
        const result = service.validate("")

        expect(result.isFail).toBe(true)
        if (result.isFail) {
            expect(result.error.fields).toEqual([
                {
                    field: "template",
                    message: "Template must be non-empty",
                },
            ])
        }
    })
})
