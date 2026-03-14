import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Slider } from "@/components/ui/slider"
import { renderWithProviders } from "../../utils/render"

describe("Slider", (): void => {
    it("when rendered, then displays a slider with correct aria-label", (): void => {
        renderWithProviders(<Slider aria-label="Volume" minValue={0} maxValue={100} value={50} />)

        expect(screen.getByRole("slider")).not.toBeNull()
        expect(screen.getByLabelText("Volume")).not.toBeNull()
    })

    it("when showOutput is true, then renders formatted output text", (): void => {
        renderWithProviders(
            <Slider aria-label="Brightness" minValue={0} maxValue={100} value={75} showOutput />,
        )

        expect(screen.getByText("75")).not.toBeNull()
    })

    it("when formatOutput is provided, then uses custom formatter", (): void => {
        renderWithProviders(
            <Slider
                aria-label="Percentage"
                minValue={0}
                maxValue={100}
                value={42}
                showOutput
                formatOutput={(v: number): string => `${v}%`}
            />,
        )

        expect(screen.getByText("42%")).not.toBeNull()
    })

    it("when isDisabled is true, then slider is disabled", (): void => {
        renderWithProviders(
            <Slider aria-label="Disabled slider" minValue={0} maxValue={10} value={5} isDisabled />,
        )

        const slider = screen.getByRole("slider")
        expect(slider).toHaveAttribute("disabled")
    })

    it("when onChange is provided, then callback is available", (): void => {
        const handleChange = vi.fn()

        renderWithProviders(
            <Slider
                aria-label="Interactive"
                minValue={0}
                maxValue={100}
                value={30}
                onChange={handleChange}
            />,
        )

        expect(screen.getByRole("slider")).not.toBeNull()
    })
})
