import type { ReactElement } from "react"

import { Tabs } from "@heroui/react"
import { useTranslation } from "react-i18next"

import { SettingsConcurrencyPage } from "./settings-concurrency.page"
import { SettingsJobsPage } from "./settings-jobs.page"
import { SettingsProviderDegradationPage } from "./settings-provider-degradation.page"

/**
 * Объединённая страница операций: деградация, конкурентность и задания.
 */
export function SettingsOperationsPage(): ReactElement {
    const { t } = useTranslation(["settings"])

    return (
        <Tabs
            aria-label={t("settings:operations.tabsLabel", {
                defaultValue: "Operations settings",
            })}
            variant="secondary"
        >
            <Tabs.List>
                <Tabs.Tab id="degradation">
                    {t("settings:operations.degradationTab", {
                        defaultValue: "Health",
                    })}
                </Tabs.Tab>
                <Tabs.Tab id="concurrency">
                    {t("settings:operations.concurrencyTab", {
                        defaultValue: "Concurrency",
                    })}
                </Tabs.Tab>
                <Tabs.Tab id="jobs">
                    {t("settings:operations.jobsTab", {
                        defaultValue: "Jobs",
                    })}
                </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="degradation">
                <SettingsProviderDegradationPage />
            </Tabs.Panel>
            <Tabs.Panel id="concurrency">
                <SettingsConcurrencyPage />
            </Tabs.Panel>
            <Tabs.Panel id="jobs">
                <SettingsJobsPage />
            </Tabs.Panel>
        </Tabs>
    )
}
