/**
 * Условная загрузка mock-данных dashboard.
 * В production-сборке модуль не включается в бандл благодаря dynamic import + DEV guard.
 *
 * @returns Модуль с mock-функциями dashboard.
 */
export async function loadDashboardMockData(): Promise<
    typeof import("@/pages/dashboard-mock-data")
> {
    if (!import.meta.env.DEV) {
        throw new Error("Mock data is only available in development mode.")
    }

    return import("@/pages/dashboard-mock-data")
}
