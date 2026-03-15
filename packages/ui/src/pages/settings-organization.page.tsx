import { type ReactElement, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
    Alert,
    Button,
    Card,
    CardContent,
    CardHeader,
    Chip,
    Input,
    Switch,
    Table,
    Tabs,
} from "@heroui/react"
import type {
    IBillingState,
    IOrgMember,
    IOrganizationProfile,
    TBillingStatus,
    TOrgMemberRole,
    TPlanName,
} from "@/lib/api/endpoints/organization.endpoint"
import { SettingsTeamPage } from "@/pages/settings-team.page"
import { NATIVE_FORM } from "@/lib/constants/spacing"
import { TYPOGRAPHY } from "@/lib/constants/typography"
import { useOrganization } from "@/lib/hooks/queries/use-organization"
import { showToastError, showToastInfo, showToastSuccess } from "@/lib/notifications/toast"

/**
 * Состояние BYOK-ключей (Bring Your Own Key).
 */
interface IByokState {
    /**
     * Ключ Git-провайдера сконфигурирован.
     */
    readonly gitProviderTokenConfigured: boolean
    /**
     * Ключ LLM-провайдера сконфигурирован.
     */
    readonly llmKeyConfigured: boolean
    /**
     * Замаскированная ссылка на ключ.
     */
    readonly maskedKeyRef: string
}

/**
 * Запись аудит-лога.
 */
interface IAuditLogEntry {
    /**
     * Идентификатор записи.
     */
    readonly id: string
    /**
     * Метка времени в читаемом формате.
     */
    readonly timestamp: string
    /**
     * Отображаемое имя актора.
     */
    readonly actor: string
    /**
     * Выполненное действие.
     */
    readonly action: string
    /**
     * Описание деталей.
     */
    readonly details: string
}

const AUDIT_LOGS_DEFAULT: ReadonlyArray<IAuditLogEntry> = [
    {
        action: "organization.profile.updated",
        actor: "Neo Anderson",
        details: "Name and timezone updated.",
        id: "audit-1",
        timestamp: "2026-03-04 10:42",
    },
    {
        action: "billing.plan.changed",
        actor: "System",
        details: "Plan switched from starter to pro.",
        id: "audit-2",
        timestamp: "2026-03-03 19:10",
    },
    {
        action: "member.role.updated",
        actor: "Trinity",
        details: "Morpheus role changed to developer.",
        id: "audit-3",
        timestamp: "2026-03-03 12:21",
    },
    {
        action: "security.byok.rotated",
        actor: "Neo Anderson",
        details: "BYOK secret rotated for LLM provider.",
        id: "audit-4",
        timestamp: "2026-03-02 08:11",
    },
]

/**
 * Определяет цвет Chip по статусу биллинга.
 *
 * @param status - Статус биллинга.
 * @returns Цвет для HeroUI Chip.
 */
function mapBillingStatusColor(
    status: TBillingStatus,
): "danger" | "success" | "warning" | "default" {
    if (status === "active") {
        return "success"
    }

    if (status === "trial") {
        return "warning"
    }

    return "danger"
}

/**
 * Определяет цвет Chip по роли участника.
 *
 * @param role - Роль участника.
 * @returns Цвет для HeroUI Chip.
 */
function mapMemberRoleColor(
    role: TOrgMemberRole,
): "danger" | "accent" | "success" | "warning" | "default" {
    if (role === "admin") {
        return "accent"
    }

    if (role === "lead") {
        return "success"
    }

    if (role === "developer") {
        return "warning"
    }

    return "default"
}

/**
 * Проверяет валидность email-адреса.
 *
 * @param value - Строка email для проверки.
 * @returns true если email валиден.
 */
function isValidInviteEmail(value: string): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())
}

/**
 * Карточка профиля организации с формой редактирования.
 *
 * @param props - Свойства компонента.
 * @returns Карточка с полями ввода и кнопкой сохранения.
 */
