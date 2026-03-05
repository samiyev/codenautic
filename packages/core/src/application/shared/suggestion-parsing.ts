import type {IToolCallDTO} from "../dto/llm/message.dto"

/**
 * Parsed JSON payload used for suggestion extraction.
 */
export type ParsedJsonPayload = Readonly<Record<string, unknown>> | readonly unknown[]

/**
 * Input payload for suggestion parsing.
 */
export interface ISuggestionParsingInput {
    /**
     * Optional raw assistant content.
     */
    readonly content?: string

    /**
     * Optional tool calls returned by the LLM provider.
     */
    readonly toolCalls?: readonly IToolCallDTO[]

    /**
     * Optional tool names to filter parsing by.
     */
    readonly toolNames?: readonly string[]
}

/**
 * Parses suggestion candidates from tool calls or raw content.
 *
 * @param input Parsing input payload.
 * @returns Parsed suggestion candidates.
 */
export function parseSuggestions(input: ISuggestionParsingInput): readonly unknown[] {
    const toolPayloads = parseFromToolCalls(input.toolCalls ?? [], input.toolNames)
    const toolSuggestions = collectSuggestions(toolPayloads)
    if (toolSuggestions.length > 0) {
        return toolSuggestions
    }

    if (input.content === undefined) {
        return []
    }

    const contentPayload = parseFromContent(input.content)
    if (contentPayload === null) {
        return []
    }

    return extractJsonArray(contentPayload)
}

/**
 * Parses tool call arguments into JSON payloads.
 *
 * @param toolCalls Tool call payloads.
 * @param toolNames Optional list of allowed tool names.
 * @returns Parsed JSON payloads.
 */
export function parseFromToolCalls(
    toolCalls: readonly IToolCallDTO[],
    toolNames?: readonly string[],
): readonly ParsedJsonPayload[] {
    if (toolCalls.length === 0) {
        return []
    }

    const normalizedNames = normalizeToolNames(toolNames)
    const allowAll = normalizedNames.length === 0
    const payloads: ParsedJsonPayload[] = []

    for (const toolCall of toolCalls) {
        if (!allowAll && normalizedNames.includes(toolCall.name) === false) {
            continue
        }

        const parsed = parseJsonPayload(toolCall.arguments)
        if (parsed === null) {
            continue
        }

        payloads.push(parsed)
    }

    return payloads
}

/**
 * Parses JSON payload from raw assistant content.
 *
 * @param content Raw assistant content.
 * @returns Parsed payload or null.
 */
export function parseFromContent(content: string): ParsedJsonPayload | null {
    return parseJsonPayload(content)
}

/**
 * Extracts suggestion arrays from parsed JSON payload.
 *
 * @param payload Parsed JSON payload.
 * @returns Suggestion candidate array.
 */
export function extractJsonArray(payload: ParsedJsonPayload): readonly unknown[] {
    if (Array.isArray(payload)) {
        return payload
    }

    const record = payload as Readonly<Record<string, unknown>>
    const suggestions = record["suggestions"]
    if (!Array.isArray(suggestions)) {
        return []
    }

    return suggestions
}

/**
 * Collects suggestion candidates from parsed payloads.
 *
 * @param payloads Parsed JSON payloads.
 * @returns Aggregated suggestion candidates.
 */
function collectSuggestions(payloads: readonly ParsedJsonPayload[]): readonly unknown[] {
    const suggestions: unknown[] = []

    for (const payload of payloads) {
        suggestions.push(...extractJsonArray(payload))
    }

    return suggestions
}

/**
 * Parses JSON payload from string content safely.
 *
 * @param content Raw JSON content.
 * @returns Parsed JSON payload or null.
 */
function parseJsonPayload(content: string): ParsedJsonPayload | null {
    const trimmed = content.trim()
    if (trimmed.length === 0) {
        return null
    }

    try {
        const parsed: unknown = JSON.parse(trimmed)
        if (!isParsedJsonPayload(parsed)) {
            return null
        }

        return parsed
    } catch {
        return null
    }
}

/**
 * Checks whether value is a parsable suggestion payload.
 *
 * @param value Candidate JSON payload.
 * @returns True when value is object or array.
 */
function isParsedJsonPayload(value: unknown): value is ParsedJsonPayload {
    if (Array.isArray(value)) {
        return true
    }

    return value !== null && typeof value === "object"
}

/**
 * Normalizes tool names for filtering.
 *
 * @param toolNames Raw tool name list.
 * @returns Normalized tool names.
 */
function normalizeToolNames(toolNames?: readonly string[]): readonly string[] {
    if (toolNames === undefined) {
        return []
    }

    const unique = new Set<string>()
    for (const toolName of toolNames) {
        const normalized = toolName.trim()
        if (normalized.length > 0) {
            unique.add(normalized)
        }
    }

    return Array.from(unique)
}
