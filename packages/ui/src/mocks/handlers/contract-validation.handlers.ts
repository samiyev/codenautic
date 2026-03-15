import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import { api } from "./handler-utils"

/**
 * MSW handlers для contract validation API.
 *
 * Обрабатывают операции над blueprint, guardrails, drift-нарушениями,
 * трендом и графом архитектуры.
 * Используют ContractValidationCollection из mock store для хранения состояния.
 */
export const contractValidationHandlers = [
    /**
     * GET /settings/contract-validation/blueprint — возвращает YAML blueprint.
     */
    http.get(api("/settings/contract-validation/blueprint"), async () => {
        await delay(80)
        const store = getMockStore()
        const yaml = store.contractValidation.getBlueprint()

        return HttpResponse.json({ yaml })
    }),

    /**
     * PUT /settings/contract-validation/blueprint — обновляет YAML blueprint.
     */
    http.put(api("/settings/contract-validation/blueprint"), async ({ request }) => {
        await delay(120)
        const store = getMockStore()
        const body = (await request.json()) as { readonly yaml: string }

        store.contractValidation.updateBlueprint(body.yaml)
        return HttpResponse.json({ updated: true })
    }),

    /**
     * GET /settings/contract-validation/guardrails — возвращает YAML guardrails.
     */
    http.get(api("/settings/contract-validation/guardrails"), async () => {
        await delay(80)
        const store = getMockStore()
        const yaml = store.contractValidation.getGuardrails()

        return HttpResponse.json({ yaml })
    }),

    /**
     * PUT /settings/contract-validation/guardrails — обновляет YAML guardrails.
     */
    http.put(api("/settings/contract-validation/guardrails"), async ({ request }) => {
        await delay(120)
        const store = getMockStore()
        const body = (await request.json()) as { readonly yaml: string }

        store.contractValidation.updateGuardrails(body.yaml)
        return HttpResponse.json({ updated: true })
    }),

    /**
     * GET /settings/contract-validation/drift/violations — возвращает drift-нарушения.
     */
    http.get(api("/settings/contract-validation/drift/violations"), async () => {
        await delay(100)
        const store = getMockStore()
        const violations = store.contractValidation.listViolations()

        return HttpResponse.json({
            violations,
            total: violations.length,
        })
    }),

    /**
     * GET /settings/contract-validation/drift/trend — возвращает тренд drift-нарушений.
     */
    http.get(api("/settings/contract-validation/drift/trend"), async () => {
        await delay(80)
        const store = getMockStore()
        const points = store.contractValidation.getTrendPoints()

        return HttpResponse.json({ points })
    }),

    /**
     * GET /settings/contract-validation/architecture-graph — возвращает граф архитектуры.
     */
    http.get(api("/settings/contract-validation/architecture-graph"), async () => {
        await delay(100)
        const store = getMockStore()
        const nodes = store.contractValidation.getArchitectureNodes()
        const edges = store.contractValidation.getArchitectureEdges()

        return HttpResponse.json({ nodes, edges })
    }),
]
