import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, type ReactElement } from "react"
import { describe, expect, it } from "vitest"

import { useFilterPersistence } from "@/lib/hooks/use-filter-persistence"
import { renderWithProviders } from "../../utils/render"

const STORAGE_KEY = "test:issues:filters"

interface IFilterValue {
    readonly search: string
    readonly status: "all" | "open"
}

function FilterPersistenceProbe(): ReactElement {
    const [nextSearch, setNextSearch] = useState<string>("ISS-202")
    const persistence = useFilterPersistence<IFilterValue>({
        storageKey: STORAGE_KEY,
        defaultValue: {
            search: "",
            status: "all",
        },
    })

    return (
        <div>
            <p data-testid="persisted-filter-value">
                {`${persistence.value.search}|${persistence.value.status}`}
            </p>
            <button
                data-testid="update-filter"
                onClick={(): void => {
                    persistence.setValue({
                        search: nextSearch,
                        status: "open",
                    })
                }}
                type="button"
            >
                Update filter
            </button>
            <button
                data-testid="reset-filter"
                onClick={(): void => {
                    persistence.reset()
                }}
                type="button"
            >
                Reset filter
            </button>
            <button
                data-testid="change-next-search"
                onClick={(): void => {
                    setNextSearch("ISS-203")
                }}
                type="button"
            >
                Change next search
            </button>
        </div>
    )
}

describe("useFilterPersistence", (): void => {
    it("читает, сохраняет и сбрасывает фильтры через localStorage", async (): Promise<void> => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                search: "ISS-101",
                status: "open",
            }),
        )

        const user = userEvent.setup()
        renderWithProviders(<FilterPersistenceProbe />)

        expect(screen.getByTestId("persisted-filter-value")).toHaveTextContent("ISS-101|open")

        await user.click(screen.getByTestId("change-next-search"))
        await user.click(screen.getByTestId("update-filter"))
        expect(localStorage.getItem(STORAGE_KEY)).toContain("ISS-203")

        await user.click(screen.getByTestId("reset-filter"))
        expect(screen.getByTestId("persisted-filter-value")).toHaveTextContent("|all")
        expect(localStorage.getItem(STORAGE_KEY)).toContain("\"search\":\"\"")
    })
})
