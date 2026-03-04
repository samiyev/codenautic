import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
    CCR_FILTER_PRESETS_STORAGE_KEY,
    CcrManagementPage,
} from "@/pages/ccr-management.page"
import { renderWithProviders } from "../utils/render"

interface IStoredPresetShape {
    readonly id: string
    readonly name: string
    readonly filters: {
        readonly repository: string
        readonly search: string
        readonly status: string
        readonly team: string
    }
}

function readStoredPresets(): ReadonlyArray<IStoredPresetShape> {
    const raw = window.localStorage.getItem(CCR_FILTER_PRESETS_STORAGE_KEY)
    if (raw === null) {
        return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) === false) {
        return []
    }

    return parsed as ReadonlyArray<IStoredPresetShape>
}

describe("ccr management page filter presets", (): void => {
    beforeEach((): void => {
        window.localStorage.removeItem(CCR_FILTER_PRESETS_STORAGE_KEY)
    })

    it("поддерживает CRUD для saved filter presets", async (): Promise<void> => {
        const user = userEvent.setup()
        const onFilterChange = vi.fn<(next: unknown) => void>()

        renderWithProviders(
            <CcrManagementPage
                repository="all"
                search=""
                status="all"
                team="all"
                onFilterChange={onFilterChange}
            />,
        )

        const searchInput = screen.getByPlaceholderText("Search title / id / repo / assignee")
        await user.type(searchInput, "security")
        await user.selectOptions(screen.getByRole("combobox", { name: "Filter by team" }), "frontend")

        await user.type(screen.getByRole("textbox", { name: "Filter preset name" }), "Critical preset")
        await user.click(screen.getByRole("button", { name: "Save preset" }))

        expect(screen.getByRole("option", { name: "Critical preset" })).not.toBeNull()
        expect(readStoredPresets().length).toBe(1)

        await user.clear(searchInput)
        await user.type(searchInput, "temporary-state")
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Saved filter presets" }),
            "Critical preset",
        )
        await user.click(screen.getByRole("button", { name: "Apply preset" }))

        expect((searchInput as HTMLInputElement).value).toBe("security")
        const teamFilterSelect = screen.getByRole("combobox", {
            name: "Filter by team",
        })
        expect(teamFilterSelect).toHaveValue("frontend")

        const presetNameInput = screen.getByRole("textbox", { name: "Filter preset name" })
        await user.clear(presetNameInput)
        await user.type(presetNameInput, "Critical preset v2")
        await user.click(screen.getByRole("button", { name: "Update preset" }))

        const updatedPresets = readStoredPresets()
        expect(updatedPresets.length).toBe(1)
        expect(updatedPresets.at(0)?.name).toBe("Critical preset v2")
        expect(updatedPresets.at(0)?.filters.search).toBe("security")

        await user.click(screen.getByRole("button", { name: "Delete preset" }))
        expect(readStoredPresets().length).toBe(0)
        expect(onFilterChange).toHaveBeenCalled()
    })
})
