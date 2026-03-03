
/**
 * All supported @codenautic command types.
 */
export const COMMAND_TYPES = [
    "review",
    "explain",
    "fix",
    "summary",
    "help",
    "config",
    "chat",
] as const

/**
 * Supported @codenautic command type.
 */
export type CommandType = (typeof COMMAND_TYPES)[number]

/**
 * Parsed mention command.
 */
export interface IMentionCommand {
    /**
     * Parsed command type.
     */
    readonly commandType: CommandType

    /**
     * Parsed command arguments.
     */
    readonly args: readonly string[]

    /**
     * Source comment text containing command.
     */
    readonly sourceComment: string

    /**
     * User who sent command.
     */
    readonly userId: string

    /**
     * Merge request identifier used as default chat channel.
     */
    readonly mergeRequestId: string
}

/**
 * Result of command execution.
 */
export interface ICommandResult {
    /**
     * True when command executed successfully.
     */
    readonly success: boolean

    /**
     * Human-readable response.
     */
    readonly response: string
}

/**
 * Handler contract for a single command type.
 */
export interface ICommandHandler {
    /**
     * Command type handled by this implementation.
     */
    readonly commandType: CommandType

    /**
     * Executes command and returns response.
     *
     * @param command Parsed mention command.
     * @returns Execution result.
     */
    handle(command: IMentionCommand): Promise<ICommandResult>
}
