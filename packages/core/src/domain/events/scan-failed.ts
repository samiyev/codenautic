import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Scan phase enum for lifecycle events.
 */
export const SCAN_PHASE = {
    FILE_DISCOVERY: "FILE_DISCOVERY",
    FILE_PARSING: "FILE_PARSING",
    GRAPH_BUILDING: "GRAPH_BUILDING",
    METRICS_COMPUTATION: "METRICS_COMPUTATION",
    FINALIZATION: "FINALIZATION",
} as const

/**
 * Scan phase literal type.
 */
export type ScanPhase = (typeof SCAN_PHASE)[keyof typeof SCAN_PHASE]

/**
 * Scan failed lifecycle payload.
 */
export interface IScanFailedPayload extends DomainEventPayload {
    readonly repositoryId: string
    readonly scanId: string
    readonly errorMessage: string
    readonly phase: ScanPhase
}

/**
 * Event emitted when scan failed.
 */
export class ScanFailed extends BaseDomainEvent<IScanFailedPayload> {
    /**
     * Creates ScanFailed event.
     *
     * @param aggregateId Repository aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Event timestamp.
     */
    public constructor(aggregateId: string, payload: IScanFailedPayload, occurredAt?: Date) {
        super(aggregateId, payload, occurredAt)
    }

    /**
     * Resolves event name.
     *
     * @returns Event name literal.
     */
    protected resolveEventName(): string {
        return "ScanFailed"
    }
}
