import { describe, expect, it } from "vitest"

import { Skeleton } from "@/components/ui/skeleton"
import { renderWithProviders } from "../../utils/render"

describe("Skeleton", (): void => {
    it("when rendered, then mounts a skeleton element", (): void => {
        const { container } = renderWithProviders(<Skeleton />)

        expect(container.firstChild).not.toBeNull()
    })

    it("when className is provided, then applies it", (): void => {
        const { container } = renderWithProviders(<Skeleton className="h-4 w-32" />)

        expect(container.innerHTML).toContain("h-4")
        expect(container.innerHTML).toContain("w-32")
    })

    it("when rendered as re-export, then is a valid React component", (): void => {
        const { container } = renderWithProviders(
            <div data-testid="skeleton-wrapper">
                <Skeleton />
                <Skeleton />
            </div>,
        )

        expect(container.querySelector("[data-testid='skeleton-wrapper']")?.children).toHaveLength(
            2,
        )
    })
})
