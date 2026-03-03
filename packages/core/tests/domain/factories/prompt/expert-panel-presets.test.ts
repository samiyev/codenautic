import {describe, expect, test} from "bun:test"

import {
    createClassifierPanel,
    createSafeguardPanel,
} from "../../../../src/domain/factories/prompt/expert-panel-presets"

describe("expert panel presets", () => {
    test("createSafeguardPanel builds five-expert safeguard panel", () => {
        const panel = createSafeguardPanel()

        expect(panel.size).toBe(5)
        expect(
            panel.experts.map((expert) => {
                return {
                    name: expert.name,
                    role: expert.role,
                    priority: expert.priority,
                }
            }),
        ).toEqual([
            {
                name: "Edward",
                role: "VETO",
                priority: 0,
            },
            {
                name: "Alice",
                role: "Syntax",
                priority: 1,
            },
            {
                name: "Bob",
                role: "Logic",
                priority: 2,
            },
            {
                name: "Charles",
                role: "Style",
                priority: 3,
            },
            {
                name: "Diana",
                role: "Referee",
                priority: 4,
            },
        ])
    })

    test("createClassifierPanel builds three-expert peer-review panel", () => {
        const panel = createClassifierPanel()

        expect(panel.size).toBe(3)
        expect(
            panel.experts.map((expert) => {
                return {
                    name: expert.name,
                    role: expert.role,
                    priority: expert.priority,
                }
            }),
        ).toEqual([
            {
                name: "Alice",
                role: "Syntax peer-review",
                priority: 0,
            },
            {
                name: "Bob",
                role: "Logic peer-review",
                priority: 1,
            },
            {
                name: "Charles",
                role: "Style peer-review",
                priority: 2,
            },
        ])
    })

    test("creates equivalent but independent instances on each call", () => {
        const firstPanel = createSafeguardPanel()
        const secondPanel = createSafeguardPanel()

        expect(firstPanel).not.toBe(secondPanel)
        expect(firstPanel.equals(secondPanel)).toBe(true)
    })
})
