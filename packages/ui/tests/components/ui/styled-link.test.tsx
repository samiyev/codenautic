import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StyledLink } from "@/components/ui/styled-link"
import { renderWithProviders } from "../../utils/render"

describe("StyledLink", (): void => {
    it("when rendered with children, then displays link text", (): void => {
        renderWithProviders(<StyledLink to="/">Home</StyledLink>)

        expect(screen.getByText("Home")).not.toBeNull()
    })

    it("when rendered, then applies base underline classes", (): void => {
        renderWithProviders(<StyledLink to="/">Styled</StyledLink>)

        const link = screen.getByText("Styled")
        expect(link.className).toContain("underline")
        expect(link.className).toContain("underline-offset-4")
    })

    it("when custom className is provided, then merges with base classes", (): void => {
        renderWithProviders(
            <StyledLink to="/" className="text-red-500">
                Custom
            </StyledLink>,
        )

        const link = screen.getByText("Custom")
        expect(link.className).toContain("underline")
        expect(link.className).toContain("text-red-500")
    })

    it("when to prop is set, then renders an anchor element", (): void => {
        renderWithProviders(<StyledLink to="/">Link</StyledLink>)

        const link = screen.getByText("Link")
        expect(link.tagName).toBe("A")
    })
})
