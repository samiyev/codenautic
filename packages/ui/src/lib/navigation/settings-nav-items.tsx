import type { ReactElement } from "react"
import type { TFunction } from "i18next"
import type { LinkProps } from "@tanstack/react-router"
import {
    Activity,
    Bot,
    Building2,
    CreditCard,
    GitPullRequest,
    Link2,
    Paintbrush,
    Settings,
    Shield,
    SlidersHorizontal,
} from "@/components/icons/app-icons"

/**
 * Single settings navigation item.
 */
export interface ISettingsNavItem {
    /** Display label for the item. */
    readonly label: string
    /** Route path for the item. */
    readonly to: LinkProps["to"]
    /** Icon element rendered alongside the label. */
    readonly icon: ReactElement
}

/**
 * Logical group of settings navigation items.
 */
export interface ISettingsNavGroup {
    /** Unique group identifier. */
    readonly key: string
    /** Display label for the group. */
    readonly label: string
    /** Short description shown on the overview page. */
    readonly description: string
    /** Icon element for the group header. */
    readonly icon: ReactElement
    /** Navigation items within this group. */
    readonly items: ReadonlyArray<ISettingsNavItem>
}

/**
 * Создаёт сгруппированные navigation items для settings с переведёнными метками.
 *
 * @param t Функция перевода из react-i18next.
 * @returns 4 группы, 9 items total.
 */
export function createSettingsNavGroups(
    t: TFunction<ReadonlyArray<"navigation">>,
): ReadonlyArray<ISettingsNavGroup> {
    return [
        {
            key: "configuration",
            label: t("navigation:settingsGroup.configuration"),
            description: t("navigation:settingsGroup.configurationDescription"),
            icon: <SlidersHorizontal aria-hidden="true" size={20} />,
            items: [
                {
                    label: t("navigation:settingsItem.general"),
                    to: "/settings-general",
                    icon: <Paintbrush aria-hidden="true" size={16} />,
                },
                {
                    label: t("navigation:settingsItem.codeReview"),
                    to: "/settings-code-review",
                    icon: <GitPullRequest aria-hidden="true" size={16} />,
                },
                {
                    label: t("navigation:settingsItem.contractValidation"),
                    to: "/settings-contract-validation",
                    icon: <Settings aria-hidden="true" size={16} />,
                },
            ],
        },
        {
            key: "providers",
            label: t("navigation:settingsGroup.providers"),
            description: t("navigation:settingsGroup.providersDescription"),
            icon: <Bot aria-hidden="true" size={20} />,
            items: [
                {
                    label: t("navigation:settingsItem.providers"),
                    to: "/settings-providers",
                    icon: <Bot aria-hidden="true" size={16} />,
                },
                {
                    label: t("navigation:settingsItem.integrations"),
                    to: "/settings-integrations",
                    icon: <Link2 aria-hidden="true" size={16} />,
                },
            ],
        },
        {
            key: "security",
            label: t("navigation:settingsGroup.securityCompliance"),
            description: t("navigation:settingsGroup.securityComplianceDescription"),
            icon: <Shield aria-hidden="true" size={20} />,
            items: [
                {
                    label: t("navigation:settingsItem.security"),
                    to: "/settings-security",
                    icon: <Shield aria-hidden="true" size={16} />,
                },
                {
                    label: t("navigation:settingsItem.operations"),
                    to: "/settings-operations",
                    icon: <Activity aria-hidden="true" size={16} />,
                },
            ],
        },
        {
            key: "organization",
            label: t("navigation:settingsGroup.organization"),
            description: t("navigation:settingsGroup.organizationDescription"),
            icon: <Building2 aria-hidden="true" size={20} />,
            items: [
                {
                    label: t("navigation:settingsItem.billing"),
                    to: "/settings-billing",
                    icon: <CreditCard aria-hidden="true" size={16} />,
                },
                {
                    label: t("navigation:settingsItem.organization"),
                    to: "/settings-organization",
                    icon: <Building2 aria-hidden="true" size={16} />,
                },
            ],
        },
    ]
}

/**
 * Создаёт плоский список всех settings navigation items — используется sidebar nav.
 *
 * @param t Функция перевода из react-i18next.
 * @returns Flat list of settings items.
 */
export function createSettingsNavItems(
    t: TFunction<ReadonlyArray<"navigation">>,
): ReadonlyArray<ISettingsNavItem> {
    return createSettingsNavGroups(t).flatMap(
        (group): ReadonlyArray<ISettingsNavItem> => group.items,
    )
}
