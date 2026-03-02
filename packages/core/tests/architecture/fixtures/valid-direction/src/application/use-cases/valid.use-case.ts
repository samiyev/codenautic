import {evaluateRuleName} from "../../domain/services/rule.service"

export async function executeValidUseCase(): Promise<string> {
    const dynamicRuleModule = await import("../../domain/services/rule.service")
    return `${evaluateRuleName()}:${dynamicRuleModule.evaluateRuleName()}`
}
