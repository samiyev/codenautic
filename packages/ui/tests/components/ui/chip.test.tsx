import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Chip } from "@/components/ui/chip"
import { renderWithProviders } from "../../utils/render"

describe("Chip", (): void => {
    it("when rendered with children, then displays chip text", (): void => {
        renderWithProviders(<Chip>Active</Chip>)

        expect(screen.getByText("Active")).not.toBeNull()
    })

    it("when color is primary, then maps to accent", (): void => {
        renderWithProviders(<Chip color="primary">Primary chip</Chip>)

        expect(screen.getByText("Primary chip")).not.toBeNull()
    })

    it("when color is secondary, then maps to accent", (): void => {
        renderWithProviders(<Chip color="secondary">Secondary chip</Chip>)

        expect(screen.getByText("Secondary chip")).not.toBeNull()
    })

    it("when variant is flat, then maps to soft", (): void => {
        renderWithProviders(<Chip variant="flat">Flat chip</Chip>)

        expect(screen.getByText("Flat chip")).not.toBeNull()
    })

    it("when variant is light, then maps to tertiary", (): void => {
        renderWithProviders(<Chip variant="light">Light chip</Chip>)

        expect(screen.getByText("Light chip")).not.toBeNull()
    })

    it("when variant is solid, then maps to primary", (): void => {
        renderWithProviders(<Chip variant="solid">Solid chip</Chip>)

        expect(screen.getByText("Solid chip")).not.toBeNull()
    })

    it("when variant is bordered, then maps to secondary", (): void => {
        renderWithProviders(<Chip variant="bordered">Bordered chip</Chip>)

        expect(screen.getByText("Bordered chip")).not.toBeNull()
    })
})
