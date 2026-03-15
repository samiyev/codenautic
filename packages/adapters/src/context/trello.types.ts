import type {ITrelloCard} from "@codenautic/core"

/**
 * Normalized Trello context payload.
 */
export interface ITrelloContextData {
    /**
     * Trello card details.
     */
    readonly card: ITrelloCard

    /**
     * Optional normalized list name.
     */
    readonly listName?: string

    /**
     * Optional normalized labels.
     */
    readonly labels?: readonly string[]
}
