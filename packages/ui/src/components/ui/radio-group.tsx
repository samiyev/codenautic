import type { ReactElement, ReactNode } from "react"
import {
    Radio as HeroUIRadio,
    RadioGroup as HeroUIRadioGroup,
    type RadioGroupProps as HeroUIRadioGroupProps,
    type RadioProps as HeroUIRadioProps,
} from "@heroui/react"

/**
 * Свойства группы радиокнопок.
 */
export type RadioGroupProps = HeroUIRadioGroupProps

/**
 * Свойства радиокнопки.
 */
export type RadioProps = HeroUIRadioProps

/**
 * Обертка RadioGroup для совместимости onValueChange.
 *
 * @param props Свойства группы.
 * @returns HeroUI RadioGroup.
 */
export function RadioGroup(props: RadioGroupProps): ReactElement {
    const { isInvalid, onValueChange, ...radioGroupProps } = props
    const validationState = isInvalid === true ? "invalid" : isInvalid === false ? "valid" : undefined
    type TRadioValueChangeHandler = (value: string) => void
    const safeOnValueChange = onValueChange as TRadioValueChangeHandler | undefined

    const handleValueChange = (value: string): void => {
        safeOnValueChange?.(value)
    }

    return (
        <HeroUIRadioGroup
            {...radioGroupProps}
            validationState={validationState}
            onValueChange={handleValueChange}
        />
    )
}

/**
 * Обертка отдельной Radio для единообразного экспорта.
 *
 * @param props Свойства пункта.
 * @returns HeroUI Radio.
 */
export function Radio(props: RadioProps): ReactElement {
    const { children, ...radioProps } = props as RadioProps & { readonly children?: ReactNode }

    return <HeroUIRadio {...radioProps}>{children}</HeroUIRadio>
}
