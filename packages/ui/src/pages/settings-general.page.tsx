import type { ReactElement } from "react"

import { Tabs } from "@heroui/react"
import { useTranslation } from "react-i18next"

import { SettingsAppearancePage } from "./settings-appearance.page"
import { SettingsNotificationsPage } from "./settings-notifications.page"

/**
 * Объединённая страница общих настроек: внешний вид и уведомления.
 */
export function SettingsGeneralPage(): ReactElement {
    const { t } = useTranslation(["settings"])

    return (
        <Tabs
            aria-label={t("settings:general.tabsLabel", {
                defaultValue: "General settings",
            })}
            variant="secondary"
        >
            <Tabs.List>
                <Tabs.Tab id="appearance">
                    {t("settings:general.appearanceTab", {
                        defaultValue: "Appearance",
                    })}
                </Tabs.Tab>
                <Tabs.Tab id="notifications">
                    {t("settings:general.notificationsTab", {
                        defaultValue: "Notifications",
                    })}
                </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="appearance">
                <SettingsAppearancePage />
            </Tabs.Panel>
            <Tabs.Panel id="notifications">
                <SettingsNotificationsPage />
            </Tabs.Panel>
        </Tabs>
    )
}
