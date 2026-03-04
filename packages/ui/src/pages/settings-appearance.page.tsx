import { type ReactElement } from "react"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button, Card, CardBody, CardHeader, Chip, Input } from "@/components/ui"
import { type ThemePresetId, useThemeMode } from "@/lib/theme/theme-provider"
import { showToastSuccess } from "@/lib/notifications/toast"

/**
 * Страница управления темой интерфейса.
 *
 * @returns Экран Appearance с mode/preset переключением и live preview.
 */
export function SettingsAppearancePage(): ReactElement {
    const { mode, preset, presets, resolvedMode, setMode, setPreset } = useThemeMode()

    const handleResetTheme = (): void => {
        const defaultPreset = presets.at(0)?.id
        setMode("system")
        if (defaultPreset !== undefined) {
            setPreset(defaultPreset as ThemePresetId)
        }
        showToastSuccess("Theme reset to defaults.")
    }

    return (
        <section className="space-y-4">
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Appearance settings</h1>
            <p className="text-sm text-[var(--foreground)]/70">
                Switch theme mode and presets in one place. All changes are applied immediately
                without page reload.
            </p>

            <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold text-[var(--foreground)]">
                        Theme controls
                    </p>
                    <Button
                        variant="flat"
                        onPress={handleResetTheme}
                    >
                        Reset to default
                    </Button>
                </CardHeader>
                <CardBody className="space-y-3">
                    <ThemeToggle />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--foreground)]/70">
                        <Chip size="sm" variant="flat">
                            mode: {mode}
                        </Chip>
                        <Chip size="sm" variant="flat">
                            preset: {preset}
                        </Chip>
                        <Chip size="sm" variant="flat">
                            resolved: {resolvedMode}
                        </Chip>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-base font-semibold text-[var(--foreground)]">Live preview</p>
                </CardHeader>
                <CardBody className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground)]/60">
                                Primary action
                            </p>
                            <button
                                className="mt-2 rounded-full border border-[var(--primary)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]"
                                type="button"
                            >
                                Preview button
                            </button>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground)]/60">
                                Accent & surface
                            </p>
                            <div className="mt-2 flex gap-2">
                                <span className="h-6 w-6 rounded-full bg-[var(--accent)]" />
                                <span className="h-6 w-6 rounded-full bg-[var(--surface-muted)]" />
                            </div>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground)]/60">
                                Form controls
                            </p>
                            <Input
                                aria-label="Appearance preview input"
                                className="mt-2"
                                placeholder="Preview input"
                                value=""
                                onValueChange={(): void => {
                                    return
                                }}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-[var(--foreground)]/70">
                        Preset options: {presets.map((themePreset): string => themePreset.label).join(", ")}
                    </p>
                </CardBody>
            </Card>
        </section>
    )
}
