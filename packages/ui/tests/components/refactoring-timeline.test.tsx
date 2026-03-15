import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    RefactoringTimeline,
    type IRefactoringTimelineTask,
} from "@/components/refactoring/refactoring-timeline"
import { renderWithProviders } from "../utils/render"

const TEST_TASKS: ReadonlyArray<IRefactoringTimelineTask> = [
    {
        dependencies: [],
        durationWeeks: 2,
        fileId: "src/api/retry.ts",
        id: "task-1",
        startWeek: 1,
        title: "src/api/retry.ts",
    },
    {
        dependencies: ["src/api/retry.ts"],
        durationWeeks: 3,
        fileId: "src/queue/worker.ts",
        id: "task-2",
        startWeek: 3,
        title: "src/queue/worker.ts",
    },
]

describe("RefactoringTimeline", (): void => {
    it("рендерит gantt-подобный план и зависимости", (): void => {
        renderWithProviders(<RefactoringTimeline tasks={TEST_TASKS} />)

        expect(screen.getByText("Refactoring timeline")).not.toBeNull()
        expect(screen.getByText("src/api/retry.ts")).not.toBeNull()
        expect(screen.getByText("Weeks 1–2")).not.toBeNull()
        expect(screen.getByText("Dependencies: none")).not.toBeNull()
        expect(screen.getByText("Dependencies: src/api/retry.ts")).not.toBeNull()
    })

    it("вызывает callback при выборе timeline задачи", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectTask = vi.fn()
        renderWithProviders(<RefactoringTimeline onSelectTask={onSelectTask} tasks={TEST_TASKS} />)

        await user.click(
            screen.getByRole("button", { name: "Inspect timeline task src/queue/worker.ts" }),
        )

        expect(onSelectTask).toHaveBeenCalledTimes(1)
        expect(onSelectTask).toHaveBeenCalledWith(
            expect.objectContaining({
                fileId: "src/queue/worker.ts",
            }),
        )
    })
})
