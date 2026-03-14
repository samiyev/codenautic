import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BrandMark } from "@/components/layout/brand-mark"
import { renderWithProviders } from "../../utils/render"

describe("BrandMark", (): void => {
    it("when rendered in expanded mode, then shows logo and product name", (): void => {
        renderWithProviders(<BrandMark />)

        expect(screen.getByText("CN")).not.toBeNull()
        expect(screen.getByText("CodeNautic")).not.toBeNull()
    })

    it("when isCompact is true, then hides product name", (): void => {
        renderWithProviders(<BrandMark isCompact />)

        expect(screen.getByText("CN")).not.toBeNull()
        expect(screen.queryByText("CodeNautic")).toBeNull()
    })

    it("when isCompact is false, then shows product name", (): void => {
        renderWithProviders(<BrandMark isCompact={false} />)

        expect(screen.getByText("CN")).not.toBeNull()
        expect(screen.getByText("CodeNautic")).not.toBeNull()
    })

    it("when rendered, then logo container has brand styling", (): void => {
        const { container } = renderWithProviders(<BrandMark />)

        const logo = container.querySelector(".brand-mark-logo")
        expect(logo).not.toBeNull()
    })
})
