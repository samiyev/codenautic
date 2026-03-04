import {describe, expect, test} from "bun:test"

import {
    parseRuleConfigList,
} from "../../../../src/application/dto/config/rule-config-data.dto"

describe("rule config dto", () => {
    test("parses rule payload list with normalization", () => {
        const parsed = parseRuleConfigList({
            items: [
                {
                    uuid: "rule-1",
                    title: "Rule title",
                    rule: "Rule body",
                    whyIsThisImportant: "Because",
                    severity: "HIGH",
                    examples: [
                        {
                            snippet: "bad example",
                            isCorrect: false,
                        },
                        {
                            snippet: "good example",
                            isCorrect: true,
                        },
                    ],
                    language: "",
                    buckets: ["bucket-1", "bucket-1", "bucket-2"],
                    scope: "pull-request",
                    plugAndPlay: true,
                },
            ],
        })

        expect(parsed).toEqual([
            {
                uuid: "rule-1",
                title: "Rule title",
                rule: "Rule body",
                whyIsThisImportant: "Because",
                severity: "HIGH",
                examples: [
                    {
                        snippet: "bad example",
                        isCorrect: false,
                    },
                    {
                        snippet: "good example",
                        isCorrect: true,
                    },
                ],
                language: "*",
                buckets: ["bucket-1", "bucket-2"],
                scope: "PULL_REQUEST",
                plugAndPlay: true,
            },
        ])
    })

    test("returns undefined for invalid rule payload", () => {
        expect(parseRuleConfigList({})).toBeUndefined()
        expect(parseRuleConfigList({items: []})).toEqual([])
        expect(parseRuleConfigList({items: [{uuid: ""}]})).toBeUndefined()
    })

    test("returns undefined on duplicate uuids", () => {
        const parsed = parseRuleConfigList({
            items: [
                {
                    uuid: "rule-1",
                    title: "Rule title",
                    rule: "Rule body",
                    whyIsThisImportant: "Because",
                    severity: "HIGH",
                    examples: [
                        {
                            snippet: "bad example",
                            isCorrect: false,
                        },
                    ],
                    language: "*",
                    buckets: ["bucket-1"],
                    scope: "FILE",
                    plugAndPlay: false,
                },
                {
                    uuid: "rule-1",
                    title: "Rule title 2",
                    rule: "Rule body 2",
                    whyIsThisImportant: "Because 2",
                    severity: "LOW",
                    examples: [
                        {
                            snippet: "good example",
                            isCorrect: true,
                        },
                    ],
                    language: "*",
                    buckets: ["bucket-2"],
                    scope: "FILE",
                    plugAndPlay: false,
                },
            ],
        })

        expect(parsed).toBeUndefined()
    })
})
