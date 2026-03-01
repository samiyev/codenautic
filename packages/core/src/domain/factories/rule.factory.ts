import {RULE_STATUS, Rule, type IRuleProps, type RuleStatus} from "../aggregates/rule.aggregate"
import {RuleStatusPolicyService} from "../services/rule-status-policy.service"
import {UniqueId} from "../value-objects/unique-id.value-object"
import {type IEntityFactory} from "./entity-factory.interface"

/**
 * Payload for creating new rule aggregate.
 */
export interface ICreateRuleProps {
    name: string
    description: string
    expression: string
}

/**
 * Persistence snapshot for rule reconstitution.
 */
export interface IReconstituteRuleProps {
    id: string
    name: string
    description: string
    expression: string
    status: RuleStatus
    activatedAt: Date | string | null
    deactivatedAt: Date | string | null
    archivedAt: Date | string | null
}

/**
 * Factory for rule aggregate creation and restoration.
 */
export class RuleFactory implements IEntityFactory<Rule, ICreateRuleProps, IReconstituteRuleProps> {
    private readonly statusPolicy: RuleStatusPolicyService

    /**
     * Creates factory instance.
     */
    public constructor() {
        this.statusPolicy = new RuleStatusPolicyService()
    }

    /**
     * Creates new rule in draft state.
     *
     * @param input New rule payload.
     * @returns New rule aggregate.
     */
    public create(input: ICreateRuleProps): Rule {
        const props: IRuleProps = {
            name: input.name,
            description: input.description,
            expression: input.expression,
            status: RULE_STATUS.DRAFT,
            activatedAt: null,
            deactivatedAt: null,
            archivedAt: null,
        }

        return new Rule(UniqueId.create(), props, this.statusPolicy)
    }

    /**
     * Restores rule from persistence state.
     *
     * @param input Persistence snapshot.
     * @returns Restored rule aggregate.
     */
    public reconstitute(input: IReconstituteRuleProps): Rule {
        const props: IRuleProps = {
            name: input.name,
            description: input.description,
            expression: input.expression,
            status: input.status,
            activatedAt: this.parseDate(input.activatedAt),
            deactivatedAt: this.parseDate(input.deactivatedAt),
            archivedAt: this.parseDate(input.archivedAt),
        }

        return new Rule(UniqueId.create(input.id), props, this.statusPolicy)
    }

    /**
     * Parses persisted date value.
     *
     * @param value Persisted date value.
     * @returns Parsed date or null.
     */
    private parseDate(value: Date | string | null): Date | null {
        if (value === null) {
            return null
        }
        if (value instanceof Date) {
            return new Date(value)
        }
        return new Date(value)
    }
}
