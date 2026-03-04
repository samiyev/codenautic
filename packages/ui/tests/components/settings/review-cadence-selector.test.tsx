import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ReviewCadenceSelector } from "@/components/settings/review-cadence-selector"
import { renderWithProviders } from "../../utils/render"

describe("ReviewCadenceSelector", (): void => {
    it("рендерит текущий режим и переключает mode", async (): Promise<void> => {
        const user = userEvent.setup()
        const onModeChange = vi.fn((_mode: "MANUAL" | "AUTO" | "AUTO_PAUSE"): void => {})
        const onApply = vi.fn((): void => {})

        renderWithProviders(
            <ReviewCadenceSelector
                isApplyDisabled={false}
                mode="MANUAL"
                onApply={onApply}
                onModeChange={onModeChange}
            />,
        )

        expect(screen.getByTestId("review-cadence-current")).toHaveTextContent(
            "Current mode: Manual (MANUAL)",
        )

        await user.click(screen.getByRole("radio", { name: /auto-pause/i }))
        await user.click(screen.getByRole("button", { name: "Apply cadence mode" }))

        expect(onModeChange).toHaveBeenCalledWith("AUTO_PAUSE")
        expect(onApply).toHaveBeenCalledTimes(1)
    })
})
