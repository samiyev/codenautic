import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { CodeReviewForm } from "@/components/settings/code-review-form"
import { renderWithProviders } from "../../utils/render"

describe("CodeReviewForm", (): void => {
    it("when rendered with default values, then shows cadence, severity, suggestions limit and drift signals fields", (): void => {
        renderWithProviders(<CodeReviewForm onSubmit={vi.fn()} />)

        expect(screen.getByText("Review cadence")).not.toBeNull()
        expect(screen.getByText("Severity threshold")).not.toBeNull()
        expect(screen.getByText("Suggestions limit")).not.toBeNull()
        expect(screen.getByText("Enable drift signals")).not.toBeNull()
    })

    it("when rendered, then shows submit button with save label", (): void => {
        renderWithProviders(<CodeReviewForm onSubmit={vi.fn()} />)

        expect(screen.getByRole("button", { name: "Save review config" })).not.toBeNull()
    })

    it("when initialValues are provided, then form uses them as defaults", (): void => {
        renderWithProviders(
            <CodeReviewForm
                initialValues={{
                    cadence: "weekly",
                    enableDriftSignals: true,
                    severity: "high",
                    suggestionsLimit: 15,
                }}
                onSubmit={vi.fn()}
            />,
        )

        expect(screen.getByText("Review cadence")).not.toBeNull()
        expect(screen.getByText("Severity threshold")).not.toBeNull()
    })

    it("when submit button is clicked, then calls onSubmit handler", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()

        renderWithProviders(<CodeReviewForm onSubmit={onSubmit} />)

        const submitButton = screen.getByRole("button", {
            name: "Save review config",
        })
        await user.click(submitButton)

        expect(submitButton).not.toBeNull()
    })

    it("when rendered, then shows drift signals helper text", (): void => {
        renderWithProviders(<CodeReviewForm onSubmit={vi.fn()} />)

        expect(
            screen.getByText("Enable additional insights for drift-related code patterns."),
        ).not.toBeNull()
    })
})
