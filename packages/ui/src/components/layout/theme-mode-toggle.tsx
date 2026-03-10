import { type ReactElement, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Laptop, Moon, Sun } from "@/components/icons/app-icons"
import { Button } from "@/components/ui"
import { type ThemeMode, useThemeMode } from "@/lib/theme/theme-provider"

const MODE_ICONS: Record<ThemeMode, typeof Moon> = {
    dark: Moon,
    system: Laptop,
    light: Sun,
}

const MODE_ARIA_KEYS: Record<ThemeMode, string> = {
    dark: "navigation:themeModeToggle.darkAriaLabel",
    system: "navigation:themeModeToggle.systemAriaLabel",
    light: "navigation:themeModeToggle.lightAriaLabel",
}

const MODE_VALUES: ReadonlyArray<ThemeMode> = ["dark", "system", "light"]

/**
 * Props for compact theme mode toggle.
 */
export interface IThemeModeToggleProps {
    /** Additional CSS class. */
    readonly className?: string
}

/**
 * Compact theme mode toggle for header — icons only, no preset selection.
 * Preset selection lives on /settings-appearance page.
 *
 * @param props Configuration.
 * @returns Compact Dark/System/Light icon toggle.
 */
export function ThemeModeToggle(props: IThemeModeToggleProps): ReactElement {
    const { t } = useTranslation(["navigation"])
    const { mode, resolvedMode, setMode } = useThemeMode()

    const modeOptions = useMemo(
        () =>
            MODE_VALUES.map((value) => ({
                Icon: MODE_ICONS[value],
                ariaLabel: (t as unknown as (key: string) => string)(MODE_ARIA_KEYS[value]),
                value,
            })),
        [t],
    )

    return (
        <div className={props.className}>
            <div
                aria-label={t("navigation:themeModeToggle.ariaLabel")}
                className="inline-flex items-center rounded-lg border border-border bg-header-bg p-0.5 backdrop-blur"
                role="radiogroup"
            >
                {modeOptions.map((option): ReactElement => {
                    const Icon = option.Icon
                    const isSelected = option.value === mode

                    return (
                        <Button
                            key={option.value}
                            aria-label={option.ariaLabel}
                            aria-pressed={isSelected}
                            aria-selected={isSelected}
                            className="min-w-0 px-1.5"
                            isIconOnly
                            radius="full"
                            size="sm"
                            variant={isSelected ? "solid" : "light"}
                            onPress={(): void => {
                                setMode(option.value)
                            }}
                        >
                            <Icon size={14} />
                        </Button>
                    )
                })}
            </div>
            <p className="sr-only" aria-live="polite">
                Active theme resolved mode is {resolvedMode}.
            </p>
        </div>
    )
}
