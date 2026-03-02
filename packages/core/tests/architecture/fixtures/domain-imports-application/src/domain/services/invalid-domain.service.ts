import {runReviewUseCase} from "../../application/use-cases/review.use-case"

export function executeDomainService(): string {
    return runReviewUseCase()
}
