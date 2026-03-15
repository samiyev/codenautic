import { type ReactElement } from "react"
import { useTranslation } from "react-i18next"

import { Laptop, Moon, Sun } from "@/components/icons/app-icons"
import { Button } from "@heroui/react"
import { type TThemeMode, type TThemePreset, useTheme } from "@/lib/theme/use-theme"

const MODE_OPTIONS: ReadonlyArray<{
    /** Значение режима. */
    readonly value: TThemeMode
    /** Иконка режима. */
    readonly Icon: typeof Moon
    /** Читаемое название. */
    readonly label: string
    /** aria-метка. */
    readonly ariaLabel: string
}> = [
    {
        Icon: Moon,
        ariaLabel: "Use dark theme",
        label: "Dark",
        value: "dark",
    },
    {
        Icon: Laptop,
        ariaLabel: "Use system theme",
        label: "System",
        value: "system",
    },
    {
        Icon: Sun,
        ariaLabel: "Use light theme",
        label: "Light",
        value: "light",
    },
]

/**
 * Свойства компонента переключателя темы.
 */
export interface IThemeToggleProps {
    /** Дополнительный CSS-класс контейнера. */
    readonly className?: string
}

/**
 * Переключатель режима темы с HeroUI-кнопками и поддержкой system режима.
 *
 * @param props Конфигурация внешнего вида.
 * @returns Блок с тремя кнопками выбора `light`, `system`, `dark`.
 */
export function ThemeToggle(props: IThemeToggleProps): ReactElement {
    const { mode, preset, presets, resolvedMode, setMode, setPreset } = useTheme()

    return (
        <div className={props.className}>
            <div className="flex flex-col gap-2">
                <ThemeModeButtons currentMode={mode} onModeChange={setMode} />
                <ThemePresetButtons
                    currentPreset={preset}
                    onPresetChange={(nextPreset): void => {
                        setPreset(nextPreset as TThemePreset)
                    }}
                    presets={presets}
                />
                <p className="px-1 text-xs text-muted">Preset: {getPresetLabel(presets, preset)}</p>
                <p className="sr-only" aria-live="polite">
                    Active theme resolved mode is {resolvedMode}.
                </p>
            </div>
        </div>
    )
}

/**
 * Кнопки переключения режима темы.
 *
 * @param props Конфигурация.
 * @returns Кнопки Dark/System/Light.
 */
function ThemeModeButtons({
    currentMode,
    onModeChange,
}: {
    readonly currentMode: TThemeMode
    readonly onModeChange: (nextMode: TThemeMode) => void
}): ReactElement {
    const { t } = useTranslation(["navigation"])

    return (
        <div
            aria-label={t("navigation:ariaLabel.themeToggle.themeMode")}
            className="inline-flex items-center rounded-lg border border-border bg-[color:color-mix(in_oklab,var(--surface)_85%,transparent)] p-1 backdrop-blur"
            role="radiogroup"
        >
            {MODE_OPTIONS.map((option): ReactElement => {
                const Icon = option.Icon
                const isSelected = option.value === currentMode

                return (
                    <Button
                        key={option.value}
                        aria-label={option.ariaLabel}
                        aria-pressed={isSelected}
                        aria-selected={isSelected}
                        className="min-w-0 rounded-full px-2"
                        size="sm"
                        variant={isSelected ? "primary" : "ghost"}
                        onPress={(): void => {
                            onModeChange(option.value)
                        }}
                    >
                        <span className="inline-flex items-center gap-1.5">
                            <Icon size={14} />
                            <span className="hidden sm:inline">{option.label}</span>
                        </span>
                    </Button>
                )
            })}
        </div>
    )
}

/**
 * Кнопки выбора пресета темы.
 *
 * @param props Конфигурация.
 * @returns Набор кнопок-пресетов.
 */
function ThemePresetButtons({
    currentPreset,
    onPresetChange,
    presets,
}: {
    readonly currentPreset: string
    readonly onPresetChange: (nextPreset: string) => void
    readonly presets: ReadonlyArray<{ readonly id: string; readonly label: string }>
}): ReactElement {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {presets.map((themePreset): ReactElement => {
                const isActive = themePreset.id === currentPreset

                return (
                    <Button
                        key={themePreset.id}
                        aria-label={`Set ${themePreset.label} theme preset`}
                        aria-pressed={isActive}
                        className="min-w-0 rounded-full"
                        size="sm"
                        variant={isActive ? "primary" : "ghost"}
                        onPress={(): void => {
                            onPresetChange(themePreset.id)
                        }}
                    >
                        {themePreset.label}
                    </Button>
                )
            })}
        </div>
    )
}

/**
 * Возвращает label пресета по id.
 *
 * @param presets Каталог пресетов.
 * @param presetId Идентификатор пресета.
 * @returns Человекочитаемое название.
 */
function getPresetLabel(
    presets: ReadonlyArray<{ readonly id: string; readonly label: string }>,
    presetId: string,
): string {
    const nextPreset = presets.find((themePreset): boolean => themePreset.id === presetId)
    if (nextPreset === undefined) {
        return presetId
    }

    return nextPreset.label
}
