import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ErrorState } from "@/components/states/error-state"
import { renderWithProviders } from "../../utils/render"

describe("ErrorState", (): void => {
    it("when rendered, then displays description", (): void => {
        renderWithProviders(<ErrorState description="Connection failed" />)

        expect(screen.getByText("Connection failed")).not.toBeNull()
    })

    it("when title is provided, then displays it", (): void => {
        renderWithProviders(<ErrorState description="Details here" title="Network Error" />)

        expect(screen.getByText("Network Error")).not.toBeNull()
    })

    it("when title is not provided, then shows default title", (): void => {
        renderWithProviders(<ErrorState description="Error occurred" />)

        expect(screen.getByText("Something went wrong")).not.toBeNull()
    })

    it("when onRetry is provided, then renders retry button", async (): Promise<void> => {
        const user = userEvent.setup()
        const onRetry = vi.fn()

        renderWithProviders(<ErrorState description="Failed" onRetry={onRetry} />)

        const button = screen.getByRole("button", { name: "Retry" })
        await user.click(button)

        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it("when retryLabel is provided, then uses custom label", (): void => {
        renderWithProviders(
            <ErrorState description="Failed" onRetry={vi.fn()} retryLabel="Try again" />,
        )

        expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull()
    })

    it("when onRetry is not provided, then does not render button", (): void => {
        renderWithProviders(<ErrorState description="Error" />)

        expect(screen.queryByRole("button")).toBeNull()
    })
})
