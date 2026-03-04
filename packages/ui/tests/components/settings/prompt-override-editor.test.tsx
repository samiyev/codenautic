import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { PromptOverrideEditor } from "@/components/settings/prompt-override-editor"
import { renderWithProviders } from "../../utils/render"

describe("PromptOverrideEditor", (): void => {
    it("редактирует prompt и вызывает reset callback", async (): Promise<void> => {
        const user = userEvent.setup()
        const onChange = vi.fn<(value: string) => void>()
        const onReset = vi.fn<() => void>()

        renderWithProviders(
            <PromptOverrideEditor value="Base prompt" onChange={onChange} onReset={onReset} />,
        )

        await user.type(screen.getByLabelText("CCR summary prompt override"), " updated")
        await user.click(screen.getByRole("button", { name: "Reset prompt override" }))

        expect(onChange).toHaveBeenCalled()
        expect(onReset).toHaveBeenCalledTimes(1)
    })

    it("показывает preview по кнопке", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(
            <PromptOverrideEditor
                value="### Prompt\n- Keep summary short."
                onChange={(): void => {}}
                onReset={(): void => {}}
            />,
        )

        await user.click(screen.getByRole("button", { name: "Show prompt preview" }))

        expect(screen.getByLabelText("Prompt override preview")).not.toBeNull()
    })
})
