import {Entity} from "./entity"
import {OrganizationId} from "../value-objects/organization-id.value-object"
import {UniqueId} from "../value-objects/unique-id.value-object"

/**
 * Supported prompt template categories.
 */
export const PROMPT_TEMPLATE_CATEGORY = {
    RULES: "rules",
    ANALYSIS: "analysis",
    OUTPUT: "output",
    SAFEGUARD: "safeguard",
    CROSS_FILE: "cross-file",
} as const

/**
 * Prompt template category.
 */
export type PromptTemplateCategory =
    (typeof PROMPT_TEMPLATE_CATEGORY)[keyof typeof PROMPT_TEMPLATE_CATEGORY]

/**
 * Supported prompt template content types.
 */
export const PROMPT_TEMPLATE_TYPE = {
    SYSTEM: "system",
    USER: "user",
} as const

/**
 * Prompt template type.
 */
export type PromptTemplateType = (typeof PROMPT_TEMPLATE_TYPE)[keyof typeof PROMPT_TEMPLATE_TYPE]

/**
 * Template variable descriptor.
 */
export interface ITemplateVariable {
    /**
     * Variable name used in template placeholders.
     */
    readonly name: string
}

/**
 * Persistent state for prompt template entity.
 */
export interface IPromptTemplateProps {
    /**
     * Unique template name.
     */
    name: string

    /**
     * Template category.
     */
    category: PromptTemplateCategory

    /**
     * Template type.
     */
    type: PromptTemplateType

    /**
     * Template content with handlebars-like placeholders.
     */
    content: string

    /**
     * Extracted variable descriptors.
     */
    variables: readonly ITemplateVariable[]

    /**
     * Template version.
     */
    version: number

    /**
     * Indicates if template is shared globally.
     */
    isGlobal: boolean

    /**
     * Organization scope identifier, optional for global templates.
     */
    organizationId?: OrganizationId
}

/**
 * Prompt template domain entity.
 */
export class PromptTemplate extends Entity<IPromptTemplateProps> {
    /**
     * Creates prompt template entity.
     *
     * @param id Entity identifier.
     * @param props Template props.
     */
    public constructor(id: UniqueId, props: IPromptTemplateProps) {
        super(id, props)
        this.props.name = normalizeName(props.name)
        this.props.category = normalizeCategory(props.category)
        this.props.type = normalizeType(props.type)
        this.props.content = normalizeContent(props.content)
        this.props.variables = normalizeVariables(props.variables)
        this.props.version = normalizeVersion(props.version)
        this.props.isGlobal = props.isGlobal
        this.props.organizationId = normalizeOrganizationId(props.organizationId)
        this.validateState()
    }

    /**
     * Template name.
     *
     * @returns Normalized template name.
     */
    public get name(): string {
        return this.props.name
    }

    /**
     * Template category.
     *
     * @returns Category value.
     */
    public get category(): PromptTemplateCategory {
        return this.props.category
    }

    /**
     * Template type.
     *
     * @returns Type value.
     */
    public get type(): PromptTemplateType {
        return this.props.type
    }

    /**
     * Prompt content.
     *
     * @returns Template content.
     */
    public get content(): string {
        return this.props.content
    }

    /**
     * Declared variables.
     *
     * @returns Copy of template variable descriptors.
     */
    public get variables(): readonly ITemplateVariable[] {
        return [...this.props.variables]
    }

    /**
     * Template version.
     *
     * @returns Version number.
     */
    public get version(): number {
        return this.props.version
    }

    /**
     * Whether this template is global.
     *
     * @returns True for global templates.
     */
    public get isGlobal(): boolean {
        return this.props.isGlobal
    }

    /**
     * Organization identifier.
     *
     * @returns Organization id when not global.
     */
    public get organizationId(): OrganizationId | undefined {
        return this.props.organizationId
    }

    /**
     * Ensures template invariants.
     */
    private validateState(): void {
        if (this.props.isGlobal === true) {
            if (this.props.organizationId !== undefined) {
                throw new Error("Global template cannot have organizationId")
            }
            return
        }

        if (this.props.organizationId === undefined) {
            throw new Error("Non-global template must have organizationId")
        }
    }
}

/**
 * Normalizes and validates template name.
 *
 * @param value Raw name.
 * @returns Trimmed name.
 */
function normalizeName(value: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error("Prompt template name cannot be empty")
    }

    return normalized
}

/**
 * Normalizes and validates category.
 *
 * @param value Raw category.
 * @returns Normalized category.
 */
function normalizeCategory(value: string): PromptTemplateCategory {
    const normalized = value.trim().toLowerCase()

    if (Object.values(PROMPT_TEMPLATE_CATEGORY).includes(normalized as PromptTemplateCategory) === false) {
        throw new Error(`Unknown prompt template category: ${value}`)
    }

    return normalized as PromptTemplateCategory
}

/**
 * Normalizes and validates template type.
 *
 * @param value Raw type.
 * @returns Normalized template type.
 */
function normalizeType(value: string): PromptTemplateType {
    const normalized = value.trim().toLowerCase()

    if (Object.values(PROMPT_TEMPLATE_TYPE).includes(normalized as PromptTemplateType) === false) {
        throw new Error(`Unknown prompt template type: ${value}`)
    }

    return normalized as PromptTemplateType
}

/**
 * Normalizes content field.
 *
 * @param value Raw content.
 * @returns Trimmed non-empty content.
 */
function normalizeContent(value: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error("Prompt template content cannot be empty")
    }

    return normalized
}

/**
 * Normalizes version.
 *
 * @param value Raw version.
 * @returns Version number.
 */
function normalizeVersion(value: number): number {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error("Prompt template version must be a positive integer")
    }

    return value
}

/**
 * Normalizes organizationId field.
 *
 * @param value Organization identifier.
 * @returns OrganizationId value object when provided.
 */
function normalizeOrganizationId(value: OrganizationId | undefined): OrganizationId | undefined {
    if (value === undefined) {
        return undefined
    }

    return value
}

/**
 * Normalizes template variables list.
 *
 * @param variables Raw variables.
 * @returns Deduplicated normalized variables.
 */
function normalizeVariables(variables: readonly ITemplateVariable[]): readonly ITemplateVariable[] {
    const result = new Map<string, ITemplateVariable>()

    for (const variable of variables) {
        const normalizedName = variable.name.trim()
        if (normalizedName.length === 0) {
            throw new Error("Template variable name cannot be empty")
        }

        result.set(normalizedName, {name: normalizedName})
    }

    return [...result.values()]
}
