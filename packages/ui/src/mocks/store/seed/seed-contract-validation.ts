import type {
    IArchitectureEdge,
    IArchitectureNode,
    IDriftTrendPoint,
    IDriftViolation,
} from "@/lib/api/endpoints/contract-validation.endpoint"

import type { ContractValidationCollection } from "../collections/contract-validation-collection"

/**
 * YAML-содержимое blueprint для seed-данных.
 */
const SEED_BLUEPRINT_YAML = [
    "version: 1",
    "layers:",
    "  - name: domain",
    "    allow:",
    "      - domain",
    "  - name: application",
    "    allow:",
    "      - domain",
    "      - application",
    "rules:",
    "  - source: infrastructure",
    "    target: domain",
    "    mode: forbid",
].join("\n")

/**
 * YAML-содержимое guardrails для seed-данных.
 */
const SEED_GUARDRAILS_YAML = [
    "rules:",
    "  - source: domain",
    "    target: infrastructure",
    "    mode: forbid",
    "  - source: application",
    "    target: infrastructure",
    "    mode: allow",
    "  - source: infrastructure",
    "    target: domain",
    "    mode: forbid",
].join("\n")

/**
 * Начальный набор drift-нарушений для seed-данных.
 */
const SEED_VIOLATIONS: ReadonlyArray<IDriftViolation> = [
    {
        id: "drift-v-001",
        filePath: "src/infrastructure/http/review.controller.ts",
        layer: "infrastructure",
        rule: "Layer violation: infrastructure imports domain directly",
        severity: "high",
        detectedAt: "2026-03-10T14:22:00.000Z",
        description:
            "Controller layer imports aggregate directly, bypassing application use case.",
    },
    {
        id: "drift-v-002",
        filePath: "src/application/use-cases/review-merge-request.use-case.ts",
        layer: "application",
        rule: "Dependency cycle between application and infrastructure",
        severity: "critical",
        detectedAt: "2026-03-09T09:15:00.000Z",
        description:
            "Mutual dependency chain creates cycle between application and infrastructure.",
    },
    {
        id: "drift-v-003",
        filePath: "src/domain/entities/review.ts",
        layer: "domain",
        rule: "Domain events missing in aggregate state transitions",
        severity: "medium",
        detectedAt: "2026-03-08T11:45:00.000Z",
        description:
            "Rule requires explicit domain events but several state transitions are silent.",
    },
    {
        id: "drift-v-004",
        filePath: "src/adapters/git/gitlab-client.ts",
        layer: "adapters",
        rule: "Naming drift in adapter boundary",
        severity: "low",
        detectedAt: "2026-03-07T16:30:00.000Z",
        description:
            "Adapter naming is inconsistent with anti-corruption layer naming convention.",
    },
    {
        id: "drift-v-005",
        filePath: "src/infrastructure/repository/review.repository.ts",
        layer: "infrastructure",
        rule: "Repository leaks domain logic into query layer",
        severity: "high",
        detectedAt: "2026-03-06T08:10:00.000Z",
        description:
            "Repository implementation contains business rule filtering that belongs in domain service.",
    },
]

/**
 * Начальный набор точек тренда drift-нарушений для seed-данных.
 */
const SEED_TREND_POINTS: ReadonlyArray<IDriftTrendPoint> = [
    { date: "2026-01-01", violations: 12, resolved: 3 },
    { date: "2026-01-15", violations: 10, resolved: 5 },
    { date: "2026-02-01", violations: 8, resolved: 6 },
    { date: "2026-02-15", violations: 9, resolved: 7 },
    { date: "2026-03-01", violations: 6, resolved: 8 },
    { date: "2026-03-15", violations: 5, resolved: 9 },
]

/**
 * Начальный набор узлов графа архитектуры для seed-данных.
 */
const SEED_ARCHITECTURE_NODES: ReadonlyArray<IArchitectureNode> = [
    { id: "node-domain", label: "Domain", type: "layer", layer: "domain" },
    { id: "node-application", label: "Application", type: "layer", layer: "application" },
    { id: "node-infrastructure", label: "Infrastructure", type: "layer", layer: "infrastructure" },
    { id: "node-adapters", label: "Adapters", type: "layer", layer: "adapters" },
    { id: "node-review-entity", label: "Review Entity", type: "module", layer: "domain" },
    { id: "node-review-usecase", label: "Review UseCase", type: "module", layer: "application" },
    {
        id: "node-review-controller",
        label: "Review Controller",
        type: "module",
        layer: "infrastructure",
    },
]

/**
 * Начальный набор рёбер графа архитектуры для seed-данных.
 */
const SEED_ARCHITECTURE_EDGES: ReadonlyArray<IArchitectureEdge> = [
    { source: "node-review-controller", target: "node-review-usecase" },
    { source: "node-review-usecase", target: "node-review-entity" },
    { source: "node-review-controller", target: "node-review-entity" },
]

/**
 * Заполняет contract validation коллекцию начальным набором данных.
 *
 * @param collection - Коллекция contract validation для заполнения.
 */
export function seedContractValidation(collection: ContractValidationCollection): void {
    collection.seed({
        blueprintYaml: SEED_BLUEPRINT_YAML,
        guardrailsYaml: SEED_GUARDRAILS_YAML,
        violations: SEED_VIOLATIONS,
        trendPoints: SEED_TREND_POINTS,
        architectureNodes: SEED_ARCHITECTURE_NODES,
        architectureEdges: SEED_ARCHITECTURE_EDGES,
    })
}
