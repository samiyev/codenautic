const LLM_CATEGORY_WEIGHTS: Readonly<Record<string, number>> = {
    "security": 20,
    "breaking-change": 18,
    "bug": 15,
    "architecture": 12,
    "performance": 10,
    "testing": 10,
    "maintainability": 8,
    "complexity": 8,
    "accessibility": 8,
    "best-practice": 5,
    "consistency": 5,
    "style": 3,
    "documentation": 2,
}

const CONFIG_CATEGORY_WEIGHTS: Readonly<Record<string, number>> = {
    "style-conventions": 3,
    "duplication-complexity": 8,
    "readability-refactor": 5,
    "error-handling": 12,
    "observability-logging": 3,
    "ui-robustness": 8,
    "api-conventions": 5,
    "module-architecture": 12,
    "security-hardening": 20,
    "performance-efficiency": 10,
    "maintainability": 8,
    "dependency-supply-chain": 8,
    "secrets-credentials": 20,
    "config-environment": 3,
    "ci-cd-build-hygiene": 3,
    "container-docker-hygiene": 3,
    "infra-as-code": 3,
    "monorepo-hygiene": 5,
    "pr-hygiene": 5,
    "testing-quality": 10,
    "migrations-backward-compat": 10,
    "docs-adrs": 2,
    "repo-context-files": 2,
    "external-context-mcps": 2,
    "privacy-pii": 18,
    "accessibility-a11y": 8,
    "internationalization-i18n": 5,
    "database-query-performance": 10,
    "resilience-retries-idempotency": 12,
    "concurrency-safety": 12,
    "caching-strategy": 8,
    "api-contracts-versioning": 10,
    "compliance-gdpr": 15,
    "compliance-soc2-essentials": 15,
    "compliance-pci-dss": 18,
    "compliance-hipaa": 18,
    "stack-react": 0,
    "stack-nextjs": 0,
    "stack-vue": 0,
    "stack-nodejs": 0,
    "stack-php": 0,
    "stack-python": 0,
    "stack-flutter": 0,
    "web-static-assets": 2,
    "docstring": 2,
}

/**
 * Unified category weights for ranking and sorting.
 */
export const CATEGORY_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
    ...normalizeWeights(LLM_CATEGORY_WEIGHTS),
    ...normalizeWeights(CONFIG_CATEGORY_WEIGHTS),
})

/**
 * Builds normalized category key.
 *
 * @param category Raw category label.
 * @returns Normalized category key.
 */
function normalizeCategoryKey(category: string): string {
    return category
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
}

/**
 * Normalizes weight map keys for lookup.
 *
 * @param source Raw weight map.
 * @returns Normalized weight map.
 */
function normalizeWeights(source: Readonly<Record<string, number>>): Record<string, number> {
    const normalized: Record<string, number> = {}

    for (const [key, value] of Object.entries(source)) {
        normalized[normalizeCategoryKey(key)] = value
    }

    return normalized
}
