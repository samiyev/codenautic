import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SettingsProviderDegradationPage } from "@/pages/settings-provider-degradation.page"
import { renderWithProviders } from "../utils/render"

const { mockGetStatus, mockQueueAction } = vi.hoisted(() => ({
    mockGetStatus: vi.fn(),
    mockQueueAction: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
    createApiContracts: (): {
        readonly providerStatus: {
            getStatus: typeof mockGetStatus
            queueAction: typeof mockQueueAction
        }
    } => ({
        providerStatus: {
            getStatus: mockGetStatus,
            queueAction: mockQueueAction,
        },
    }),
}))

describe("SettingsProviderDegradationPage", (): void => {
    it("переключает degraded mode и queue/retry критичных действий", async (): Promise<void> => {
        mockGetStatus.mockResolvedValue({
            state: {
                provider: "llm",
                level: "operational",
                affectedFeatures: [],
                eta: "stable",
                runbookUrl: "https://status.codenautic.local/runbooks/llm",
            },
            queuedActions: [],
        })
        mockQueueAction.mockResolvedValue({
            id: "qact-test-1",
            description: "CCR finalization webhook",
            status: "queued",
        })

        const user = userEvent.setup()
        renderWithProviders(<SettingsProviderDegradationPage />)

        expect(
            screen.getByRole("heading", { level: 1, name: "Provider degradation mode" }),
        ).not.toBeNull()
        expect(screen.getByText("Operational mode")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Simulate outage" }))
        await waitFor(() => {
            expect(screen.getByText("Degraded mode active")).not.toBeNull()
        })
        expect(screen.getByText("Review generation")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Queue critical action" }))
        expect(screen.getByText("CCR finalization webhook")).not.toBeNull()
        expect(screen.getByText("Status: queued")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Retry queued actions" }))
        await waitFor(() => {
            expect(screen.getByText("Status: retrying")).not.toBeNull()
        })

        await user.click(screen.getByRole("button", { name: "Mark operational" }))
        await waitFor(() => {
            expect(screen.getByText("Operational mode")).not.toBeNull()
        })
    })
})
