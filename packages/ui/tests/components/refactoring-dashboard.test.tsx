import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    RefactoringDashboard,
    type IRefactoringTargetDescriptor,
} from "@/components/graphs/refactoring-dashboard"
import { renderWithProviders } from "../utils/render"

const TEST_TARGETS: ReadonlyArray<IRefactoringTargetDescriptor> = [
    {
        description: "Queue adapter with recurring bug spikes.",
        effortScore: 7,
        fileId: "src/adapters/queue.ts",
        id: "target-queue",
        module: "adapters",
        riskScore: 88,
        roiScore: 92,
        title: "src/adapters/queue.ts",
    },
    {
        description: "Retry orchestration has moderate debt.",
        effortScore: 5,
        fileId: "src/services/retry.ts",
        id: "target-retry",
        module: "services",
        riskScore: 65,
        roiScore: 74,
        title: "src/services/retry.ts",
    },
    {
        description: "UI page cleanup candidate with low effort.",
        effortScore: 2,
        fileId: "src/pages/ccr-management.page.tsx",
        id: "target-page",
        module: "pages",
        riskScore: 42,
        roiScore: 58,
        title: "src/pages/ccr-management.page.tsx",
    },
]

describe("RefactoringDashboard", (): void => {
    it("фильтрует таргеты по модулю и переключает сортировку", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<RefactoringDashboard targets={TEST_TARGETS} />)

        expect(screen.getByText("Refactoring dashboard")).not.toBeNull()
        expect(screen.getByText("src/adapters/queue.ts")).not.toBeNull()
        expect(screen.getByText("src/services/retry.ts")).not.toBeNull()

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Refactoring module filter" }),
            ["pages"],
        )
        expect(screen.getByText("src/pages/ccr-management.page.tsx")).not.toBeNull()
        expect(screen.queryByText("src/adapters/queue.ts")).toBeNull()

        await user.selectOptions(screen.getByRole("combobox", { name: "Refactoring sort" }), [
            "effort",
        ])
        expect(screen.getByText("src/pages/ccr-management.page.tsx")).not.toBeNull()
    })

    it("вызывает callback при выборе таргета", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectTarget = vi.fn()
        renderWithProviders(
            <RefactoringDashboard onSelectTarget={onSelectTarget} targets={TEST_TARGETS} />,
        )

        await user.click(
            screen.getByRole("button", {
                name: "Inspect refactoring target src/adapters/queue.ts",
            }),
        )
        expect(onSelectTarget).toHaveBeenCalledTimes(1)
        expect(onSelectTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                fileId: "src/adapters/queue.ts",
            }),
        )
    })
})
