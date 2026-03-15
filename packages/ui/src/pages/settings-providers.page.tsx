import type { ReactElement } from "react"

import { Tabs } from "@heroui/react"
import { useTranslation } from "react-i18next"

import { SettingsByokPage } from "./settings-byok.page"
import { SettingsGitProvidersPage } from "./settings-git-providers.page"
import { SettingsLlmProvidersPage } from "./settings-llm-providers.page"

/**
 * Объединённая страница провайдеров: LLM, Git и BYOK ключи.
 */
export function SettingsProvidersPage(): ReactElement {
    const { t } = useTranslation(["settings"])

    return (
        <Tabs
            aria-label={t("settings:providers.tabsLabel", {
                defaultValue: "Provider settings",
            })}
            variant="secondary"
        >
            <Tabs.List>
                <Tabs.Tab id="llm">
                    {t("settings:providers.llmTab", {
                        defaultValue: "LLM",
                    })}
                </Tabs.Tab>
                <Tabs.Tab id="git">
                    {t("settings:providers.gitTab", {
                        defaultValue: "Git",
                    })}
                </Tabs.Tab>
                <Tabs.Tab id="byok">
                    {t("settings:providers.byokTab", {
                        defaultValue: "Keys",
                    })}
                </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="llm">
                <SettingsLlmProvidersPage />
            </Tabs.Panel>
            <Tabs.Panel id="git">
                <SettingsGitProvidersPage />
            </Tabs.Panel>
            <Tabs.Panel id="byok">
                <SettingsByokPage />
            </Tabs.Panel>
        </Tabs>
    )
}
