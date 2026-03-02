/**
 * One stage entry inside versioned pipeline definition.
 */
export interface IPipelineDefinitionStage {
    stageId: string
    stageName: string
}

/**
 * Versioned pipeline definition used to resolve execution order.
 */
export interface IPipelineDefinition {
    definitionVersion: string
    stages: readonly IPipelineDefinitionStage[]
}
