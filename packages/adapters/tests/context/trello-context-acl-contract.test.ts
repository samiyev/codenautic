import {describe, expect, test} from "bun:test"

import {
    mapExternalTrelloCard,
    mapTrelloContext,
    TrelloCardAcl,
    TrelloContextAcl,
} from "../../src/context"

describe("Trello context ACL contract", () => {
    test("maps Trello card payload into deterministic DTO", () => {
        const card = mapExternalTrelloCard({
            id: "card-991",
            name: "Sync review stage metadata",
            desc: "Keep Trello context adapter aligned with core DTO contracts.",
            due: "2026-03-20T00:00:00.000Z",
            closed: false,
            dueComplete: false,
            list: {
                id: "list-1",
                name: "In Progress",
            },
            labels: [
                {
                    id: "label-1",
                    name: "review",
                    color: "green",
                },
            ],
            members: [
                {
                    id: "member-1",
                    fullName: "Grace Hopper",
                    username: "ghopper",
                },
            ],
        })

        expect(card).toEqual({
            id: "card-991",
            title: "Sync review stage metadata",
            status: "open",
            description: "Keep Trello context adapter aligned with core DTO contracts.",
            dueDate: "2026-03-20T00:00:00.000Z",
            listName: "In Progress",
            labels: [
                {
                    id: "label-1",
                    name: "review",
                    color: "green",
                },
            ],
            members: [
                {
                    id: "member-1",
                    fullName: "Grace Hopper",
                    username: "ghopper",
                },
            ],
        })
    })

    test("maps Trello context payload with list and labels metadata", () => {
        const context = mapTrelloContext({
            card: {
                id: "card-991",
                name: "Sync review stage metadata",
                status: "in-progress",
                desc: "Keep Trello context adapter aligned with core DTO contracts.",
                due: "2026-03-20T00:00:00.000Z",
                list: {
                    id: "list-1",
                    name: "In Progress",
                },
                labels: [
                    {
                        id: "label-1",
                        name: "review",
                        color: "green",
                    },
                ],
            },
            dateLastActivity: "2026-03-16T08:00:00.000Z",
        })

        expect(context).toEqual({
            source: "TRELLO",
            data: {
                card: {
                    id: "card-991",
                    title: "Sync review stage metadata",
                    status: "in-progress",
                    description: "Keep Trello context adapter aligned with core DTO contracts.",
                    dueDate: "2026-03-20T00:00:00.000Z",
                    listName: "In Progress",
                    labels: [
                        {
                            id: "label-1",
                            name: "review",
                            color: "green",
                        },
                    ],
                },
                listName: "In Progress",
                labels: [
                    "review",
                ],
            },
            fetchedAt: new Date("2026-03-16T08:00:00.000Z"),
        })
    })

    test("exposes Trello ACL adapters as thin wrappers over mapping functions", () => {
        const cardAcl = new TrelloCardAcl()
        const contextAcl = new TrelloContextAcl()

        const card = cardAcl.toDomain({
            id: "card-991",
            name: "Sync review stage metadata",
        })
        const context = contextAcl.toDomain({
            id: "card-991",
            name: "Sync review stage metadata",
        })

        expect(card.id).toBe("card-991")
        expect(context.source).toBe("TRELLO")
    })
})
