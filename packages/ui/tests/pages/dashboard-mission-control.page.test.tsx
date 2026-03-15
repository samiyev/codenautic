import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardMissionControlPage } from "@/pages/dashboard-mission-control.page"
import { renderWithProviders } from "../utils/render"
import { server } from "../mocks/server"

vi.mock("@/components/dashboard/dashboard-content", () => ({
    DashboardContent: (): React.JSX.Element => <div>dashboard-content</div>,
}))

const API_BASE = "http://localhost:7120/api/v1"

/**
 * Регистрирует MSW handlers для dashboard API.
 *
 * Возвращает минимально достаточные данные для рендера dashboard page.
 */
function registerDashboardHandlers(): void {
    server.use(
        http.get(`${API_BASE}/dashboard/metrics`, () => {
            return HttpResponse.json({
                metrics: [
                    {
                        id: "ccr-open",
                        label: "Open CCR",
                        value: "19",
                        caption: "Critical + warnings included",
                        trendDirection: "up",
                        trendLabel: "+8%",
                    },
                    {
                        id: "reviews-complete",
                        label: "CCR reviewed",
                        value: "44",
                        caption: "Auto/manual accepted",
                        trendDirection: "up",
                        trendLabel: "+5%",
                    },
                    {
                        id: "suggestions",
                        label: "Suggestions emitted",
                        value: "420",
                        caption: "Median quality score 82",
                        trendDirection: "neutral",
                        trendLabel: "Stable",
                    },
                    {
                        id: "jobs-health",
                        label: "Active jobs",
                        value: "2",
                        caption: "1 degraded",
                        trendDirection: "down",
                        trendLabel: "-1",
                    },
                ],
            })
        }),
        http.get(`${API_BASE}/dashboard/status-distribution`, () => {
            return HttpResponse.json({
                points: [
                    { status: "approved", count: 122, color: "oklch(0.65 0.17 142)" },
                    { status: "queued", count: 38, color: "oklch(0.78 0.17 90)" },
                ],
            })
        }),
        http.get(`${API_BASE}/dashboard/team-activity`, () => {
            return HttpResponse.json({
                points: [
                    { developer: "Neo", ccrMerged: 11 },
                    { developer: "Trinity", ccrMerged: 9 },
                ],
            })
        }),
        http.get(`${API_BASE}/dashboard/flow-metrics`, () => {
            return HttpResponse.json({
                points: [
                    { deliveryCapacity: 44, flowEfficiency: 59, window: "D1" },
                    { deliveryCapacity: 47, flowEfficiency: 61, window: "D2" },
                ],
            })
        }),
        http.get(`${API_BASE}/dashboard/token-usage`, () => {
            return HttpResponse.json({
                byModel: [
                    { model: "gpt-4o-mini", tokens: 620_000 },
                    { model: "claude-3-7-sonnet", tokens: 430_000 },
                ],
                costTrend: [
                    { costUsd: 97, period: "D1" },
                    { costUsd: 102, period: "D2" },
                ],
            })
        }),
        http.get(`${API_BASE}/dashboard/work-queue`, () => {
            return HttpResponse.json({
                entries: [
                    {
                        id: "critical-ccr",
                        title: "CCR queue",
                        description: "12 pending.",
                        route: "/reviews",
                    },
                ],
            })
        }),
        http.get(`${API_BASE}/dashboard/timeline`, () => {
            return HttpResponse.json({
                entries: [
                    {
                        id: "tl-1",
                        time: "16:10",
                        title: "Code scan finished",
                        description: "Repository core scanned.",
                        details: "Repository core scanned.",
                        group: "Today",
                    },
                ],
            })
        }),
    )
}

describe("DashboardMissionControlPage", (): void => {
    beforeEach((): void => {
        registerDashboardHandlers()
    })

    it("показывает freshness panel и provenance drawer", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<DashboardMissionControlPage />)

        expect(await screen.findByText("Dashboard Mission Control")).not.toBeNull()
        expect(screen.getByText("Dashboard data freshness")).not.toBeNull()
        expect(screen.getByText("Explainability for release risk")).not.toBeNull()
        expect(screen.getByText("Flow metrics")).not.toBeNull()
        expect(
            screen.getByText(
                "Track flow efficiency and delivery capacity dynamics across recent windows.",
            ),
        ).not.toBeNull()
        expect(screen.getByText("Team activity")).not.toBeNull()
        expect(screen.getByText("CCRs merged by developer in selected date range.")).not.toBeNull()
        expect(screen.getByText("Token usage dashboard")).not.toBeNull()
        expect(
            screen.getByText("Usage by model, cost breakdown and trend chart for selected range."),
        ).not.toBeNull()
        expect(screen.getByText("Architecture health")).not.toBeNull()
        expect(
            screen.getByText(
                "Health score, layer violations and DDD compliance in one architecture widget.",
            ),
        ).not.toBeNull()
        expect(screen.getByRole("link", { name: "Open Graph Explorer" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Open Causal Analysis" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Open Impact Planning" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Open Refactoring Planner" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Open Knowledge Map" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Open Reports" })).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Open provenance" }))
        expect(await screen.findByText("Source data provenance")).not.toBeNull()
        expect(await screen.findByText("job-ccr-2026-03-04-7d")).not.toBeNull()
    })

    it("открывает explainability drawer и экспортирует snippet", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<DashboardMissionControlPage />)

        await user.click(await screen.findByRole("button", { name: "Why this score?" }))
        expect(await screen.findByText("Explainability")).not.toBeNull()
        await user.click(screen.getByRole("button", { name: "Export explanation snippet" }))
        expect(await screen.findByLabelText("Explainability export snippet")).not.toBeNull()
    })

    it("выполняет refresh/rescan действия из панели freshness", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<DashboardMissionControlPage />)

        await user.click(await screen.findByRole("button", { name: "Refresh" }))
        expect(screen.getByText("Dashboard refresh requested.")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Rescan" }))
        expect(screen.getByText("Rescan job was queued from mission control.")).not.toBeNull()
    })

    it("сохраняет workspace personalization и генерирует share link", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<DashboardMissionControlPage />)

        await user.selectOptions(
            await screen.findByRole("combobox", { name: "Layout preset" }),
            "ops",
        )
        await user.click(screen.getByRole("checkbox", { name: "Pin /issues" }))
        await user.click(screen.getByRole("button", { name: "Save personalization" }))

        expect(screen.getByText("Workspace personalization saved.")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Generate share link" }))
        expect(screen.getByRole("textbox", { name: "Workspace share link" })).not.toBeNull()
    })
})
