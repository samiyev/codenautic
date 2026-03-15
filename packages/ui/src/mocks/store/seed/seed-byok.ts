import type { IByokKeyEntry } from "@/lib/api/endpoints/byok.endpoint"

import type { ByokCollection } from "../collections/byok-collection"

/**
 * Seed-ключ: OpenAI production.
 */
const KEY_OPENAI_PROD: IByokKeyEntry = {
    id: "byok-1",
    isActive: true,
    label: "openai-prod-main",
    lastUsedAt: "2026-03-04T11:05:00Z",
    maskedSecret: "sk-p****001",
    provider: "openai",
    rotationCount: 1,
    usageRequests: 1284,
    usageTokens: 391820,
}

/**
 * Seed-ключ: Anthropic fallback.
 */
const KEY_ANTHROPIC_FALLBACK: IByokKeyEntry = {
    id: "byok-2",
    isActive: true,
    label: "anthropic-fallback",
    lastUsedAt: "2026-03-04T10:47:00Z",
    maskedSecret: "sk-a****873",
    provider: "anthropic",
    rotationCount: 2,
    usageRequests: 402,
    usageTokens: 116240,
}

/**
 * Seed-ключ: GitHub staging.
 */
const KEY_GITHUB_STAGING: IByokKeyEntry = {
    id: "byok-3",
    isActive: false,
    label: "github-staging-ci",
    lastUsedAt: "2026-02-28T08:12:00Z",
    maskedSecret: "ghp_****xyz",
    provider: "github",
    rotationCount: 0,
    usageRequests: 78,
    usageTokens: 0,
}

/**
 * Начальный набор BYOK ключей.
 */
const SEED_BYOK_KEYS: ReadonlyArray<IByokKeyEntry> = [
    KEY_OPENAI_PROD,
    KEY_ANTHROPIC_FALLBACK,
    KEY_GITHUB_STAGING,
]

/**
 * Заполняет byok-коллекцию начальным набором данных.
 *
 * Загружает 3 ключа с метаданными использования.
 *
 * @param byok - Коллекция BYOK для заполнения.
 */
export function seedByok(byok: ByokCollection): void {
    byok.seed(SEED_BYOK_KEYS)
}
