import type { ChangeEvent, ReactElement, ReactNode } from "react"
import {
    TextArea as HeroUITextarea,
    type TextAreaProps as HeroUITextareaProps,
} from "@heroui/react"

/**
 * Свойства `Textarea` с поддержкой legacy callback `onValueChange`.
 */
export interface ITextareaProps extends Omit<HeroUITextareaProps, "onChange"> {
    /** Legacy callback из старого слоя при изменении текста. */
    readonly onValueChange?: (value: string) => void
    readonly onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void
    /** Legacy label prop (обертка-лейбл на месте внутреннего лэйаута). */
    readonly label?: string
    /** Legacy префикс для textarea. */
    readonly startContent?: ReactNode
    /** Legacy суффикс для textarea. */
    readonly endContent?: ReactNode
    /** Legacy флаг ошибки валидации. */
    readonly isInvalid?: boolean
}

/**
 * Алиас для совместимости внешних импортов старого имени типа.
 */
export type TextareaProps = ITextareaProps

/**
 * Textarea с обратной совместимостью `onValueChange`.
 *
 * @param props Свойства текстового поля.
 * @returns Поле ввода текста HeroUI с normalized callback.
 */
export function Textarea(props: TextareaProps): ReactElement {
    const {
        className,
        endContent,
        label,
        onChange,
        onValueChange,
        isInvalid,
        startContent,
        ...textareaProps
    } = props

    const validationState =
        isInvalid === true ? "invalid" : isInvalid === false ? "valid" : undefined
    const textareaClassName = buildTextareaClassName(
        className ?? "",
        startContent !== undefined,
        endContent !== undefined,
    )

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
        if (onChange !== undefined) {
            onChange(event)
        }
        if (onValueChange !== undefined) {
            const target = event.target as HTMLTextAreaElement
            onValueChange(target.value)
        }
    }

    const textarea = (
        <HeroUITextarea
            {...textareaProps}
            className={textareaClassName}
            validationState={validationState}
            onChange={handleChange}
        />
    )

    if (startContent === undefined && endContent === undefined && label === undefined) {
        return textarea
    }

    return (
        <div className="flex flex-col gap-1">
            {label === undefined ? null : <label className="text-sm font-medium">{label}</label>}
            <div className="relative">
                {startContent === undefined ? null : (
                    <span className="pointer-events-none absolute left-2 top-3 inline-flex text-slate-500">
                        {startContent}
                    </span>
                )}
                {textarea}
                {endContent === undefined ? null : (
                    <span className="pointer-events-none absolute right-2 top-3 inline-flex text-slate-500">
                        {endContent}
                    </span>
                )}
            </div>
        </div>
    )
}

function buildTextareaClassName(
    className: string,
    hasStartContent: boolean,
    hasEndContent: boolean,
): string {
    const entries: string[] = [className]
    if (hasStartContent === true) {
        entries.push("ps-9")
    }
    if (hasEndContent === true) {
        entries.push("pe-9")
    }

    return entries.filter((entry): boolean => entry.length > 0).join(" ")
}
