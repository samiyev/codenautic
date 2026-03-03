import type { ReactElement } from "react"
import { useState } from "react"

import { ChatMessageBubble } from "@/components/chat/chat-message-bubble"
import { ChatInput, type IChatFileContextOption } from "@/components/chat/chat-input"
import { Button, Card, CardBody, CardHeader } from "@/components/ui"

/** Роль сообщения в чате. */
export type TChatMessageRole = "assistant" | "system" | "user"

/**
 * Сообщение для чат-панели.
 */
export interface IChatPanelMessage {
    /** Уникальный идентификатор. */
    readonly id: string
    /** Роль автора. */
    readonly role: TChatMessageRole
    /** Содержимое сообщения в markdown-подобном формате. */
    readonly content: string
    /** Отображаемое имя отправителя (необязательно). */
    readonly sender?: string
    /** Временная метка сообщения. */
    readonly createdAt?: string | Date
}

/**
 * Пропсы чат-панели.
 */
export interface IChatPanelProps {
    /** Открыта ли панель. */
    readonly isOpen: boolean
    /** Сообщения для списка. */
    readonly messages: ReadonlyArray<IChatPanelMessage>
    /** Отправить сообщение пользователя. */
    readonly onSendMessage: (message: string) => void
    /** Блокируется отправка/ввод. */
    readonly isLoading?: boolean
    /** Заголовок панели. */
    readonly title?: string
    /** Текст-заполнитель в редакторе. */
    readonly placeholder?: string
    /** Текст, если сообщений нет. */
    readonly emptyStateText?: string
    /** Подпись к input для a11y. */
    readonly inputAriaLabel?: string
    /** Лимит символов в поле ввода. */
    readonly maxMessageLength?: number
    /** Ария-метка для списка сообщений. */
    readonly messageListAriaLabel?: string
    /** Опции контекста файла для отправки сообщения. */
    readonly contextOptions?: ReadonlyArray<IChatFileContextOption>
    /** Ария-метка для селектора контекста. */
    readonly contextAriaLabel?: string
    /** Callback смены выбранного контекста. */
    readonly onContextChange?: (contextId: string) => void
    /** Доступный label для панели (в т.ч. скрин-ридерам). */
    readonly panelAriaLabel?: string
    /** Переопределение контейнера. */
    readonly className?: string
    /** Закрыть панель (опционально). */
    readonly onClose?: () => void
}

/**
 * Sliding-кнопка чата с сообщениями и полем ввода.
 */
export function ChatPanel(props: IChatPanelProps): ReactElement {
    const [draftMessage, setDraftMessage] = useState("")
    const isPanelOpen = props.isOpen === true
    const isSending = props.isLoading === true

    const title = props.title ?? "Conversation"
    const inputPlaceholder = props.placeholder ?? "Type a message and press Enter"
    const emptyText =
        props.emptyStateText ?? "No messages yet. Start the conversation to begin."
    const panelAriaLabel = props.panelAriaLabel ?? "Conversation panel"
    const messageListAriaLabel = props.messageListAriaLabel ?? "Conversation messages"
    const inputAriaLabel = props.inputAriaLabel ?? "Message input"
    const contextAriaLabel = props.contextAriaLabel ?? "File context"
    const maxMessageLength = props.maxMessageLength ?? 4000
    const wrapperClassName =
        `fixed inset-y-0 right-0 z-40 flex w-full transform flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-200 sm:max-w-[420px] ${
            isPanelOpen ? "translate-x-0" : "translate-x-full"
        } ${props.className ?? ""}`

    const handleSubmit = (message: string): void => {
        if (message.length === 0 || isSending) {
            return
        }

        props.onSendMessage(message)
        setDraftMessage("")
    }

    const handleContextChange = (contextId: string): void => {
        props.onContextChange?.(contextId)
    }

    return (
        <aside
            aria-label={panelAriaLabel}
            className={wrapperClassName}
            role="complementary"
        >
            <Card className="min-h-full rounded-none border-0 shadow-none">
                <CardHeader className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]">
                    <h2 className="text-sm font-semibold">{title}</h2>
                    {props.onClose === undefined ? null : (
                        <Button
                            aria-label="Close chat panel"
                            isIconOnly
                            radius="full"
                            size="sm"
                            variant="light"
                            onPress={props.onClose}
                        >
                            ×
                        </Button>
                    )}
                </CardHeader>

                <CardBody className="flex min-h-0 flex-1 flex-col gap-3 bg-[var(--surface-muted)] p-0">
                    {props.messages.length === 0 ? (
                        <div className="p-4 text-sm text-[var(--foreground)]/70" role="status">
                            {emptyText}
                        </div>
                    ) : (
                        <ul
                            aria-live="polite"
                            aria-label={messageListAriaLabel}
                            className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
                            role="log"
                        >
                            {props.messages.map(
                                (message): ReactElement => (
                                    <ChatMessageBubble key={message.id} message={message} />
                                ),
                            )}
                        </ul>
                    )}
                    <ChatInput
                        contextAriaLabel={contextAriaLabel}
                        contextOptions={props.contextOptions}
                        counterAriaLabel="Message character count"
                        draft={draftMessage}
                        inputAriaLabel={inputAriaLabel}
                        isLoading={isSending}
                        maxLength={maxMessageLength}
                        onContextChange={handleContextChange}
                        onDraftChange={setDraftMessage}
                        onSubmit={handleSubmit}
                        placeholder={inputPlaceholder}
                    />
                </CardBody>
            </Card>
        </aside>
    )
}
