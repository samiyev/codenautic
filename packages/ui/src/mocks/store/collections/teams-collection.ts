import type { ITeam, ITeamMember } from "@/lib/api/endpoints/teams.endpoint"

/**
 * Данные для seed-инициализации TeamsCollection.
 */
export interface ITeamsSeedData {
    /**
     * Начальный набор команд.
     */
    readonly teams: ReadonlyArray<ITeam>
}

/**
 * Коллекция команд для mock API.
 *
 * Хранит in-memory данные команд с участниками и назначенными репозиториями.
 * Поддерживает CRUD, seed и clear.
 */
export class TeamsCollection {
    /**
     * Хранилище команд по ID.
     */
    private teams: Map<string, ITeam> = new Map()

    /**
     * Возвращает список всех команд.
     *
     * @returns Массив всех команд.
     */
    public list(): ReadonlyArray<ITeam> {
        return Array.from(this.teams.values())
    }

    /**
     * Возвращает команду по идентификатору.
     *
     * @param id - Идентификатор команды.
     * @returns Команда или undefined, если не найдена.
     */
    public getById(id: string): ITeam | undefined {
        return this.teams.get(id)
    }

    /**
     * Создаёт новую команду.
     *
     * @param team - Данные новой команды.
     */
    public create(team: ITeam): void {
        this.teams.set(team.id, team)
    }

    /**
     * Обновляет существующую команду.
     *
     * @param id - Идентификатор команды.
     * @param patch - Частичные данные для обновления.
     * @returns Обновлённая команда или undefined, если не найдена.
     */
    public update(id: string, patch: Partial<ITeam>): ITeam | undefined {
        const existing = this.teams.get(id)
        if (existing === undefined) {
            return undefined
        }

        const updated: ITeam = {
            ...existing,
            ...patch,
            id: existing.id,
        }

        this.teams.set(id, updated)
        return updated
    }

    /**
     * Добавляет участника в команду.
     *
     * @param teamId - Идентификатор команды.
     * @param member - Данные нового участника.
     * @returns Обновлённая команда или undefined, если команда не найдена.
     */
    public addMember(teamId: string, member: ITeamMember): ITeam | undefined {
        const team = this.teams.get(teamId)
        if (team === undefined) {
            return undefined
        }

        const updated: ITeam = {
            ...team,
            members: [...team.members, member],
        }

        this.teams.set(teamId, updated)
        return updated
    }

    /**
     * Обновляет роль участника в команде.
     *
     * @param teamId - Идентификатор команды.
     * @param memberId - Идентификатор участника.
     * @param role - Новая роль.
     * @returns Обновлённый участник или undefined, если не найден.
     */
    public updateMemberRole(
        teamId: string,
        memberId: string,
        role: ITeamMember["role"],
    ): ITeamMember | undefined {
        const team = this.teams.get(teamId)
        if (team === undefined) {
            return undefined
        }

        let updatedMember: ITeamMember | undefined

        const updatedMembers = team.members.map((member): ITeamMember => {
            if (member.id !== memberId) {
                return member
            }
            updatedMember = { ...member, role }
            return updatedMember
        })

        if (updatedMember === undefined) {
            return undefined
        }

        this.teams.set(teamId, { ...team, members: updatedMembers })
        return updatedMember
    }

    /**
     * Удаляет участника из команды.
     *
     * @param teamId - Идентификатор команды.
     * @param memberId - Идентификатор участника.
     * @returns true если участник был удалён, false иначе.
     */
    public removeMember(teamId: string, memberId: string): boolean {
        const team = this.teams.get(teamId)
        if (team === undefined) {
            return false
        }

        const initialLength = team.members.length
        const filteredMembers = team.members.filter(
            (member): boolean => member.id !== memberId,
        )

        if (filteredMembers.length === initialLength) {
            return false
        }

        this.teams.set(teamId, { ...team, members: filteredMembers })
        return true
    }

    /**
     * Обновляет назначенные репозитории команды.
     *
     * @param teamId - Идентификатор команды.
     * @param repositoryIds - Новый набор репозиториев.
     * @returns Обновлённая команда или undefined, если не найдена.
     */
    public updateRepositories(
        teamId: string,
        repositoryIds: ReadonlyArray<string>,
    ): ITeam | undefined {
        const team = this.teams.get(teamId)
        if (team === undefined) {
            return undefined
        }

        const updated: ITeam = {
            ...team,
            repositories: repositoryIds,
        }

        this.teams.set(teamId, updated)
        return updated
    }

    /**
     * Заполняет коллекцию начальными данными.
     *
     * Очищает текущее состояние и загружает переданные данные.
     *
     * @param data - Данные для seed-инициализации.
     */
    public seed(data: ITeamsSeedData): void {
        this.clear()

        for (const team of data.teams) {
            this.teams.set(team.id, team)
        }
    }

    /**
     * Полностью очищает коллекцию.
     */
    public clear(): void {
        this.teams.clear()
    }
}
