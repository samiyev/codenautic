import {RepositoryId} from "../value-objects/repository-id.value-object"
import {UniqueId} from "../value-objects/unique-id.value-object"
import {Entity} from "./entity"

/**
 * Team state container.
 */
export interface ITeamProps {
    name: string
    organizationId: UniqueId
    memberIds: UniqueId[]
    repoIds: RepositoryId[]
    ruleIds: UniqueId[]
    disabledRuleUuids: UniqueId[]
}

/**
 * Domain team entity.
 */
export class Team extends Entity<ITeamProps> {
    /**
     * Creates team entity.
     *
     * @param id Entity identifier.
     * @param props Entity props.
     */
    public constructor(id: UniqueId, props: ITeamProps) {
        super(id, props)
        this.props.name = normalizeName(props.name)
        this.props.memberIds = normalizeMembers(props.memberIds)
        this.props.repoIds = normalizeRepoIds(props.repoIds)
        this.props.ruleIds = normalizeRuleIds(props.ruleIds)
        this.props.disabledRuleUuids = normalizeRuleIds(props.disabledRuleUuids)
        this.ensureStateIsValid()
    }

    /**
     * Team name.
     *
     * @returns Normalized team name.
     */
    public get name(): string {
        return this.props.name
    }

    /**
     * Owning organization identifier.
     *
     * @returns Organization id.
     */
    public get organizationId(): UniqueId {
        return this.props.organizationId
    }

    /**
     * Current team member identifiers.
     *
     * @returns Copy of member ids.
     */
    public get memberIds(): readonly UniqueId[] {
        return [...this.props.memberIds]
    }

    /**
     * Repositories assigned to team.
     *
     * @returns Copy of repository ids.
     */
    public get repoIds(): readonly RepositoryId[] {
        return [...this.props.repoIds]
    }

    /**
     * Repository rule identifiers scoped by team.
     *
     * @returns Copy of rule ids.
     */
    public get ruleIds(): readonly UniqueId[] {
        return [...this.props.ruleIds]
    }

    /**
     * Rule uuids disabled on this team.
     *
     * @returns Copy of disabled rule uuids.
     */
    public get disabledRuleUuids(): readonly UniqueId[] {
        return [...this.props.disabledRuleUuids]
    }

    /**
     * Adds new member identifier.
     *
     * @param userId User identifier.
     */
    public addMember(userId: UniqueId): void {
        if (this.hasMember(userId)) {
            throw new Error(`Member ${userId.value} already exists`)
        }

        this.props.memberIds = [...this.props.memberIds, userId]
    }

    /**
     * Removes existing member identifier.
     *
     * @param userId User identifier.
     */
    public removeMember(userId: UniqueId): void {
        const filteredMembers = this.props.memberIds.filter(
            (memberId) => memberId.value !== userId.value,
        )
        if (filteredMembers.length === this.props.memberIds.length) {
            throw new Error(`Member ${userId.value} does not exist`)
        }
        this.props.memberIds = filteredMembers
    }

    /**
     * Adds repository identifier to team.
     *
     * @param repoId Repository identifier.
     */
    public assignRepo(repoId: RepositoryId): void {
        if (this.hasRepo(repoId)) {
            throw new Error(`Repository ${repoId.toString()} already assigned`)
        }

        this.props.repoIds = [...this.props.repoIds, repoId]
    }

    /**
     * Checks whether repository is assigned.
     *
     * @param repoId Repository identifier.
     * @returns True when repository is linked to team.
     */
    public hasMember(userId: UniqueId): boolean {
        return this.props.memberIds.some((memberId) => memberId.value === userId.value)
    }

    /**
     * Disables a rule for this team.
     *
     * @param ruleId Rule identifier.
     */
    public disableRule(ruleId: UniqueId): void {
        if (this.hasRule(this.props.disabledRuleUuids, ruleId) === true) {
            return
        }

        this.props.disabledRuleUuids = [...this.props.disabledRuleUuids, ruleId]
    }

    /**
     * Re-enables a previously disabled rule for this team.
     *
     * @param ruleId Rule identifier.
     */
    public enableRule(ruleId: UniqueId): void {
        this.props.disabledRuleUuids = this.props.disabledRuleUuids.filter((item) => {
            return item.value !== ruleId.value
        })
    }

    /**
     * Checks whether provided identifier exists in given collection.
     *
     * @param ruleIds Collection of rule identifiers.
     * @param ruleId Identifier to lookup.
     * @returns True when identifier is present.
     */
    private hasRule(ruleIds: readonly UniqueId[], ruleId: UniqueId): boolean {
        return ruleIds.some((item) => item.value === ruleId.value)
    }

    /**
     * Checks whether repository is assigned.
     *
     * @param repoId Repository identifier.
     * @returns True when repository is linked.
     */
    private hasRepo(repoId: RepositoryId): boolean {
        return this.props.repoIds.some((item) => item.toString() === repoId.toString())
    }

    /**
     * Validates invariant state.
     *
     * @throws Error when organizationId missing.
     */
    private ensureStateIsValid(): void {
        if (this.props.organizationId === undefined) {
            throw new Error("Team organizationId must be defined")
        }
    }
}

/**
 * Normalizes team name.
 *
 * @param name Team name.
 * @returns Normalized non-empty name.
 */
function normalizeName(name: string): string {
    const normalizedName = name.trim()
    if (normalizedName.length === 0) {
        throw new Error("Team name cannot be empty")
    }
    return normalizedName
}

/**
 * Normalizes and deduplicates member identifiers.
 *
 * @param memberIds Raw member ids.
 * @returns Unique member ids.
 */
function normalizeMembers(memberIds: readonly UniqueId[]): UniqueId[] {
    const uniqueMemberIds = new Map<string, UniqueId>()

    for (const memberId of memberIds) {
        if (memberId === undefined) {
            throw new Error("Member id cannot be empty")
        }
        uniqueMemberIds.set(memberId.value, memberId)
    }

    return [...uniqueMemberIds.values()]
}

/**
 * Normalizes and deduplicates repository identifiers.
 *
 * @param repoIds Raw repository ids.
 * @returns Unique repository ids.
 */
function normalizeRepoIds(repoIds: readonly RepositoryId[]): RepositoryId[] {
    const uniqueRepos = new Map<string, RepositoryId>()

    for (const repoId of repoIds) {
        if (repoId === undefined) {
            throw new Error("Repo id cannot be empty")
        }
        uniqueRepos.set(repoId.toString(), repoId)
    }

    return [...uniqueRepos.values()]
}

/**
 * Normalizes and deduplicates rule identifiers.
 *
 * @param ruleIds Raw rule ids.
 * @returns Unique rule ids.
 */
function normalizeRuleIds(ruleIds: readonly UniqueId[]): UniqueId[] {
    const uniqueRuleIds = new Map<string, UniqueId>()

    for (const ruleId of ruleIds) {
        if (ruleId === undefined) {
            throw new Error("Rule id cannot be empty")
        }
        uniqueRuleIds.set(ruleId.value, ruleId)
    }

    return [...uniqueRuleIds.values()]
}
