import {describe, expect, test} from "bun:test"

import {
    JiraContextAcl,
    JiraTicketAcl,
    LinearContextAcl,
    LinearIssueAcl,
    mapExternalJiraTicket,
    mapExternalLinearIssue,
    mapJiraContext,
    mapLinearContext,
} from "../../src/context"

describe("Context ACL contract", () => {
    test("maps Jira issue fields/status/sprint into domain-safe DTO", () => {
        const ticket = mapExternalJiraTicket({
            key: "PRJ-101",
            fields: {
                summary: "Fix auth bug",
                status: {
                    name: "In Progress",
                },
                sprint: {
                    name: "Sprint 42",
                },
            },
            sdkPayload: {
                raw: true,
            },
        })

        expect(ticket).toEqual({
            key: "PRJ-101",
            summary: "Fix auth bug",
            status: "In Progress",
        })
    })

    test("normalizes invalid Jira payload without breaking domain model", () => {
        const ticket = mapExternalJiraTicket({
            id: 99,
            fields: {
                summary: 404,
                status: {
                    name: 500,
                },
                customfield_10020: [
                    {
                        name: "Sprint Board",
                    },
                ],
            },
        })

        expect(ticket).toEqual({
            key: "99",
            summary: "(no summary)",
            status: "unknown",
        })
    })

    test("maps Linear issue state/cycle into domain-safe DTO", () => {
        const issue = mapExternalLinearIssue({
            id: "LIN-77",
            title: "Refactor review stage",
            state: {
                name: "Started",
            },
            cycle: {
                name: "Cycle 12",
            },
        })

        expect(issue).toEqual({
            id: "LIN-77",
            title: "Refactor review stage",
            state: "Started",
        })
    })

    test("normalizes invalid Linear payload without breaking domain model", () => {
        const issue = mapExternalLinearIssue({
            issueId: 88,
            name: 123,
            state: null,
            status: {
                name: "Backlog",
            },
        })

        expect(issue).toEqual({
            id: "88",
            title: "(no title)",
            state: "Backlog",
        })
    })

    test("prefers explicit Jira sprint and trims textual fields", () => {
        const ticket = mapExternalJiraTicket({
            key: "  PRJ-200  ",
            fields: {
                summary: "  Align ACL  ",
                status: {
                    name: "  Open  ",
                },
                sprint: {
                    name: "  Sprint Direct  ",
                },
                customfield_10020: [
                    {
                        name: "Fallback Sprint",
                    },
                ],
            },
        })

        const context = mapJiraContext({
            key: "PRJ-200",
            fields: {
                summary: "Align ACL",
                status: {
                    name: "Open",
                },
                sprint: {
                    name: "  Sprint Direct  ",
                },
                customfield_10020: [
                    {
                        name: "Fallback Sprint",
                    },
                ],
            },
        })

        expect(ticket).toEqual({
            key: "PRJ-200",
            summary: "Align ACL",
            status: "Open",
        })
        expect((context.data as {sprint?: string}).sprint).toBe("Sprint Direct")
    })

    test("uses numeric Jira id when string identifiers are blank", () => {
        const ticket = mapExternalJiraTicket({
            key: "   ",
            issueKey: "",
            id: 321,
            fields: {
                summary: "Numeric id fallback",
                status: {
                    name: "Todo",
                },
            },
        })

        expect(ticket.key).toBe("321")
    })

    test("falls back from blank Jira text fields and invalid id number", () => {
        const ticket = mapExternalJiraTicket({
            key: "   ",
            issueKey: "   ",
            id: Number.POSITIVE_INFINITY,
            title: "  Summary from root title  ",
            status: "  Root status  ",
            fields: {
                summary: "   ",
                status: {
                    name: "   ",
                    statusCategory: "  In QA  ",
                },
            },
        })

        expect(ticket).toEqual({
            key: "UNKNOWN",
            summary: "Summary from root title",
            status: "In QA",
        })
    })

    test("prefers cycle object name and trims Linear textual fields", () => {
        const issue = mapExternalLinearIssue({
            identifier: "  LIN-200  ",
            name: "  Review cleanup  ",
            status: {
                name: "  In Review  ",
            },
            cycle: {
                name: "  Cycle Object  ",
            },
            cycleName: "Cycle Fallback",
        })

        const context = mapLinearContext({
            id: "LIN-200",
            title: "Review cleanup",
            state: {
                name: "In Review",
            },
            cycle: {
                name: "  Cycle Object  ",
            },
            cycleName: "Cycle Fallback",
        })

        expect(issue).toEqual({
            id: "LIN-200",
            title: "Review cleanup",
            state: "In Review",
        })
        expect((context.data as {cycle?: string}).cycle).toBe("Cycle Object")
    })

    test("falls back from blank Linear text fields", () => {
        const issue = mapExternalLinearIssue({
            id: "LIN-404",
            title: "   ",
            name: "  Name fallback  ",
            state: {
                name: "   ",
            },
            status: {
                name: "  Backlog  ",
            },
        })

        expect(issue).toEqual({
            id: "LIN-404",
            title: "Name fallback",
            state: "Backlog",
        })
    })

    test("builds normalized Jira context with deterministic fetchedAt fallback", () => {
        const context = mapJiraContext({
            key: "PRJ-9",
            fields: {
                summary: "Investigate",
                status: {
                    name: "Todo",
                },
                customfield_10020: [
                    {
                        name: "Board Sprint",
                    },
                ],
            },
            fetchedAt: "not-a-date",
        })

        expect(context).toEqual({
            source: "JIRA",
            data: {
                ticket: {
                    key: "PRJ-9",
                    summary: "Investigate",
                    status: "Todo",
                },
                sprint: "Board Sprint",
            },
            fetchedAt: new Date(0),
        })
    })

    test("builds normalized Linear context with parsed fetchedAt", () => {
        const context = mapLinearContext({
            id: "L-1",
            title: "Context",
            state: "Done",
            cycleName: "Cycle Alpha",
            updated_at: "2026-03-07T12:00:00.000Z",
        })

        expect(context).toEqual({
            source: "LINEAR",
            data: {
                issue: {
                    id: "L-1",
                    title: "Context",
                    state: "Done",
                },
                cycle: "Cycle Alpha",
            },
            fetchedAt: new Date("2026-03-07T12:00:00.000Z"),
        })
    })

    test("exposes class-based ACL wrappers for Jira and Linear", () => {
        const jiraTicketAcl = new JiraTicketAcl()
        const linearIssueAcl = new LinearIssueAcl()
        const jiraContextAcl = new JiraContextAcl()
        const linearContextAcl = new LinearContextAcl()

        const jiraTicket = jiraTicketAcl.toDomain({
            key: "PRJ-7",
            summary: "From root",
            status: "Open",
        })
        const linearIssue = linearIssueAcl.toDomain({
            id: "LIN-3",
            title: "Issue",
            state: "Todo",
        })
        const jiraContext = jiraContextAcl.toDomain({
            key: "PRJ-7",
            summary: "Context",
            status: "Open",
            fetchedAt: new Date("2026-03-07T15:00:00.000Z"),
        })
        const linearContext = linearContextAcl.toDomain({
            id: "LIN-3",
            title: "Issue",
            state: "Todo",
            timestamp: 0,
        })

        expect(jiraTicket).toEqual({
            key: "PRJ-7",
            summary: "From root",
            status: "Open",
        })
        expect(linearIssue).toEqual({
            id: "LIN-3",
            title: "Issue",
            state: "Todo",
        })
        expect(jiraContext.source).toBe("JIRA")
        expect(linearContext.source).toBe("LINEAR")
    })

    test("keeps context payload free from raw sdk-specific root fields", () => {
        const jira = mapJiraContext({
            key: "PRJ-1",
            fields: {
                summary: "A",
                status: {
                    name: "Open",
                },
            },
            sdkRootField: "must-not-leak",
        })

        const linear = mapLinearContext({
            id: "LIN-1",
            title: "B",
            state: "Done",
            sdkRootField: "must-not-leak",
        })

        expect(Object.keys(jira.data as Record<string, unknown>).sort()).toEqual([
            "sprint",
            "ticket",
        ])
        expect(Object.keys(linear.data as Record<string, unknown>).sort()).toEqual([
            "cycle",
            "issue",
        ])
    })
})
