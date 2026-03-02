import type {ISuggestionDTO} from "./suggestion.dto"

/**
 * Suggestion payload that was discarded by filter/safeguard steps.
 */
export interface IDiscardedSuggestionDTO extends ISuggestionDTO {
    readonly discardReason: string
    readonly filterName: string
}
