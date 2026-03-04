import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ReviewsContent, type IReviewRow } from "@/components/reviews/reviews-content"
import { renderWithProviders } from "../utils/render"

function createRows(total: number): ReadonlyArray<IReviewRow> {
    return Array.from({ length: total }, (_unusedValue, index): IReviewRow => {
        const suffix = String(index + 1).padStart(3, "0")
        return {
            assignee: `Engineer ${suffix}`,
            comments: (index % 7) + 1,
            id: `CCR-VIRT-${suffix}`,
            repository: "platform/ui",
            status: index % 2 === 0 ? "in_progress" : "queued",
            title: `Virtualized review ${suffix}`,
            updatedAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")} 10:00`,
        }
    })
}

describe("ReviewsContent", (): void => {
    it("рендерит CCR список виртуализованно при большом количестве строк", (): void => {
        const rows = createRows(180)

        renderWithProviders(
            <ReviewsContent hasMore={false} isLoadingMore={false} rows={rows} onLoadMore={(): void => {}} />,
        )

        const table = screen.getByRole("table", { name: "CCR management table" })
        expect(table).toHaveAttribute("data-virtualized", "true")

        const renderedRows = screen.getAllByRole("checkbox", {
            name: /Select CCR-VIRT-/i,
        })
        expect(renderedRows.length).toBeGreaterThan(0)
        expect(renderedRows.length).toBeLessThan(rows.length)
    })
})
