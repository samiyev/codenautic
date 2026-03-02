import type {IRuntimeLogger} from "../review-worker/ports/runtime-logger.port"
import type {IOutboxRelayRepository} from "./ports/outbox-relay-repository.port"
import type {IOutboxTopicPublisher} from "./ports/outbox-topic-publisher.port"
import {
    OUTBOX_RECORD_STATUS,
    OUTBOX_RELAY_RESULT_STATUS,
    type IOutboxRecord,
    type IOutboxRelayResult,
    type IOutboxRelayRetryPolicy,
} from "./outbox-relay.types"

/**
 * Consumer that relays domain events from outbox storage to messaging topics.
 */
export class OutboxRelayConsumer {
    private readonly repository: IOutboxRelayRepository
    private readonly publisher: IOutboxTopicPublisher
    private readonly logger: IRuntimeLogger
    private readonly retryPolicy: IOutboxRelayRetryPolicy

    /**
     * Creates outbox relay consumer.
     *
     * @param repository Outbox repository dependency.
     * @param publisher Topic publisher dependency.
     * @param logger Structured logger dependency.
     * @param retryPolicy Retry policy configuration.
     */
    public constructor(
        repository: IOutboxRelayRepository,
        publisher: IOutboxTopicPublisher,
        logger: IRuntimeLogger,
        retryPolicy: IOutboxRelayRetryPolicy,
    ) {
        this.ensureRetryPolicy(retryPolicy)

        this.repository = repository
        this.publisher = publisher
        this.logger = logger
        this.retryPolicy = retryPolicy
    }

    /**
     * Consumes one outbox message by id.
     *
     * @param messageId Outbox message identifier.
     * @returns Consumer execution result.
     */
    public async consume(messageId: string): Promise<IOutboxRelayResult> {
        await this.logger.info("Consuming outbox relay message", {
            messageId,
        })

        const record = await this.repository.findById(messageId)
        if (record === null) {
            await this.logger.warn("Outbox message does not exist", {
                messageId,
            })

            return {
                messageId,
                status: OUTBOX_RELAY_RESULT_STATUS.MISSING,
                attempts: 0,
            }
        }

        if (record.status === OUTBOX_RECORD_STATUS.SENT) {
            await this.logger.debug("Outbox message already sent", {
                messageId,
                attempts: record.attempts,
            })

            return {
                messageId,
                status: OUTBOX_RELAY_RESULT_STATUS.ALREADY_SENT,
                attempts: record.attempts,
            }
        }

        if (record.status === OUTBOX_RECORD_STATUS.FAILED) {
            await this.logger.warn("Outbox message already failed", {
                messageId,
                attempts: record.attempts,
                errorMessage: record.lastError,
            })

            return {
                messageId,
                status: OUTBOX_RELAY_RESULT_STATUS.FAILED,
                attempts: record.attempts,
                errorMessage: record.lastError ?? undefined,
            }
        }

        return this.publishWithRetry(record)
    }

    /**
     * Publishes pending outbox record with bounded retry policy.
     *
     * @param record Pending outbox record.
     * @returns Consumer execution result.
     */
    private async publishWithRetry(record: IOutboxRecord): Promise<IOutboxRelayResult> {
        if (record.attempts >= this.retryPolicy.maxAttempts) {
            const errorMessage = record.lastError ?? "retry limit reached"
            await this.repository.markFailed(record.id, record.attempts, errorMessage)
            await this.logger.error("Outbox message exceeded retry limit", {
                messageId: record.id,
                attempts: record.attempts,
                errorMessage,
            })

            return {
                messageId: record.id,
                status: OUTBOX_RELAY_RESULT_STATUS.FAILED,
                attempts: record.attempts,
                errorMessage,
            }
        }

        let attempts = record.attempts

        while (attempts < this.retryPolicy.maxAttempts) {
            attempts += 1

            try {
                await this.publisher.publish(record.topic, record.payload, {
                    messageId: record.id,
                })
                await this.repository.markSent(record.id, attempts, new Date())
                await this.logger.info("Outbox message relayed", {
                    messageId: record.id,
                    attempts,
                    topic: record.topic,
                })

                return {
                    messageId: record.id,
                    status: OUTBOX_RELAY_RESULT_STATUS.SENT,
                    attempts,
                }
            } catch (error: unknown) {
                const errorMessage = toErrorMessage(error)
                if (attempts < this.retryPolicy.maxAttempts) {
                    await this.repository.markPendingRetry(record.id, attempts, errorMessage)
                    await this.logger.warn("Outbox publish failed, retry scheduled", {
                        messageId: record.id,
                        attempts,
                        maxAttempts: this.retryPolicy.maxAttempts,
                        errorMessage,
                    })
                    continue
                }

                await this.repository.markFailed(record.id, attempts, errorMessage)
                await this.logger.error("Outbox publish failed permanently", {
                    messageId: record.id,
                    attempts,
                    errorMessage,
                })

                return {
                    messageId: record.id,
                    status: OUTBOX_RELAY_RESULT_STATUS.FAILED,
                    attempts,
                    errorMessage,
                }
            }
        }

        const fallbackErrorMessage = "retry loop terminated unexpectedly"
        await this.repository.markFailed(record.id, attempts, fallbackErrorMessage)

        return {
            messageId: record.id,
            status: OUTBOX_RELAY_RESULT_STATUS.FAILED,
            attempts,
            errorMessage: fallbackErrorMessage,
        }
    }

    /**
     * Validates retry policy invariants.
     *
     * @param retryPolicy Retry policy object.
     * @throws Error When retry policy is invalid.
     */
    private ensureRetryPolicy(retryPolicy: IOutboxRelayRetryPolicy): void {
        if (!Number.isInteger(retryPolicy.maxAttempts) || retryPolicy.maxAttempts <= 0) {
            throw new Error("maxAttempts must be a positive integer")
        }
    }
}

/**
 * Converts unknown failure into safe string for persistence and logs.
 *
 * @param error Unknown error value.
 * @returns Error message string.
 */
function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return String(error)
}
