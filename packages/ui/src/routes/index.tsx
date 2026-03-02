import {createFileRoute} from "@tanstack/react-router"

import {SystemHealthPage} from "@/pages/system-health.page"

/**
 * Главный route dashboard-уровня.
 */
export const Route = createFileRoute("/")({
    component: SystemHealthPage,
})
