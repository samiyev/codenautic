import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    ExploreModeSidebar,
    type IExploreModePathDescriptor,
} from "@/components/graphs/explore-mode-sidebar"
import { renderWithProviders } from "../utils/render"

const TEST_PATHS: ReadonlyArray<IExploreModePathDescriptor> = [
    {
        description: "Inspect API and service hotspots.",
        fileChainIds: ["src/api/router.ts", "src/services/metrics.ts"],
        id: "backend-path",
        role: "backend",
        title: "Backend path",
    },
    {
        description: "Inspect page and component interactions.",
        fileChainIds: ["src/pages/dashboard.tsx", "src/components/chart.tsx"],
        id: "frontend-path",
        role: "frontend",
        title: "Frontend path",
    },
]

describe("ExploreModeSidebar", (): void => {
    it("фильтрует exploration paths по роли", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<ExploreModeSidebar onNavigatePath={vi.fn()} paths={TEST_PATHS} />)

        expect(screen.getByText("Explore mode sidebar")).not.toBeNull()
        expect(screen.getByText("Backend path")).not.toBeNull()
        expect(screen.getByText("Frontend path")).not.toBeNull()

        await user.selectOptions(screen.getByRole("combobox", { name: "Explore role filter" }), [
            "backend",
        ])
        expect(screen.getByText("Backend path")).not.toBeNull()
        expect(screen.queryByText("Frontend path")).toBeNull()
    })

    it("вызывает callback навигации при выборе path", async (): Promise<void> => {
        const user = userEvent.setup()
        const onNavigatePath = vi.fn()
        renderWithProviders(
            <ExploreModeSidebar onNavigatePath={onNavigatePath} paths={TEST_PATHS} />,
        )

        await user.click(screen.getByRole("button", { name: "Navigate path Backend path" }))

        expect(onNavigatePath).toHaveBeenCalledTimes(1)
        expect(onNavigatePath).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "backend-path",
            }),
        )
    })
})
