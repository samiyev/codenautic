import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"

import { ChatInput, type IChatInputProps } from "@/components/chat/chat-input"
import { renderWithProviders } from "../utils/render"

function ChatInputHarness(
    props: Omit<IChatInputProps, "draft" | "onDraftChange">,
): ReactElement {
    const [draft, setDraft] = useState("")

    const handleSubmit = (message: string): void => {
        props.onSubmit(message)
        setDraft("")
    }

    return (
        <ChatInput
            {...props}
            draft={draft}
            onDraftChange={(value): void => {
                setDraft(value)
            }}
            onSubmit={handleSubmit}
        />
    )
}

describe("chat input", (): void => {
    it("отправляет сообщение по Enter и очищает поле", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        renderWithProviders(
            <ChatInputHarness
                onSubmit={onSubmit}
                placeholder="Type a message and press Enter"
            />,
        )

        const textarea = screen.getByRole("textbox", { name: "Message input" })
        await user.click(textarea)
        await user.type(textarea, "hello")
        await user.keyboard("{Enter}")

        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit).toHaveBeenCalledWith("hello")
    })

    it("не отправляет сообщение на Shift+Enter", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        renderWithProviders(
            <ChatInputHarness onSubmit={onSubmit} />,
        )

        const textarea = screen.getByRole("textbox", { name: "Message input" })
        await user.click(textarea)
        await user.type(textarea, "line1{shift>}{Enter}{/shift}line2")
        await user.keyboard("{Escape}")

        expect(onSubmit).toHaveBeenCalledTimes(0)
        expect(textarea).toHaveValue("line1\nline2")
    })

    it("показывает счетчик символов", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        renderWithProviders(
            <ChatInputHarness onSubmit={onSubmit} maxLength={10} />,
        )

        const counter = screen.getByLabelText("Message character count")
        const textarea = screen.getByRole("textbox", { name: "Message input" })
        expect(counter).toHaveTextContent("0/10")

        await user.type(textarea, "abc")
        expect(counter).toHaveTextContent("3/10")
    })

    it("рендерит селектор файла и рендерит submit блокировку во время loading", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        renderWithProviders(
            <ChatInputHarness
                contextOptions={[
                    {
                        id: "file-a",
                        label: "file-a.ts",
                    },
                    {
                        id: "file-b",
                        label: "file-b.ts",
                    },
                ]}
                isLoading
                onSubmit={onSubmit}
            />,
        )

        const textarea = screen.getByRole("textbox", { name: "Message input" })
        await user.type(textarea, "hello")

        const submitButton = screen.getByRole("button", { name: "Отправить" })
        expect(submitButton).toBeDisabled()
    })

    it("рендерит и запускает quick actions", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        const onQuickAction = vi.fn()

        renderWithProviders(
            <ChatInputHarness
                onQuickAction={onQuickAction}
                onSubmit={onSubmit}
                quickActions={[
                    {
                        id: "qa-explain",
                        label: "explain this file",
                        message: "explain file diff",
                    },
                    {
                        id: "qa-summary",
                        label: "summarize changes",
                        message: "summary",
                    },
                ]}
            />,
        )

        const explainButton = screen.getByRole("button", { name: "explain this file" })
        await user.click(explainButton)
        expect(onQuickAction).toHaveBeenCalledTimes(1)
        expect(onQuickAction).toHaveBeenCalledWith("explain file diff")
    })
})
