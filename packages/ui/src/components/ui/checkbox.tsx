import {
    Checkbox as HeroUICheckbox,
    type CheckboxProps as HeroUICheckboxProps,
    type CheckboxGroupProps,
} from "@heroui/react"

import { createToggleWrapper } from "./create-toggle-wrapper"

/**
 * Свойства Checkbox с поддержкой legacy callback `onValueChange`.
 */
export interface ICheckboxProps extends Omit<HeroUICheckboxProps, "onChange"> {
    /** Legacy callback из старого слоя. */
    readonly onValueChange?: (isSelected: boolean) => void
    /** Legacy флаг ошибки валидации. */
    readonly isInvalid?: boolean
}

/**
 * Обертка Checkbox с поддержкой `onValueChange` для обратной совместимости.
 * Создана через generic factory `createToggleWrapper`.
 */
export const Checkbox = createToggleWrapper<HeroUICheckboxProps>({
    Component: HeroUICheckbox,
})

export type { ICheckboxProps as CheckboxProps }
export type { CheckboxGroupProps }
