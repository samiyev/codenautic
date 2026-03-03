import {describe, expect, test} from "bun:test"

import {PROMPT_TEMPLATE_CATEGORY, PROMPT_TEMPLATE_TYPE} from "../../../src/domain/entities/prompt-template.entity"
import {PromptTemplateFactory} from "../../../src/domain/factories/prompt-template.factory"

describe("PromptTemplateFactory", () => {
    test("creates template with default values and normalization", () => {
        const factory = new PromptTemplateFactory()
        const template = factory.create({
            name: "  review summary  ",
            category: "  review  ",
            type: "  SYSTEM  ",
            content: "Hello {{ name }}",
            variables: [{name: " name "}],
            isGlobal: undefined,
        })

        expect(template.id.value).toHaveLength(36)
        expect(template.version).toBe(1)
        expect(template.name).toBe("review summary")
        expect(template.category).toBe(PROMPT_TEMPLATE_CATEGORY.REVIEW)
        expect(template.type).toBe(PROMPT_TEMPLATE_TYPE.SYSTEM)
        expect(template.variables).toEqual([{name: "name"}])
        expect(template.isGlobal).toBe(true)
        expect(template.organizationId).toBeUndefined()
    })

    test("creates scoped template with organizationId", () => {
        const factory = new PromptTemplateFactory()
        const template = factory.create({
            name: "Repo summary",
            category: PROMPT_TEMPLATE_CATEGORY.ANALYSIS,
            type: PROMPT_TEMPLATE_TYPE.USER,
            content: "Repo {{name}}",
            isGlobal: false,
            organizationId: "org-1",
        })

        expect(template.isGlobal).toBe(false)
        expect(template.organizationId?.value).toBe("org-1")
    })

    test("reconstitutes template from persisted payload", () => {
        const factory = new PromptTemplateFactory()
        const template = factory.reconstitute({
            id: "template-1",
            name: "Replayed Template",
            category: PROMPT_TEMPLATE_CATEGORY.RULES,
            type: PROMPT_TEMPLATE_TYPE.SYSTEM,
            content: "Legacy {{value}}",
            variables: [{name: "value"}],
            version: 3,
            isGlobal: true,
        })

        expect(template.id.value).toBe("template-1")
        expect(template.version).toBe(3)
        expect(template.name).toBe("Replayed Template")
    })

    test("throws for invalid payload", () => {
        const factory = new PromptTemplateFactory()
        expect(() => {
            return factory.reconstitute({
                id: "template-2",
                name: "Invalid",
                category: PROMPT_TEMPLATE_CATEGORY.REVIEW,
                type: PROMPT_TEMPLATE_TYPE.USER,
                content: "Hello",
                variables: [],
                version: 0,
                isGlobal: true,
            })
        }).toThrow("Prompt template version must be a positive integer")
    })
})
