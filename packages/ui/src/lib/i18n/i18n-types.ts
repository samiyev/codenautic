/**
 * Типизация i18n ключей через module augmentation.
 * English locale — source of truth для типов.
 */

import type enAuth from "./locales/en/auth.json"
import type enCodeCity from "./locales/en/code-city.json"
import type enCommon from "./locales/en/common.json"
import type enDashboard from "./locales/en/dashboard.json"
import type enNavigation from "./locales/en/navigation.json"
import type enOnboarding from "./locales/en/onboarding.json"
import type enReports from "./locales/en/reports.json"
import type enReviews from "./locales/en/reviews.json"
import type enSettings from "./locales/en/settings.json"
import type enSystem from "./locales/en/system.json"

declare module "i18next" {
    /**
     * Типизация ресурсов i18next.
     * Обеспечивает autocomplete и compile-time проверку ключей.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention -- i18next module augmentation requires exact interface name
    interface CustomTypeOptions {
        /** Namespace по умолчанию. */
        readonly defaultNS: "common"
        /** Карта namespace → типы ключей. */
        readonly resources: {
            readonly auth: typeof enAuth
            readonly "code-city": typeof enCodeCity
            readonly common: typeof enCommon
            readonly dashboard: typeof enDashboard
            readonly navigation: typeof enNavigation
            readonly onboarding: typeof enOnboarding
            readonly reports: typeof enReports
            readonly reviews: typeof enReviews
            readonly settings: typeof enSettings
            readonly system: typeof enSystem
        }
    }
}
