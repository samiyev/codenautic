/**
 * Статические ресурсы переводов для всех поддерживаемых локалей и namespaces.
 * Собирает JSON-файлы из locales/ в единый объект для i18next.
 */

import enAuth from "./locales/en/auth.json"
import enCodeCity from "./locales/en/code-city.json"
import enCommon from "./locales/en/common.json"
import enDashboard from "./locales/en/dashboard.json"
import enNavigation from "./locales/en/navigation.json"
import enOnboarding from "./locales/en/onboarding.json"
import enReports from "./locales/en/reports.json"
import enReviews from "./locales/en/reviews.json"
import enSettings from "./locales/en/settings.json"
import enSystem from "./locales/en/system.json"

import ruAuth from "./locales/ru/auth.json"
import ruCodeCity from "./locales/ru/code-city.json"
import ruCommon from "./locales/ru/common.json"
import ruDashboard from "./locales/ru/dashboard.json"
import ruNavigation from "./locales/ru/navigation.json"
import ruOnboarding from "./locales/ru/onboarding.json"
import ruReports from "./locales/ru/reports.json"
import ruReviews from "./locales/ru/reviews.json"
import ruSettings from "./locales/ru/settings.json"
import ruSystem from "./locales/ru/system.json"

/**
 * Полный набор i18n ресурсов для всех локалей.
 * English — source of truth для типизации ключей.
 */
export const I18N_RESOURCES = {
    en: {
        auth: enAuth,
        "code-city": enCodeCity,
        common: enCommon,
        dashboard: enDashboard,
        navigation: enNavigation,
        onboarding: enOnboarding,
        reports: enReports,
        reviews: enReviews,
        settings: enSettings,
        system: enSystem,
    },
    ru: {
        auth: ruAuth,
        "code-city": ruCodeCity,
        common: ruCommon,
        dashboard: ruDashboard,
        navigation: ruNavigation,
        onboarding: ruOnboarding,
        reports: ruReports,
        reviews: ruReviews,
        settings: ruSettings,
        system: ruSystem,
    },
} as const

/**
 * Список всех namespaces, используемых в приложении.
 */
export const I18N_NAMESPACES = [
    "common",
    "navigation",
    "auth",
    "system",
    "dashboard",
    "reviews",
    "reports",
    "settings",
    "code-city",
    "onboarding",
] as const
