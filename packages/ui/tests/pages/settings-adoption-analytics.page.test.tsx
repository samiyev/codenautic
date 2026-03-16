import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SettingsAdoptionAnalyticsPage } from "@/pages/settings-adoption-analytics.page"
import { renderWithProviders } from "../utils/render"

const { mockGetFunnel } = vi.hoisted(() => ({
    mockGetFunnel: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
    createApiContracts: (): {
        readonly adoptionAnalytics: { getFunnel: typeof mockGetFunnel }
    } => ({
        adoptionAnalytics: { getFunnel: mockGetFunnel },
    }),
}))

/**
 * Создаёт mock-ответ adoption analytics.
 *
 * @param range - Диапазон дат.
 * @returns Мок-данные adoption analytics.
 */
function buildMockResponse(range: string): {
    readonly funnelStages: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly count: number
    }>
    readonly workflowHealth: ReadonlyArray<{
        readonly stage: string
        readonly health: string
        readonly summary: string
    }>
    readonly activeUsers: number
    readonly timeToFirstValue: string
} {
    if (range === "7d") {
        return {
            funnelStages: [
                { id: "connect_provider", label: "Connect provider", count: 34 },
                { id: "add_repo", label: "Add repository", count: 28 },
            ],
            workflowHealth: [
                {
                    stage: "Provider setup",
                    health: "healthy",
                    summary: "Most teams finish provider setup within one session.",
                },
            ],
            activeUsers: 31,
            timeToFirstValue: "20h",
        }
    }
    if (range === "90d") {
        return {
            funnelStages: [
                { id: "connect_provider", label: "Connect provider", count: 260 },
                { id: "add_repo", label: "Add repository", count: 228 },
            ],
            workflowHealth: [
                {
                    stage: "Provider setup",
                    health: "healthy",
                    summary: "Stable completion rate.",
                },
            ],
            activeUsers: 184,
            timeToFirstValue: "2d 4h",
        }
    }
    return {
        funnelStages: [
            { id: "connect_provider", label: "Connect provider", count: 100 },
            { id: "add_repo", label: "Add repository", count: 88 },
            { id: "first_scan", label: "First scan", count: 81 },
            { id: "first_insights", label: "First insights", count: 73 },
            { id: "first_ccr_reviewed", label: "First CCR reviewed", count: 62 },
        ],
        workflowHealth: [
            {
                stage: "Provider setup",
                health: "healthy",
                summary: "Most teams finish provider setup within one session.",
            },
            {
                stage: "First scan",
                health: "needs_attention",
                summary: "Some scans delayed by queue contention during peak hours.",
            },
        ],
        activeUsers: 72,
        timeToFirstValue: "1d 9h",
    }
}

describe("SettingsAdoptionAnalyticsPage", (): void => {
    it("показывает funnel, workflow health и privacy boundary", async (): Promise<void> => {
        mockGetFunnel.mockResolvedValue(buildMockResponse("30d"))

        renderWithProviders(<SettingsAdoptionAnalyticsPage />)

        expect(screen.getByText("Usage & adoption analytics")).not.toBeNull()

        expect(await screen.findByText("Adoption funnel")).not.toBeNull()
        expect(screen.getByText("Workflow health")).not.toBeNull()
        expect(screen.getByText(/aggregated UX telemetry/)).not.toBeNull()
    })

    it("пересчитывает метрики при смене диапазона", async (): Promise<void> => {
        mockGetFunnel.mockImplementation(
            async (range: string): Promise<ReturnType<typeof buildMockResponse>> => {
                return buildMockResponse(range)
            },
        )

        const user = userEvent.setup()
        renderWithProviders(<SettingsAdoptionAnalyticsPage />)

        expect(await screen.findByText("1d 9h")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "7d" }))
        expect(await screen.findByText("20h")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "90d" }))
        expect(await screen.findByText("2d 4h")).not.toBeNull()
    })
})
