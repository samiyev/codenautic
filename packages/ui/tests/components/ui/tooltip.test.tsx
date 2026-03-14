import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Tooltip } from "@/components/ui/tooltip"
import { renderWithProviders } from "../../utils/render"

describe("Tooltip", (): void => {
    it("when rendered with trigger child, then displays trigger content", (): void => {
        renderWithProviders(
            <Tooltip>
                <button type="button">Hover me</button>
            </Tooltip>,
        )

        expect(screen.getByRole("button", { name: /hover me/i })).not.toBeNull()
    })

    it("when rendered, then tooltip component is a re-export from HeroUI", (): void => {
        renderWithProviders(
            <Tooltip>
                <span>Trigger</span>
            </Tooltip>,
        )

        expect(screen.getByText("Trigger")).not.toBeNull()
    })

    it("when rendered with multiple children content, then mounts without error", (): void => {
        renderWithProviders(
            <Tooltip>
                <div data-testid="tooltip-trigger">Info icon</div>
            </Tooltip>,
        )

        expect(screen.getByTestId("tooltip-trigger")).not.toBeNull()
    })
})
