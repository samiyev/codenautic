import type {IDomainEventBus} from "../application/ports/outbound/domain-event-bus.port"
import type {IReviewRepository} from "../application/ports/outbound/review-repository.port"
import type {IRuleRepository} from "../application/ports/outbound/rule-repository.port"
import {createToken} from "./create-token"

/**
 * Core package DI tokens.
 */
export const TOKENS = {
    Common: {
        DomainEventBus: createToken<IDomainEventBus>("core.common.domain-event-bus"),
    },
    Review: {
        Repository: createToken<IReviewRepository>("core.review.repository"),
    },
    Rule: {
        Repository: createToken<IRuleRepository>("core.rule.repository"),
    },
} as const
