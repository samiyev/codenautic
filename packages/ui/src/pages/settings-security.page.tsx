import type { ReactElement } from "react"

import { Tabs } from "@heroui/react"
import { useTranslation } from "react-i18next"

import { SettingsAuditLogsPage } from "./settings-audit-logs.page"
import { SettingsPrivacyRedactionPage } from "./settings-privacy-redaction.page"
import { SettingsSsoPage } from "./settings-sso.page"

/**
 * Объединённая страница безопасности: приватность, SSO и аудит.
 */
export function SettingsSecurityPage(): ReactElement {
    const { t } = useTranslation(["settings"])

    return (
        <Tabs
            aria-label={t("settings:security.tabsLabel", {
                defaultValue: "Security settings",
            })}
            variant="secondary"
        >
            <Tabs.List>
                <Tabs.Tab id="privacy">
                    {t("settings:security.privacyTab", {
                        defaultValue: "Privacy",
                    })}
                </Tabs.Tab>
                <Tabs.Tab id="sso">
                    {t("settings:security.ssoTab", {
                        defaultValue: "SSO",
                    })}
                </Tabs.Tab>
                <Tabs.Tab id="audit">
                    {t("settings:security.auditTab", {
                        defaultValue: "Audit Logs",
                    })}
                </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="privacy">
                <SettingsPrivacyRedactionPage />
            </Tabs.Panel>
            <Tabs.Panel id="sso">
                <SettingsSsoPage />
            </Tabs.Panel>
            <Tabs.Panel id="audit">
                <SettingsAuditLogsPage />
            </Tabs.Panel>
        </Tabs>
    )
}
