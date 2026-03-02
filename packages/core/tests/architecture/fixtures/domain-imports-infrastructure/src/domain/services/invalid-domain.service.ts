import {persistReview} from "../../infrastructure/persistence/review.repository"

export function executeDomainService(): string {
    return persistReview()
}
