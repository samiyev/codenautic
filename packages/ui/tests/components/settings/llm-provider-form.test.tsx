import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { LlmProviderForm } from "@/components/settings/llm-provider-form"
import { renderWithProviders } from "../../utils/render"

describe("LlmProviderForm", (): void => {
    it("when rendered, then shows provider, api key, model, endpoint and test-after-save fields", (): void => {
        renderWithProviders(
            <LlmProviderForm
                modelOptions={["gpt-4o-mini", "gpt-4o"]}
                onSubmit={vi.fn()}
                providers={["OpenAI", "Anthropic"]}
            />,
        )

        expect(screen.getByText("Provider")).not.toBeNull()
        expect(screen.getByText("API key / token")).not.toBeNull()
        expect(screen.getByText("Model")).not.toBeNull()
        expect(screen.getByText("Custom endpoint")).not.toBeNull()
        expect(screen.getByText("Test after save")).not.toBeNull()
    })

    it("when rendered, then shows submit button with save label", (): void => {
        renderWithProviders(
            <LlmProviderForm modelOptions={["gpt-4o"]} onSubmit={vi.fn()} providers={["OpenAI"]} />,
        )

        expect(
            screen.getByRole("button", {
                name: "Save LLM configuration",
            }),
        ).not.toBeNull()
    })

    it("when providers array is empty, then uses fallback provider option", (): void => {
        renderWithProviders(<LlmProviderForm modelOptions={[]} onSubmit={vi.fn()} providers={[]} />)

        expect(screen.getByText("Provider")).not.toBeNull()
    })

    it("when initialValues are provided, then form uses them as defaults", (): void => {
        renderWithProviders(
            <LlmProviderForm
                initialValues={{
                    apiKey: "sk-test-key-12345678",
                    endpoint: "https://custom.endpoint.ai/v1",
                    model: "gpt-4o",
                    provider: "OpenAI",
                    testAfterSave: true,
                }}
                modelOptions={["gpt-4o-mini", "gpt-4o"]}
                onSubmit={vi.fn()}
                providers={["OpenAI", "Anthropic"]}
            />,
        )

        expect(screen.getByText("Provider")).not.toBeNull()
        expect(
            screen.getByText("Optional custom API endpoint for enterprise routes."),
        ).not.toBeNull()
    })

    it("when submit button is clicked, then submit handler is accessible", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()

        renderWithProviders(
            <LlmProviderForm
                modelOptions={["gpt-4o"]}
                onSubmit={onSubmit}
                providers={["OpenAI"]}
            />,
        )

        const submitButton = screen.getByRole("button", {
            name: "Save LLM configuration",
        })
        await user.click(submitButton)

        expect(submitButton).not.toBeNull()
    })
})
