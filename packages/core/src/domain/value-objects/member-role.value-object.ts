/**
 * Supported member roles for organization access control.
 */
export const MEMBER_ROLE = {
    OWNER: "OWNER",
    ADMIN: "ADMIN",
    MEMBER: "MEMBER",
    VIEWER: "VIEWER",
} as const

/**
 * Literal type for member role values.
 */
export type MemberRoleValue = (typeof MEMBER_ROLE)[keyof typeof MEMBER_ROLE]

const MEMBER_ROLE_PRIORITY: Readonly<Record<MemberRoleValue, number>> = {
    [MEMBER_ROLE.OWNER]: 1,
    [MEMBER_ROLE.ADMIN]: 2,
    [MEMBER_ROLE.MEMBER]: 3,
    [MEMBER_ROLE.VIEWER]: 4,
}

/**
 * Immutable value object that models role-based access priority.
 */
export class MemberRole {
    private readonly role: MemberRoleValue

    /**
     * Creates immutable member role.
     *
     * @param role Role value.
     */
    private constructor(role: MemberRoleValue) {
        this.role = role
        Object.freeze(this)
    }

    /**
     * Creates member role from raw input.
     *
     * @param value Raw role value.
     * @returns Immutable member role.
     * @throws Error When role is unsupported.
     */
    public static create(value: string): MemberRole {
        const normalizedRole = value.trim().toUpperCase()

        if (!isMemberRoleValue(normalizedRole)) {
            throw new Error(`Unsupported member role: ${value}`)
        }

        return new MemberRole(normalizedRole)
    }

    /**
     * Numeric role priority where smaller value means higher privilege.
     *
     * @returns Role priority.
     */
    public get priority(): number {
        return MEMBER_ROLE_PRIORITY[this.role]
    }

    /**
     * Checks whether current role can satisfy required role permission.
     *
     * @param required Required minimum role.
     * @returns True when current role has equal or higher privilege.
     */
    public hasPermission(required: MemberRole): boolean {
        return this.priority <= required.priority
    }

    /**
     * Checks whether current role is strictly higher than the other role.
     *
     * @param other Another member role.
     * @returns True when current role has higher privilege.
     */
    public isHigherThan(other: MemberRole): boolean {
        return this.priority < other.priority
    }

    /**
     * Stable string representation of role value.
     *
     * @returns Role literal.
     */
    public toString(): MemberRoleValue {
        return this.role
    }
}

/**
 * Type guard for member role value.
 *
 * @param value Candidate role value.
 * @returns True when value is supported role.
 */
function isMemberRoleValue(value: string): value is MemberRoleValue {
    return Object.values(MEMBER_ROLE).includes(value as MemberRoleValue)
}
