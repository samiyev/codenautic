import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CcrReviewDetailPage } from "@/pages/ccr-review-detail.page"
import { MOCK_CCR_ROWS } from "@/pages/ccr-data"
import { renderWithProviders } from "../utils/render"

const originalEventSource = globalThis.EventSource

interface IMockEventSource {
    close: () => void
    emit: (eventType: string, payload: string) => void
    url: string
}

class MockEventSource {
afterEach((): void => {
    if (originalEventSource === undefined) {
        delete (globalThis as { EventSource?: typeof EventSource }).EventSource
    } else {
        globalThis.EventSource = originalEventSource
    }
})

describe("ccr review detail page", (): void => {
    it("рендерит карточку CCR и заголовок чата", (): void => {
        const ccr = MOCK_CCR_ROWS[0]

        renderWithProviders(<CcrReviewDetailPage ccr={ccr} />)

        expect(screen.getByText(ccr.title)).not.toBeNull()
        expect(screen.getByRole("heading", { name: `Conversation · ${ccr.id}` })).not.toBeNull()
    })

    it("добавляет сообщение в чат по quick action", async (): Promise<void> => {
        const user = userEvent.setup()
        const ccr = MOCK_CCR_ROWS[1]

        renderWithProviders(<CcrReviewDetailPage ccr={ccr} />)

        const explainButton = screen.getByRole("button", { name: "explain this file" })
        await user.click(explainButton)

        expect(screen.getByText(/Please explain the current diff/)).not.toBeNull()
        expect(screen.getByText("You")).not.toBeNull()
    })

    it("рендерит SSE viewer при streamSourceUrl", async (): Promise<void> => {
        const user = userEvent.setup()
        const ccr = MOCK_CCR_ROWS[0]
        const createdSources: Array<{ emit: (eventType: string, payload: string) => void }> = []

        class LocalMockEventSource {
            public close: () => void
            public readonly url: string
            private readonly listeners: Record<string, Array<(event: MessageEvent<string>) => void>>

            public constructor(url: string) {
                this.url = url
                this.close = vi.fn()
                this.listeners = {}
                createdSources.push(this)
            }

            public addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
                const listeners = this.listeners[type]
                if (listeners === undefined) {
                    this.listeners[type] = [listener]
                    return
                }

                listeners.push(listener)
            }

            public emit(eventType: string, payload: string): void {
                const listeners = this.listeners[eventType]
                if (listeners === undefined) {
                    return
                }

                const event = { data: payload } as MessageEvent<string>
                listeners.forEach((listener): void => {
                    listener(event)
                })
            }
        }

        // @ts-expect-error mock EventSource only for test
        globalThis.EventSource = LocalMockEventSource as IMockEventSource

        renderWithProviders(
            <CcrReviewDetailPage
                ccr={ccr}
                streamSourceUrl="/api/v1/ccr/stream"
            />,
        )

        const startButton = screen.getByRole("button", { name: "Start" })
        await user.click(startButton)

        const source = createdSources.at(0)
        expect(source).not.toBeUndefined()
        act((): void => {
            source?.emit("message", JSON.stringify({ message: "stream started" }))
        })

        expect(screen.getByText("Live review stream")).not.toBeNull()
        expect(screen.getByText("stream started")).not.toBeNull()
    })

    it("рендерит code diff с inline комментариями", (): void => {
        const ccr = MOCK_CCR_ROWS[0]

        renderWithProviders(<CcrReviewDetailPage ccr={ccr} />)

        expect(screen.getByRole("heading", { name: "Code diff" })).not.toBeNull()
        expect(screen.getByText("src/auth/middleware.ts")).not.toBeNull()
        expect(screen.getByText(/Need consistent error message with existing auth errors/)).not.toBeNull()
    })

    it("поддерживает вложенный review thread с reply/resolve/feedback", async (): Promise<void> => {
        const user = userEvent.setup()
        const ccr = MOCK_CCR_ROWS[0]

        renderWithProviders(<CcrReviewDetailPage ccr={ccr} />)

        expect(screen.getByText("Ari")).not.toBeNull()
        expect(screen.getByText("Nika")).not.toBeNull()
        expect(screen.getByText("Oleg")).not.toBeNull()

        const likeButton = screen.getByRole("button", { name: /Like comment from Oleg/ })
        await user.click(likeButton)
        expect(screen.getByRole("button", { name: "👍 Liked" })).not.toBeNull()

        const resolveButtons = screen.getAllByRole("button", { name: "Resolve" })
        await user.click(resolveButtons[0])
        expect(screen.getAllByText("Resolved").length).toBeGreaterThan(0)

        const replyButton = screen.getByRole("button", { name: "Reply to Ari" })
        await user.click(replyButton)

        const replyTextarea = screen.getByLabelText("Reply textarea for Ari")
        await user.type(replyTextarea, "Looks good, let's handle in next refactor.")
        const addReplyButton = screen.getByRole("button", { name: "Add reply" })
        await user.click(addReplyButton)

        expect(screen.getByText("Looks good, let's handle in next refactor.")).not.toBeNull()
    })
})