function OrganizationProfileCard(props: {
    readonly profile: IOrganizationProfile
    readonly onProfileChange: (nextProfile: IOrganizationProfile) => void
    readonly onSave: () => void
}): ReactElement {
    const { t } = useTranslation(["settings"])

    return (
        <Card>
            <CardHeader>
                <p className={TYPOGRAPHY.sectionTitle}>{t("settings:organization.profileTitle")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                    <Input
                        aria-label={t("settings:organization.organizationName")}
                        onChange={(e): void => {
                            props.onProfileChange({
                                ...props.profile,
                                name: e.target.value,
                            })
                        }}
                        value={props.profile.name}
                    />
                    <Input
                        aria-label={t("settings:organization.slug")}
                        onChange={(e): void => {
                            props.onProfileChange({
                                ...props.profile,
                                slug: e.target.value,
                            })
                        }}
                        value={props.profile.slug}
                    />
                    <Input
                        aria-label={t("settings:organization.timezone")}
                        onChange={(e): void => {
                            props.onProfileChange({
                                ...props.profile,
                                timezone: e.target.value,
                            })
                        }}
                        value={props.profile.timezone}
                    />
                </div>
                <div className="flex justify-end">
                    <Button variant="primary" onPress={props.onSave}>
                        {t("settings:organization.saveProfile")}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

/**
 * Карточка биллинга с планом, метриками и действиями.
 *
 * @param props - Свойства компонента.
 * @returns Карточка с данными биллинга.
 */
function BillingCard(props: {
    readonly billing: IBillingState
    readonly onPlanChange: (plan: TPlanName) => void
    readonly onRetryPayment: () => void
    readonly onConfirmCriticalAction: () => void
}): ReactElement {
    const { t } = useTranslation(["settings"])
    const seatUsagePercent = Math.round((props.billing.seatsUsed / props.billing.seatsTotal) * 100)

    return (
        <Card>
            <CardHeader className="flex items-center justify-between">
                <p className={TYPOGRAPHY.sectionTitle}>{t("settings:organization.billingTitle")}</p>
                <Chip color={mapBillingStatusColor(props.billing.status)} size="sm" variant="soft">
                    {props.billing.status}
                </Chip>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                    <p>
                        {t("settings:organization.plan")}:{" "}
                        <span className="font-semibold">{props.billing.plan}</span>
                    </p>
                    <p>
                        {t("settings:organization.renewal")}:{" "}
                        <span className="font-semibold">{props.billing.renewalAt}</span>
                    </p>
                    <p>
                        {t("settings:organization.seats")}:{" "}
                        <span className="font-semibold">
                            {props.billing.seatsUsed}/{props.billing.seatsTotal}
                        </span>{" "}
                        ({seatUsagePercent}%)
                    </p>
                    <p>
                        {t("settings:organization.paymentMethod")}:{" "}
                        <span className="font-semibold">{props.billing.paymentMethod}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        aria-label={t("settings:organization.planLabel")}
                        className={NATIVE_FORM.select}
                        id="billing-plan-select"
                        value={props.billing.plan}
                        onChange={(event): void => {
                            const plan = event.currentTarget.value
                            if (plan === "starter" || plan === "pro" || plan === "enterprise") {
                                props.onPlanChange(plan)
                            }
                        }}
                    >
                        <option value="starter">starter</option>
                        <option value="pro">pro</option>
                        <option value="enterprise">enterprise</option>
                    </select>
                    <Button onPress={props.onRetryPayment} size="sm" variant="ghost">
                        {t("settings:organization.retryPayment")}
                    </Button>
                    <Button onPress={props.onConfirmCriticalAction} size="sm" variant="danger">
                        {t("settings:organization.confirmBillingAction")}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

/**
 * Карточка участников организации с приглашением и управлением ролями.
 *
 * @param props - Свойства компонента.
 * @returns Карточка с таблицей участников.
 */
function MembersCard(props: {
    readonly members: ReadonlyArray<IOrgMember>
    readonly inviteEmail: string
    readonly inviteRole: TOrgMemberRole
    readonly onInviteEmailChange: (value: string) => void
    readonly onInviteRoleChange: (value: TOrgMemberRole) => void
    readonly onInvite: () => void
    readonly onRoleChange: (memberId: string, role: TOrgMemberRole) => void
    readonly onRemoveMember: (memberId: string) => void
}): ReactElement {
    const { t } = useTranslation(["settings"])

    return (
        <Card>
            <CardHeader>
                <p className={TYPOGRAPHY.sectionTitle}>{t("settings:organization.membersTitle")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                    <Input
                        aria-label={t("settings:organization.inviteByEmail")}
                        onChange={(e): void => {
                            props.onInviteEmailChange(e.target.value)
                        }}
                        placeholder="new.member@acme.dev"
                        value={props.inviteEmail}
                    />
                    <select
                        aria-label={t("settings:organization.role")}
                        className={NATIVE_FORM.select}
                        id="invite-role-select"
                        value={props.inviteRole}
                        onChange={(event): void => {
                            const role = event.currentTarget.value
                            if (
                                role === "viewer" ||
                                role === "developer" ||
                                role === "lead" ||
                                role === "admin"
                            ) {
                                props.onInviteRoleChange(role)
                            }
                        }}
                    >
                        <option value="viewer">viewer</option>
                        <option value="developer">developer</option>
                        <option value="lead">lead</option>
                        <option value="admin">admin</option>
                    </select>
                    <div className="flex items-end">
                        <Button variant="primary" onPress={props.onInvite}>
                            {t("settings:organization.inviteMember")}
                        </Button>
                    </div>
                </div>

                <Table>
                    <Table.ScrollContainer>
                        <Table.Content
                            aria-label={t("settings:ariaLabel.organization.membersTable")}
                        >
                            <Table.Header>
                                <Table.Column isRowHeader>
                                    {t("settings:organization.tableNameHeader")}
                                </Table.Column>
                                <Table.Column>
                                    {t("settings:organization.tableEmailHeader")}
                                </Table.Column>
                                <Table.Column>
                                    {t("settings:organization.tableRoleHeader")}
                                </Table.Column>
                                <Table.Column>
                                    {t("settings:organization.tableActionsHeader")}
                                </Table.Column>
                            </Table.Header>
                            <Table.Body>
                                {props.members.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell>
                                            {t("settings:organization.noMembersFound")}
                                        </Table.Cell>
                                        <Table.Cell>{""}</Table.Cell>
                                        <Table.Cell>{""}</Table.Cell>
                                        <Table.Cell>{""}</Table.Cell>
                                    </Table.Row>
                                ) : (
                                    props.members.map(
                                        (member): ReactElement => (
                                            <Table.Row key={member.id}>
                                                <Table.Cell>{member.name}</Table.Cell>
                                                <Table.Cell>{member.email}</Table.Cell>
                                                <Table.Cell>
                                                    <div className="flex items-center gap-2">
                                                        <Chip
                                                            color={mapMemberRoleColor(member.role)}
                                                            size="sm"
                                                            variant="soft"
                                                        >
                                                            {member.role}
                                                        </Chip>
                                                        <select
                                                            aria-label={`Role for ${member.email}`}
                                                            className={NATIVE_FORM.select}
                                                            value={member.role}
                                                            onChange={(event): void => {
                                                                const role =
                                                                    event.currentTarget.value
                                                                if (
                                                                    role === "viewer" ||
                                                                    role === "developer" ||
                                                                    role === "lead" ||
                                                                    role === "admin"
                                                                ) {
                                                                    props.onRoleChange(
                                                                        member.id,
                                                                        role,
                                                                    )
                                                                }
                                                            }}
                                                        >
                                                            <option value="viewer">viewer</option>
                                                            <option value="developer">
                                                                developer
                                                            </option>
                                                            <option value="lead">lead</option>
                                                            <option value="admin">admin</option>
                                                        </select>
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Button
                                                        onPress={(): void => {
                                                            props.onRemoveMember(member.id)
                                                        }}
                                                        size="sm"
                                                        variant="danger"
                                                    >
                                                        {t("settings:organization.remove")}
                                                    </Button>
                                                </Table.Cell>
                                            </Table.Row>
                                        ),
                                    )
                                )}
                            </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
            </CardContent>
        </Card>
    )
}

/**
 * Карточка BYOK (Bring Your Own Key) с переключателями и ротацией.
 *
 * @param props - Свойства компонента.
 * @returns Карточка с настройками BYOK.
 */
function ByokCard(props: {
    readonly byok: IByokState
    readonly onToggleGitToken: (value: boolean) => void
    readonly onToggleLlmToken: (value: boolean) => void
    readonly onRotate: () => void
}): ReactElement {
    const { t } = useTranslation(["settings"])

    return (
        <Card>
            <CardHeader>
                <p className={TYPOGRAPHY.sectionTitle}>{t("settings:organization.byokTitle")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-muted">{t("settings:organization.byokDescription")}</p>
                <div className="flex flex-wrap items-center gap-4">
                    <Switch
                        isSelected={props.byok.gitProviderTokenConfigured}
                        onChange={props.onToggleGitToken}
                    >
                        {t("settings:organization.gitProviderKeyConfigured")}
                    </Switch>
                    <Switch
                        isSelected={props.byok.llmKeyConfigured}
                        onChange={props.onToggleLlmToken}
                    >
                        {t("settings:organization.llmKeyConfigured")}
                    </Switch>
                </div>
                <p className="text-xs text-muted">
                    {t("settings:organization.activeKeyRef")}: {props.byok.maskedKeyRef}
                </p>
                <div>
                    <Button onPress={props.onRotate} size="sm" variant="ghost">
                        {t("settings:organization.rotateByokSecret")}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

/**
 * Карточка аудит-логов организации.
 *
 * @param props - Свойства компонента.
 * @returns Карточка с таблицей аудит-логов.
 */
function AuditLogsCard(props: { readonly logs: ReadonlyArray<IAuditLogEntry> }): ReactElement {
    const { t } = useTranslation(["settings"])

    return (
        <Card>
            <CardHeader>
                <p className={TYPOGRAPHY.sectionTitle}>
                    {t("settings:organization.auditLogsTitle")}
                </p>
            </CardHeader>
            <CardContent>
                <Table>
                    <Table.ScrollContainer>
                        <Table.Content
                            aria-label={t("settings:ariaLabel.organization.auditLogsTable")}
                        >
                            <Table.Header>
                                <Table.Column isRowHeader>
                                    {t("settings:organization.auditTimeHeader")}
                                </Table.Column>
                                <Table.Column>
                                    {t("settings:organization.auditActorHeader")}
                                </Table.Column>
                                <Table.Column>
                                    {t("settings:organization.auditActionHeader")}
                                </Table.Column>
                                <Table.Column>
                                    {t("settings:organization.auditDetailsHeader")}
                                </Table.Column>
                            </Table.Header>
                            <Table.Body>
                                {props.logs.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell>
                                            {t("settings:organization.noAuditEntries")}
                                        </Table.Cell>
                                        <Table.Cell>{""}</Table.Cell>
                                        <Table.Cell>{""}</Table.Cell>
                                        <Table.Cell>{""}</Table.Cell>
                                    </Table.Row>
                                ) : (
                                    props.logs.map(
                                        (log): ReactElement => (
                                            <Table.Row key={log.id}>
                                                <Table.Cell>{log.timestamp}</Table.Cell>
                                                <Table.Cell>{log.actor}</Table.Cell>
                                                <Table.Cell>{log.action}</Table.Cell>
                                                <Table.Cell>{log.details}</Table.Cell>
                                            </Table.Row>
                                        ),
                                    )
                                )}
                            </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
            </CardContent>
        </Card>
    )
}

/**
 * Страница настроек организации: профиль, billing, members, BYOK и audit logs.
 *
 * Загружает данные через API (useOrganization hook) и предоставляет
 * UI для управления профилем, биллингом и участниками.
 *
 * @returns Organization settings UI.
 */
export function SettingsOrganizationPage(): ReactElement {
    const { t } = useTranslation(["settings"])
    const {
        profileQuery,
        membersQuery,
        billingQuery,
        updateProfile,
        inviteMember,
        updateMemberRole,
        removeMember,
        updatePlan,
    } = useOrganization()

    const profile = profileQuery.data?.profile ?? {
        name: "",
        slug: "",
        timezone: "",
        domain: "",
    }
    const billing = billingQuery.data?.billing ?? {
        plan: "starter" as TPlanName,
        status: "trial" as TBillingStatus,
        seatsUsed: 0,
        seatsTotal: 0,
        renewalAt: "",
        paymentMethod: "",
    }
    const members = membersQuery.data?.members ?? []

    const [editProfile, setEditProfile] = useState<IOrganizationProfile | undefined>(undefined)
    const [inviteEmail, setInviteEmail] = useState("")
    const [inviteRole, setInviteRole] = useState<TOrgMemberRole>("viewer")
    const [byok, setByok] = useState<IByokState>({
        gitProviderTokenConfigured: true,
        llmKeyConfigured: true,
        maskedKeyRef: "byok_****a2f8",
    })
    const [billingError, setBillingError] = useState<string | undefined>(undefined)
    const auditLogs = useMemo((): ReadonlyArray<IAuditLogEntry> => AUDIT_LOGS_DEFAULT, [])

    const displayProfile = editProfile ?? profile

    const handleProfileChange = (nextProfile: IOrganizationProfile): void => {
        setEditProfile(nextProfile)
    }

    const handleSaveProfile = (): void => {
        const targetProfile = editProfile ?? profile
        if (targetProfile.name.trim().length === 0 || targetProfile.slug.trim().length === 0) {
            showToastError(t("settings:organization.toast.nameAndSlugRequired"))
            return
        }

        updateProfile.mutate(
            {
                name: targetProfile.name,
                slug: targetProfile.slug,
                timezone: targetProfile.timezone,
                domain: targetProfile.domain,
            },
            {
                onSuccess: (): void => {
                    setEditProfile(undefined)
                    showToastSuccess(t("settings:organization.toast.profileSaved"))
                },
            },
        )
    }

    const handleInviteMember = (): void => {
        const normalizedEmail = inviteEmail.trim().toLowerCase()
        if (isValidInviteEmail(normalizedEmail) === false) {
            showToastError(t("settings:organization.toast.invalidInviteEmail"))
            return
        }

        inviteMember.mutate(
            {
                email: normalizedEmail,
                role: inviteRole,
            },
            {
                onSuccess: (): void => {
                    setInviteEmail("")
                    showToastSuccess(t("settings:organization.toast.invitationSent"))
                },
            },
        )
    }

    const handleMemberRoleChange = (memberId: string, role: TOrgMemberRole): void => {
        updateMemberRole.mutate(
            { memberId, role },
            {
                onSuccess: (): void => {
                    showToastInfo(t("settings:organization.toast.memberRoleUpdated"))
                },
            },
        )
    }

    const handleRemoveMember = (memberId: string): void => {
        removeMember.mutate(
            { memberId },
            {
                onSuccess: (): void => {
                    showToastInfo(t("settings:organization.toast.memberRemoved"))
                },
            },
        )
    }

    const handlePlanChange = (plan: TPlanName): void => {
        updatePlan.mutate(
            { plan },
            {
                onSuccess: (): void => {
                    setBillingError(undefined)
                    showToastSuccess(t("settings:organization.toast.billingPlanUpdated"))
                },
            },
        )
    }

    const handleRetryPayment = (): void => {
        const shouldFail = billing.status === "past_due"
        if (shouldFail) {
            setBillingError(t("settings:organization.toast.paymentRetryFailedDetails"))
            showToastError(t("settings:organization.toast.paymentRetryFailed"))
            return
        }

        setBillingError(undefined)
        showToastSuccess(t("settings:organization.toast.paymentHealthy"))
    }

    const handleConfirmCriticalBillingAction = (): void => {
        const isConfirmed = window.confirm(
            t("settings:organization.toast.confirmCriticalBillingAction"),
        )

        if (isConfirmed !== true) {
            showToastInfo(t("settings:organization.toast.billingActionCancelled"))
            return
        }

        setBillingError(undefined)
        showToastInfo(t("settings:organization.toast.criticalBillingActionConfirmed"))
    }

    const handleByokRotate = (): void => {
        setByok(
            (previous): IByokState => ({
                ...previous,
                maskedKeyRef: `byok_****${String(Date.now()).slice(-4)}`,
            }),
        )
        showToastSuccess(t("settings:organization.toast.byokSecretRotated"))
    }

    return (
        <Tabs aria-label={t("settings:organization.tabsLabel", { defaultValue: "Organization settings" })} variant="secondary">
            <Tabs.List>
                <Tabs.Tab id="organization">{t("settings:organization.tabOrganization", { defaultValue: "Organization" })}</Tabs.Tab>
                <Tabs.Tab id="team">{t("settings:organization.tabTeam", { defaultValue: "Team" })}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel id="organization">
        <div className="space-y-6 mx-auto max-w-[1400px]"><div className="space-y-1.5"><h1 className={TYPOGRAPHY.pageTitle}>{t("settings:organization.pageTitle")}</h1><p className={TYPOGRAPHY.bodyMuted}>{t("settings:organization.pageSubtitle")}</p></div><div className="space-y-6">
            {billingError === undefined ? null : <Alert color="danger">{billingError}</Alert>}

            <OrganizationProfileCard
                onProfileChange={handleProfileChange}
                onSave={handleSaveProfile}
                profile={displayProfile}
            />
            <BillingCard
                billing={billing}
                onConfirmCriticalAction={handleConfirmCriticalBillingAction}
                onPlanChange={handlePlanChange}
                onRetryPayment={handleRetryPayment}
            />
            <MembersCard
                inviteEmail={inviteEmail}
                inviteRole={inviteRole}
                members={members}
                onInvite={handleInviteMember}
                onInviteEmailChange={setInviteEmail}
                onInviteRoleChange={setInviteRole}
                onRemoveMember={handleRemoveMember}
                onRoleChange={handleMemberRoleChange}
            />
            <ByokCard
                byok={byok}
                onRotate={handleByokRotate}
                onToggleGitToken={(value): void => {
                    setByok(
                        (previous): IByokState => ({
                            ...previous,
                            gitProviderTokenConfigured: value,
                        }),
                    )
                }}
                onToggleLlmToken={(value): void => {
                    setByok(
                        (previous): IByokState => ({
                            ...previous,
                            llmKeyConfigured: value,
                        }),
                    )
                }}
            />
            <AuditLogsCard logs={auditLogs} />
        </div></div>
            </Tabs.Panel>
            <Tabs.Panel id="team">
                <SettingsTeamPage />
            </Tabs.Panel>
        </Tabs>
    )
}
