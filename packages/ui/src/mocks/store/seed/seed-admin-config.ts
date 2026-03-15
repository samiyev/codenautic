import type { IAdminConfigSnapshot } from "@/lib/api/endpoints/admin-config.endpoint"

import type { AdminConfigCollection } from "../collections/admin-config-collection"

/**
 * Начальный снимок admin config для seed.
 */
const SEED_ADMIN_CONFIG: IAdminConfigSnapshot = {
    etag: 7,
    values: {
        ignorePaths: "dist/**,coverage/**",
        requireReviewerApproval: true,
        severityThreshold: "medium",
    },
}

/**
 * Заполняет коллекцию admin config начальным снимком.
 *
 * Загружает конфигурацию с ETag 7 и стандартными значениями.
 *
 * @param adminConfig - Коллекция admin config для заполнения.
 */
export function seedAdminConfig(adminConfig: AdminConfigCollection): void {
    adminConfig.seed({
        config: SEED_ADMIN_CONFIG,
    })
}
