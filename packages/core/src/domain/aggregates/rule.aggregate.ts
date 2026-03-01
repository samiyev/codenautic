import {AggregateRoot} from "./aggregate-root"
import {RuleActivated} from "../events/rule-activated"
import {RuleStatusPolicyService} from "../services/rule-status-policy.service"
import {UniqueId} from "../value-objects/unique-id.value-object"

/**
 * Allowed lifecycle states for custom rules.
 */
export const RULE_STATUS = {
    DRAFT: "draft",
    ACTIVE: "active",
    INACTIVE: "inactive",
    ARCHIVED: "archived",
} as const

/**
 * Rule lifecycle status.
 */
export type RuleStatus = (typeof RULE_STATUS)[keyof typeof RULE_STATUS]

/**
 * Internal state for rule aggregate.
 */
export interface IRuleProps {
    name: string
    description: string
    expression: string
    status: RuleStatus
    activatedAt: Date | null
    deactivatedAt: Date | null
    archivedAt: Date | null
}

/**
 * Aggregate root for custom rule lifecycle.
 */
export class Rule extends AggregateRoot<IRuleProps> {
    private readonly statusPolicy: RuleStatusPolicyService

    /**
     * Creates rule aggregate.
     *
     * @param id Aggregate identifier.
     * @param props Aggregate state.
     * @param statusPolicy Transition policy service.
     */
    public constructor(id: UniqueId, props: IRuleProps, statusPolicy: RuleStatusPolicyService) {
        super(id, props)
        this.statusPolicy = statusPolicy
        this.ensureStateIsValid()
    }

    /**
     * Rule display name.
     *
     * @returns Rule name.
     */
    public get name(): string {
        return this.props.name
    }

    /**
     * Rule description.
     *
     * @returns Rule description.
     */
    public get description(): string {
        return this.props.description
    }

    /**
     * Rule expression payload.
     *
     * @returns Rule expression string.
     */
    public get expression(): string {
        return this.props.expression
    }

    /**
     * Current lifecycle status.
     *
     * @returns Rule status.
     */
    public get status(): RuleStatus {
        return this.props.status
    }

    /**
     * Activation timestamp.
     *
     * @returns Activation timestamp or null.
     */
    public get activatedAt(): Date | null {
        if (this.props.activatedAt === null) {
            return null
        }
        return new Date(this.props.activatedAt)
    }

    /**
     * Deactivation timestamp.
     *
     * @returns Deactivation timestamp or null.
     */
    public get deactivatedAt(): Date | null {
        if (this.props.deactivatedAt === null) {
            return null
        }
        return new Date(this.props.deactivatedAt)
    }

    /**
     * Archive timestamp.
     *
     * @returns Archive timestamp or null.
     */
    public get archivedAt(): Date | null {
        if (this.props.archivedAt === null) {
            return null
        }
        return new Date(this.props.archivedAt)
    }

    /**
     * Activates rule.
     *
     * @param activatedAt Activation timestamp.
     */
    public activate(activatedAt: Date): void {
        this.statusPolicy.ensureCanActivate(this.props.status)

        this.props.status = RULE_STATUS.ACTIVE
        this.props.activatedAt = new Date(activatedAt)
        this.props.deactivatedAt = null

        this.addDomainEvent(
            new RuleActivated(this.id.value, {
                ruleId: this.id.value,
                ruleName: this.props.name,
            }),
        )
    }

    /**
     * Deactivates rule.
     *
     * @param deactivatedAt Deactivation timestamp.
     */
    public deactivate(deactivatedAt: Date): void {
        this.statusPolicy.ensureCanDeactivate(this.props.status)

        this.props.status = RULE_STATUS.INACTIVE
        this.props.deactivatedAt = new Date(deactivatedAt)
    }

    /**
     * Archives rule.
     *
     * @param archivedAt Archive timestamp.
     */
    public archive(archivedAt: Date): void {
        this.statusPolicy.ensureCanArchive(this.props.status)

        this.props.status = RULE_STATUS.ARCHIVED
        this.props.archivedAt = new Date(archivedAt)
    }

    /**
     * Validates aggregate invariants.
     *
     * @throws Error when state is invalid.
     */
    private ensureStateIsValid(): void {
        this.ensureRequiredText(this.props.name, "Rule name cannot be empty")
        this.ensureRequiredText(this.props.description, "Rule description cannot be empty")
        this.ensureRequiredText(this.props.expression, "Rule expression cannot be empty")
    }

    /**
     * Validates mandatory text field.
     *
     * @param value Text value.
     * @param errorMessage Error message for invalid value.
     * @throws Error when text is empty after trim.
     */
    private ensureRequiredText(value: string, errorMessage: string): void {
        if (value.trim().length === 0) {
            throw new Error(errorMessage)
        }
    }
}
