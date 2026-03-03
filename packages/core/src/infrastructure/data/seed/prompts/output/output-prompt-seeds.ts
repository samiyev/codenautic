import {PROMPT_TEMPLATE_CATEGORY, PROMPT_TEMPLATE_TYPE} from "../../../../../domain/entities/prompt-template.entity"
import type {IPromptSeedData} from "../prompt-seed-registry"

export const OUTPUT_PROMPT_SEEDS: readonly IPromptSeedData[] = [
    {
        name: "remove-repeated-suggestions",
        category: PROMPT_TEMPLATE_CATEGORY.OUTPUT,
        type: PROMPT_TEMPLATE_TYPE.SYSTEM,
        content: "<Context>\nBelow are two lists: one contains saved suggestions from history (already applied or sent previously), and the other contains newly generated suggestions.\nYour task is to analyze each new suggestion and decide if it should be kept or discarded, based on the following rules:\n</Context>\n<DecisionRules>\n- Contradiction: If a new suggestion contradicts an existing one in the history (e.g., it suggests reverting or invalidating a previously applied suggestion), discard it.\n- Duplicate in a Different Context: If a new suggestion is similar to a saved one but applies to a different part of the code, keep it.\n- Unrelated: If a new suggestion has no relation to any saved suggestions, keep it.\n</DecisionRules>\n<OutputRequirements>\nFor each new suggestion, return a JSON object containing: - The **id** of the suggestion. - A **decision** field indicating if the suggestion should be `\"keep\"` or `\"discard\"`. - A **reason** explaining why the suggestion was kept or discarded.\nReturn in JSON format.\n</OutputRequirements>\n<OutputFormat>\n```\n{ \"suggestions\": [ { \"id\": \"<suggestion_id>\", \"decision\": \"<keep|discard>\", \"reason\": \"<clear and concise explanation>\" } ]}\n```\n</OutputFormat>\n\n<SavedSuggestions>\n```\n{{savedSuggestions}}\n```\n</SavedSuggestions>\n<NewlyGeneratedSuggestions>\n```\n{{newSuggestions}}\n```\n</NewlyGeneratedSuggestions>",
        variables: ["savedSuggestions","newSuggestions"],
    },
    {
        name: "check-suggestion-simplicity-system",
        category: PROMPT_TEMPLATE_CATEGORY.OUTPUT,
        type: PROMPT_TEMPLATE_TYPE.SYSTEM,
        content: "You are an expert code reviewer. Your task is to analyze a code suggestion and determine if it is \"simple\" and safe to apply without needing to see other files.\n\nA suggestion is considered **COMPLEX** (unsafe) if:\n- It likely requires changes in other files (e.g., changing a function signature used elsewhere).\n- It introduces new imports that might be missing or conflict.\n- It changes the behavior in a way that requires understanding the broader system architecture.\n- It is a large refactoring.\n- It is not a contiguous block of code (e.g., changes scattered across multiple line ranges).\n\nA suggestion is considered **SIMPLE** (safe) if:\n- It is a local change (e.g., renaming a local variable, fixing a typo, small logic fix within a function).\n- It relies only on existing imports or standard library imports.\n- It is self-contained within the provided code block.\n\nRespond with a JSON object:\n{\n    \"isSimple\": boolean,\n    \"reason\": \"Short explanation of why it is simple or complex\"\n}\n\nAnalyze the following suggestion:",
        variables: [],
    },
    {
        name: "check-suggestion-simplicity-user",
        category: PROMPT_TEMPLATE_CATEGORY.OUTPUT,
        type: PROMPT_TEMPLATE_TYPE.USER,
        content: "Original Code:\n```{{language}}\n{{existingCode}}\n```\n\nImproved Code:\n```{{language}}\n{{improvedCode}}\n```",
        variables: ["language","existingCode","improvedCode"],
    },
]
