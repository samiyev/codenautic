/**
 * Token usage summary DTO.
 */
export interface ITokenUsageDTO {
    readonly input: number
    readonly output: number
    readonly total: number
}

/**
 * Token usage breakdown per model.
 */
export interface ITokenUsageByModelDTO extends ITokenUsageDTO {
    readonly model: string
}

/**
 * Token usage breakdown per pipeline stage.
 */
export interface ITokenUsageByStageDTO extends ITokenUsageDTO {
    readonly stageId: string
}

/**
 * Token usage breakdown DTO for analytics and debugging views.
 */
export interface ITokenUsageBreakdownDTO {
    readonly byModel: readonly ITokenUsageByModelDTO[]
    readonly byStage: readonly ITokenUsageByStageDTO[]
}
