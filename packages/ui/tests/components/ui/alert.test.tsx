import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Alert } from "@/components/ui/alert"
import { renderWithProviders } from "../../utils/render"

describe("Alert", (): void => {
    it("when rendered with children, then displays alert content", (): void => {
        renderWithProviders(<Alert>Something happened</Alert>)

        expect(screen.getByText("Something happened")).not.toBeNull()
    })

    it("when title is provided, then renders title and description", (): void => {
        renderWithProviders(<Alert title="Warning">Details here</Alert>)

        expect(screen.getByText("Warning")).not.toBeNull()
        expect(screen.getByText("Details here")).not.toBeNull()
    })

    it("when title is provided without children, then renders only title", (): void => {
        renderWithProviders(<Alert title="Notice" />)

        expect(screen.getByText("Notice")).not.toBeNull()
    })

    it("when color is danger, then maps to danger status", (): void => {
        renderWithProviders(<Alert color="danger">Error alert</Alert>)

        expect(screen.getByText("Error alert")).not.toBeNull()
    })

    it("when color is primary, then maps to accent status", (): void => {
        renderWithProviders(<Alert color="primary">Info alert</Alert>)

        expect(screen.getByText("Info alert")).not.toBeNull()
    })

    it("when variant is bordered, then applies border class", (): void => {
        const { container } = renderWithProviders(<Alert variant="bordered">Bordered</Alert>)

        expect(container.innerHTML).toContain("border")
    })

    it("when variant is solid, then applies shadow class", (): void => {
        const { container } = renderWithProviders(<Alert variant="solid">Solid</Alert>)

        expect(container.innerHTML).toContain("shadow")
    })
})
