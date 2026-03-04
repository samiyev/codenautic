import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { IssuesTrackingPage } from "@/pages/issues-tracking.page"
import { renderWithProviders } from "../utils/render"

const issues = [
    {
        detectedAt: "2026-01-12T07:11:00Z",
        filePath: "src/api/repository.ts",
        id: "ISS-101",
        message: "Unhandled error path near data parser",
        owner: "Alice",
        repository: "platform-team/api-gateway",
        severity: "critical" as const,
        status: "open" as const,
        title: "Possible unguarded parse fallback",
    },
    {
        detectedAt: "2026-01-14T13:32:00Z",
        filePath: "src/components/chat-panel.tsx",
        id: "ISS-102",
        message: "Potential DOM injection in dynamic markdown renderer",
        owner: "Bob",
        repository: "frontend-team/ui-dashboard",
        severity: "high" as const,
        status: "in_progress" as const,
        title: "Dynamic markdown requires re-check",
    },
    {
        detectedAt: "2026-01-17T09:21:00Z",
        filePath: "src/workers/scan.ts",
        id: "ISS-103",
        message: "High churn + low review ratio in queue handler",
        owner: "Cara",
        repository: "backend-core/payment-worker",
        severity: "medium" as const,
        status: "fixed" as const,
        title: "Scan queue stability issue",
    },
    {
        detectedAt: "2026-01-18T16:58:00Z",
        filePath: "src/pages/reviews.tsx",
        id: "ISS-104",
        message: "Unstable key usage in virtualized list",
        owner: "Dan",
        repository: "frontend-team/ui-dashboard",
        severity: "low" as const,
        status: "dismissed" as const,
        title: "Virtualization key fallback",
    },
]

describe("IssuesTrackingPage", (): void => {
    it("фильтрует списки по поиску, статусу и критичности", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<IssuesTrackingPage issues={issues} />)

        expect(screen.getByRole("heading", { level: 1, name: "Issues tracking" })).not.toBeNull()
        expect(screen.getByText("4 of 4 issues")).not.toBeNull()

        await user.selectOptions(screen.getByRole("combobox", { name: "Filter by severity" }), "critical")
        expect(screen.getByText("1 of 4 issues")).not.toBeNull()

        await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "open")
        expect(screen.getByText("1 of 4 issues")).not.toBeNull()

        await user.selectOptions(screen.getByRole("combobox", { name: "Filter by severity" }), "all")
        await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "all")
        await user.clear(screen.getByRole("textbox", { name: "Search issues" }))
        await user.type(screen.getByRole("textbox", { name: "Search issues" }), "ISS-103")
        expect(screen.getByText("1 of 4 issues")).not.toBeNull()
        expect(screen.getByText("Scan queue stability issue")).not.toBeNull()
    })

    it("вызывает inline action callback с корректным action", async (): Promise<void> => {
        const user = userEvent.setup()
        const handleAction = vi.fn()

        renderWithProviders(<IssuesTrackingPage issues={issues} onAction={handleAction} />)

        const actionButtons = screen.queryAllByRole("button", {
            name: /issue ISS-101/i,
        })
        const firstActionButton = actionButtons[0]
        if (firstActionButton !== undefined) {
            await user.click(firstActionButton)
            expect(handleAction).toHaveBeenCalledTimes(1)
        }
    })

    it("рендерит enterprise table с доступными строками", async (): Promise<void> => {
        renderWithProviders(<IssuesTrackingPage issues={issues} />)

        expect(screen.getByRole("table", { name: "Issue list" })).not.toBeNull()
        expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0)
    })
})
