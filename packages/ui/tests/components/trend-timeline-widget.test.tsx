import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    TrendTimelineWidget,
    type ITrendTimelineEntry,
} from "@/components/graphs/trend-timeline-widget"
import { renderWithProviders } from "../utils/render"

const TEST_ENTRIES: ReadonlyArray<ITrendTimelineEntry> = [
    {
        focusFileId: "src/api/auth.ts",
        focusFileIds: ["src/api/auth.ts", "src/api/login.ts"],
        id: "sprint-12",
        metrics: [
            { label: "Complexity", points: [18, 16, 14, 13] },
            { label: "Coverage", points: [68, 71, 74, 77] },
            { label: "Churn", points: [24, 21, 19, 16] },
        ],
        sprintLabel: "Sprint 12",
        startedAt: "2026-02-03",
        summary: "Complexity dropped while coverage improved.",
    },
    {
        focusFileId: "src/worker/retry.ts",
        focusFileIds: ["src/worker/retry.ts"],
        id: "sprint-11",
        metrics: [
            { label: "Complexity", points: [21, 20, 19, 18] },
            { label: "Coverage", points: [64, 66, 68, 70] },
            { label: "Churn", points: [27, 25, 23, 21] },
        ],
        sprintLabel: "Sprint 11",
        startedAt: "2026-01-20",
        summary: "Stabilization sprint with steady quality gains.",
    },
]

describe("TrendTimelineWidget", (): void => {
    it("рендерит timeline entries и sparklines по метрикам", (): void => {
        renderWithProviders(<TrendTimelineWidget entries={TEST_ENTRIES} />)

        expect(screen.getByText("Trend timeline widget")).not.toBeNull()
        expect(screen.getByLabelText("Trend timeline entries")).not.toBeNull()
        expect(screen.getByText("Sprint 12")).not.toBeNull()
        expect(screen.getAllByLabelText("Complexity sparkline").length).toBeGreaterThan(0)
        expect(screen.getAllByLabelText("Coverage sparkline").length).toBeGreaterThan(0)
        expect(screen.getAllByLabelText("Churn sparkline").length).toBeGreaterThan(0)
    })

    it("вызывает onSelectEntry при выборе sprint entry", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectEntry = vi.fn()
        renderWithProviders(
            <TrendTimelineWidget entries={TEST_ENTRIES} onSelectEntry={onSelectEntry} />,
        )

        await user.click(
            screen.getByRole("button", { name: "Inspect trend timeline sprint Sprint 12" }),
        )

        expect(onSelectEntry).toHaveBeenCalledTimes(1)
        expect(onSelectEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                focusFileId: "src/api/auth.ts",
                id: "sprint-12",
            }),
        )
    })
})
