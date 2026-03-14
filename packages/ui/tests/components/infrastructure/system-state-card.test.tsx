import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SystemStateCard } from "@/components/infrastructure/system-state-card"
import { renderWithProviders } from "../../utils/render"

describe("SystemStateCard", (): void => {
    it("when variant is empty, then renders title and description", (): void => {
        renderWithProviders(
            <SystemStateCard
                description="No data available yet."
                title="No results"
                variant="empty"
            />,
        )

        expect(screen.getByText("No results")).not.toBeNull()
        expect(screen.getByText("No data available yet.")).not.toBeNull()
        expect(screen.getByText("Empty state")).not.toBeNull()
    })

    it("when variant is error, then renders error state label", (): void => {
        renderWithProviders(
            <SystemStateCard
                description="Something went wrong."
                title="Error occurred"
                variant="error"
            />,
        )

        expect(screen.getByText("Error occurred")).not.toBeNull()
        expect(screen.getByText("Error state")).not.toBeNull()
    })

    it("when variant is loading, then renders loading state label", (): void => {
        renderWithProviders(
            <SystemStateCard description="Fetching data..." title="Loading" variant="loading" />,
        )

        expect(screen.getByText("Loading")).not.toBeNull()
        expect(screen.getByText("Loading state")).not.toBeNull()
    })

    it("when variant is partial, then renders partial data state label", (): void => {
        renderWithProviders(
            <SystemStateCard
                description="Some data may be missing."
                title="Partial data"
                variant="partial"
            />,
        )

        expect(screen.getByText("Partial data")).not.toBeNull()
        expect(screen.getByText("Partial data state")).not.toBeNull()
    })

    it("when ctaLabel and onCtaPress are provided, then renders CTA button", async (): Promise<void> => {
        const user = userEvent.setup()
        const onCtaPress = vi.fn()

        renderWithProviders(
            <SystemStateCard
                ctaLabel="Retry"
                description="Something went wrong."
                onCtaPress={onCtaPress}
                title="Error"
                variant="error"
            />,
        )

        const ctaButton = screen.getByRole("button", { name: "Retry" })
        expect(ctaButton).not.toBeNull()

        await user.click(ctaButton)
        expect(onCtaPress).toHaveBeenCalledOnce()
    })

    it("when ctaLabel is not provided, then does not render CTA button", (): void => {
        renderWithProviders(
            <SystemStateCard description="No data available." title="Empty" variant="empty" />,
        )

        expect(screen.queryByRole("button")).toBeNull()
    })
})
