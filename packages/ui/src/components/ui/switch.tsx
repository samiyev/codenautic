import { Switch as HeroUISwitch, type SwitchProps as HeroUISwitchProps } from "@heroui/react"

import { createToggleWrapper } from "./create-toggle-wrapper"

/**
 * Свойства Switch с поддержкой legacy callback `onValueChange`.
 */
interface ISwitchProps extends HeroUISwitchProps {
    /** Legacy callback для изменения состояния. */
    readonly onValueChange?: (isSelected: boolean) => void
    /** Legacy флаг ошибки валидации. */
    readonly isInvalid?: boolean
}

/**
 * Обертка Switch с обратной совместимостью `onValueChange`.
 * Создана через generic factory `createToggleWrapper`.
 */
export const Switch = createToggleWrapper<HeroUISwitchProps>({
    Component: HeroUISwitch,
    invalidAsDataAttr: true,
})

export type { ISwitchProps as SwitchProps }
