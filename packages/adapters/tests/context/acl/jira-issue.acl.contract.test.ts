import {describe, expect, test} from "bun:test"

import {
    CONTEXT_ISSUE_STATUS,
    CONTEXT_PROVIDER,
    CONTEXT_ACL_ERROR_CODE,
    JiraIssueAcl,
} from "../../../src/context"

describe("JiraIssueAcl contract", () => {
    test("maps Jira issue payload into stable context issue DTO", () => {
        const acl = new JiraIssueAcl()

        const result = acl.transform({
            id: "10001",
            key: "REV-12",
            self: "https://jira.local/rest/api/issue/10001",
            fields: {
                summary: "Fix false-positive in stage orchestrator",
                description: "Observed in nightly run",
                status: {
                    name: "In Progress",
                },
                project: {
                    key: "REV",
                },
                sprint: {
                    name: "Sprint 17",
                },
                assignee: {
                    accountId: "user-1",
                    displayName: "Alice Johnson",
                },
                labels: ["pipeline", "review"],
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful mapping")
        }

        expect(result.value).toEqual({
            provider: CONTEXT_PROVIDER.JIRA,
            issueExternalId: "10001",
            issueKey: "REV-12",
            projectExternalId: "REV",
            title: "Fix false-positive in stage orchestrator",
            description: "Observed in nightly run",
            status: CONTEXT_ISSUE_STATUS.IN_PROGRESS,
            sprintName: "Sprint 17",
            assignee: {
                externalId: "user-1",
                displayName: "Alice Johnson",
            },
            url: "https://jira.local/rest/api/issue/10001",
            labels: ["pipeline", "review"],
        })
    })

    test("extracts sprint from customfield_10020 when sprint field is missing", () => {
        const acl = new JiraIssueAcl()

        const result = acl.transform({
            id: "10002",
            key: "REV-13",
            fields: {
                summary: "Fix flaky integration",
                status: {
                    name: "To Do",
                },
                project: {
                    key: "REV",
                },
                customfield_10020: [
                    {
                        name: "Sprint from custom field",
                    },
                ],
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful mapping")
        }

        expect(result.value.sprintName).toBe("Sprint from custom field")
    })

    test("normalizes Jira statuses to stable status taxonomy", () => {
        const acl = new JiraIssueAcl()

        const todo = acl.transform({
            id: "1",
            key: "A-1",
            fields: {
                summary: "todo",
                status: {name: "To Do"},
                project: {key: "A"},
            },
        })
        const done = acl.transform({
            id: "2",
            key: "A-2",
            fields: {
                summary: "done",
                status: {name: "Done"},
                project: {key: "A"},
            },
        })
        const blocked = acl.transform({
            id: "3",
            key: "A-3",
            fields: {
                summary: "blocked",
                status: {name: "Blocked"},
                project: {key: "A"},
            },
        })
        const unknown = acl.transform({
            id: "4",
            key: "A-4",
            fields: {
                summary: "unknown",
                status: {name: "QA Review"},
                project: {key: "A"},
            },
        })

        expect(todo.isOk).toBe(true)
        expect(done.isOk).toBe(true)
        expect(blocked.isOk).toBe(true)
        expect(unknown.isOk).toBe(true)
        if (todo.isFail || done.isFail || blocked.isFail || unknown.isFail) {
            throw new Error("Expected successful mapping")
        }

        expect(todo.value.status).toBe(CONTEXT_ISSUE_STATUS.TODO)
        expect(done.value.status).toBe(CONTEXT_ISSUE_STATUS.DONE)
        expect(blocked.value.status).toBe(CONTEXT_ISSUE_STATUS.BLOCKED)
        expect(unknown.value.status).toBe(CONTEXT_ISSUE_STATUS.UNKNOWN)
    })

    test("applies safe defaults for optional Jira fields", () => {
        const acl = new JiraIssueAcl()

        const result = acl.transform({
            id: "10004",
            key: "REV-15",
            fields: {
                summary: "Safe defaults",
                status: {
                    name: "Done",
                },
                project: {
                    key: "REV",
                },
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful mapping")
        }

        expect(result.value.description).toBe("")
        expect(result.value.sprintName).toBe("")
        expect(result.value.url).toBe("")
        expect(result.value.labels).toEqual([])
        expect(result.value.assignee).toBeUndefined()
    })

    test("sanitizes labels and ignores invalid entries", () => {
        const acl = new JiraIssueAcl()

        const result = acl.transform({
            id: "10005",
            key: "REV-16",
            fields: {
                summary: "Label cleanup",
                status: {
                    name: "Done",
                },
                project: {
                    key: "REV",
                },
                labels: [" backend ", "", "backend", 123, "infra"],
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful mapping")
        }

        expect(result.value.labels).toEqual(["backend", "infra"])
    })

    test("returns invalid payload error for non-object payload", () => {
        const acl = new JiraIssueAcl()

        const result = acl.transform("invalid")

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid payload failure")
        }

        expect(result.error.code).toBe(CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD)
        expect(result.error.retryable).toBe(false)
    })

    test("returns invalid payload error when fields object is missing", () => {
        const acl = new JiraIssueAcl()

        const result = acl.transform({
            id: "10050",
            key: "REV-50",
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid payload failure")
        }

        expect(result.error.code).toBe(CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD)
    })

    test("returns invalid payload error when required Jira fields are missing", () => {
        const acl = new JiraIssueAcl()

        const result = acl.transform({
            id: "10006",
            key: "REV-17",
            fields: {
                status: {
                    name: "Done",
                },
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid payload failure")
        }

        expect(result.error.code).toBe(CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD)
    })

    test("returns invalid payload error when status or project are malformed", () => {
        const acl = new JiraIssueAcl()

        const statusMissing = acl.transform({
            id: "10007",
            key: "REV-18",
            fields: {
                summary: "x",
                project: {
                    key: "REV",
                },
            },
        })
        const projectMissing = acl.transform({
            id: "10008",
            key: "REV-19",
            fields: {
                summary: "x",
                status: {
                    name: "Done",
                },
            },
        })

        expect(statusMissing.isFail).toBe(true)
        expect(projectMissing.isFail).toBe(true)
        if (statusMissing.isOk || projectMissing.isOk) {
            throw new Error("Expected invalid payload failures")
        }

        expect(statusMissing.error.code).toBe(CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD)
        expect(projectMissing.error.code).toBe(CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD)
    })

    test("returns invalid payload error when status/project objects are incomplete", () => {
        const acl = new JiraIssueAcl()

        const statusIncomplete = acl.transform({
            id: "10060",
            key: "REV-60",
            fields: {
                summary: "x",
                status: {},
                project: {
                    key: "REV",
                },
            },
        })
        const projectIncomplete = acl.transform({
            id: "10061",
            key: "REV-61",
            fields: {
                summary: "x",
                status: {
                    name: "Done",
                },
                project: {},
            },
        })

        expect(statusIncomplete.isFail).toBe(true)
        expect(projectIncomplete.isFail).toBe(true)
        if (statusIncomplete.isOk || projectIncomplete.isOk) {
            throw new Error("Expected invalid payload failures")
        }

        expect(statusIncomplete.error.code).toBe(CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD)
        expect(projectIncomplete.error.code).toBe(CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD)
    })

    test("falls back from invalid sprint object and invalid custom sprint entry", () => {
        const acl = new JiraIssueAcl()

        const result = acl.transform({
            id: "10070",
            key: "REV-70",
            fields: {
                summary: "Sprint fallback",
                status: {
                    name: "Done",
                },
                project: {
                    key: "REV",
                },
                sprint: {},
                customfield_10020: [123],
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful mapping")
        }

        expect(result.value.sprintName).toBe("")
    })
})
