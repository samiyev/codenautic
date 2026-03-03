import {
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
    useEffect,
    useId,
    useRef,
} from "react"

import {cn} from "@/lib/utils"
import {Button} from "./button"

export interface ModalProps {
    /** Уникальный заголовок модального окна. */
    title: string
    /** Визуальный контент. */
    children: ReactNode
    /** Управляемое состояние открытия. */
    isOpen: boolean
    /** Текст описания, связывается через aria-describedby. */
    description?: ReactNode
    /** Callback закрытия. */
    onOpenChange: (open: boolean) => void
    /** Класс обёртки. */
    className?: string
    /** Закрывать окно при клике по backdrop. */
    closeOnBackdrop?: boolean
}

/**
 * Доступный модальный компонент на основе нативного dialog.
 *
 * @param props - props модального окна
 * @returns React-элемент dialog
 */
export function Modal({
    title,
    children,
    isOpen,
    description,
    onOpenChange,
    className,
    closeOnBackdrop = true,
}: ModalProps): ReactNode {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const titleId = useId()
    const descriptionId = useId()

    useEffect(() => {
        const dialogElement = dialogRef.current
        if (dialogElement === null) {
            return
        }

        if (isOpen === true && dialogElement.open === false) {
            void dialogElement.showModal()
            return
        }

        if (isOpen === false && dialogElement.open === true) {
            dialogElement.close()
        }
    }, [isOpen])

    useEffect(() => {
        const dialogElement = dialogRef.current
        if (dialogElement === null) {
            return
        }

        const handleClose = (): void => {
            onOpenChange(false)
        }

        const handleCancel = (event: Event): void => {
            event.preventDefault()
            onOpenChange(false)
        }

        dialogElement.addEventListener("close", handleClose)
        dialogElement.addEventListener("cancel", handleCancel)

        return () => {
            dialogElement.removeEventListener("close", handleClose)
            dialogElement.removeEventListener("cancel", handleCancel)
        }
    }, [onOpenChange])

    const handleBackdropMouseDown = (event: MouseEvent<HTMLDialogElement>): void => {
        if (closeOnBackdrop === true && event.target === event.currentTarget) {
            onOpenChange(false)
        }
    }

    const handleEscape = (event: KeyboardEvent<HTMLDialogElement>): void => {
        if (event.key === "Escape") {
            onOpenChange(false)
        }
    }

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            aria-describedby={description !== undefined ? descriptionId : undefined}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0 shadow-lg backdrop:bg-black/40"
            onMouseDown={handleBackdropMouseDown}
            onKeyDown={handleEscape}
            onClose={(): void => {
                onOpenChange(false)
            }}
        >
            <section className={cn("w-[min(92vw,36rem)] max-w-full", className)}>
                <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
                    <div>
                        <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
                            {title}
                        </h2>
                        {description !== undefined ? (
                            <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Закрыть модальное окно"
                        onClick={(): void => {
                            onOpenChange(false)
                        }}
                    >
                        ×
                    </Button>
                </header>
                <section className="px-6 py-5">{children}</section>
            </section>
        </dialog>
    )
}
