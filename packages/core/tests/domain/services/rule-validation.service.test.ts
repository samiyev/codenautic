import {describe, expect, test} from "bun:test"

import {CUSTOM_RULE_TYPE} from "../../../src/domain/entities/custom-rule.entity"
import {ValidationError} from "../../../src/domain/errors/validation.error"
import {RuleValidationService} from "../../../src/domain/services/rule-validation.service"

describe("RuleValidationService", () => {
    test("validates good regex rule", () => {
        const service = new RuleValidationService()
        const result = service.validate(CUSTOM_RULE_TYPE.REGEX, "TODO|FIXME")

        expect(result.isOk).toBe(true)
    })

    test("rejects invalid regex syntax", () => {
        const service = new RuleValidationService()
        const result = service.validate(CUSTOM_RULE_TYPE.REGEX, "(")

        if (result.isFail === false) {
            throw new Error("Expected fail")
        }

        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.fields).toHaveLength(1)
        const validationField = result.error.fields[0]
        if (validationField === undefined) {
            throw new Error("Expected validation error field")
        }

        expect(validationField.field).toBe("rule")
    })

    test("validates non-empty prompt text", () => {
        const service = new RuleValidationService()
        const result = service.validate(CUSTOM_RULE_TYPE.PROMPT, "Check for hardcoded secrets")

        expect(result.isOk).toBe(true)
    })

    test("rejects empty prompt text", () => {
        const service = new RuleValidationService()
        const result = service.validate(CUSTOM_RULE_TYPE.PROMPT, "  ")

        if (result.isFail === false) {
            throw new Error("Expected fail")
        }

        expect(result.error.fields).toHaveLength(1)
        const emptyPromptField = result.error.fields[0]
        if (emptyPromptField === undefined) {
            throw new Error("Expected validation error field")
        }

        expect(emptyPromptField).toEqual({
            field: "rule",
            message: "Prompt rule must be a non-empty string",
        })
    })

    test("validates valid JSON AST query", () => {
        const service = new RuleValidationService()
        const result = service.validate(CUSTOM_RULE_TYPE.AST, '{"kind":"CallExpression"}')

        expect(result.isOk).toBe(true)
    })

    test("rejects invalid AST query", () => {
        const service = new RuleValidationService()
        const result = service.validate(CUSTOM_RULE_TYPE.AST, "{kind:CallExpression}")

        if (result.isFail === false) {
            throw new Error("Expected fail")
        }

        expect(result.error.fields).toHaveLength(1)
        const astField = result.error.fields[0]
        if (astField === undefined) {
            throw new Error("Expected validation error field")
        }

        expect(astField.field).toBe("rule")
    })

    test("rejects non-object AST payload", () => {
        const service = new RuleValidationService()
        const result = service.validate(CUSTOM_RULE_TYPE.AST, '"find-this"')

        if (result.isFail === false) {
            throw new Error("Expected fail")
        }

        expect(result.error.fields).toHaveLength(1)
        const astPayloadField = result.error.fields[0]
        if (astPayloadField === undefined) {
            throw new Error("Expected validation error field")
        }

        expect(astPayloadField).toEqual({
            field: "rule",
            message: "AST rule must be JSON object or array",
        })
    })
})
