import { http, HttpResponse, delay } from "msw"

import type { ITeam, ITeamMember } from "@/lib/api/endpoints/teams.endpoint"

import { getMockStore } from "../store/create-mock-store"
import { api, generateId } from "./handler-utils"

/**
 * MSW handlers для Teams API.
 *
 * Обрабатывают операции над командами: list, create, invite member,
 * update role, remove member, update repositories.
 * Используют TeamsCollection из mock store для хранения состояния.
 */
export const teamsHandlers = [
    /**
     * GET /teams — возвращает список всех команд.
     */
    http.get(api("/teams"), async () => {
        await delay(80)
        const store = getMockStore()
        const teams = store.teams.list()

        return HttpResponse.json({
            teams,
            total: teams.length,
        })
    }),

    /**
     * POST /teams — создаёт новую команду.
     */
    http.post(api("/teams"), async ({ request }) => {
        await delay(100)
        const store = getMockStore()
        const body = (await request.json()) as {
            readonly name: string
            readonly description: string
        }

        const team: ITeam = {
            id: generateId("team"),
            name: body.name,
            description: body.description,
            repositories: [],
            members: [],
        }

        store.teams.create(team)

        return HttpResponse.json({ team }, { status: 201 })
    }),

    /**
     * POST /teams/:teamId/members — приглашает участника в команду.
     */
    http.post(api("/teams/:teamId/members"), async ({ params, request }) => {
        await delay(80)
        const store = getMockStore()
        const teamId = params["teamId"] as string
        const body = (await request.json()) as {
            readonly email: string
            readonly role: string
        }

        const team = store.teams.getById(teamId)
        if (team === undefined) {
            return HttpResponse.json(
                { error: "Team not found", teamId },
                { status: 404 },
            )
        }

        const localPart = body.email.split("@")[0] ?? "member"
        const displayName = localPart
            .split(/[._-]/g)
            .filter((chunk: string): boolean => chunk.length > 0)
            .map(
                (chunk: string): string =>
                    `${chunk[0]?.toUpperCase() ?? ""}${chunk.slice(1)}`,
            )
            .join(" ")

        const member: ITeamMember = {
            id: generateId("member"),
            name: displayName.length > 0 ? displayName : "New Member",
            email: body.email,
            role: body.role as "admin" | "developer" | "lead" | "viewer",
        }

        store.teams.addMember(teamId, member)

        return HttpResponse.json({ member }, { status: 201 })
    }),

    /**
     * PATCH /teams/:teamId/members/:memberId — обновляет роль участника.
     */
    http.patch(api("/teams/:teamId/members/:memberId"), async ({ params, request }) => {
        await delay(60)
        const store = getMockStore()
        const teamId = params["teamId"] as string
        const memberId = params["memberId"] as string
        const body = (await request.json()) as { readonly role: string }

        const member = store.teams.updateMemberRole(
            teamId,
            memberId,
            body.role as "admin" | "developer" | "lead" | "viewer",
        )

        if (member === undefined) {
            return HttpResponse.json(
                { error: "Team or member not found", teamId, memberId },
                { status: 404 },
            )
        }

        return HttpResponse.json({ member })
    }),

    /**
     * DELETE /teams/:teamId/members/:memberId — удаляет участника из команды.
     */
    http.delete(api("/teams/:teamId/members/:memberId"), async ({ params }) => {
        await delay(60)
        const store = getMockStore()
        const teamId = params["teamId"] as string
        const memberId = params["memberId"] as string

        const removed = store.teams.removeMember(teamId, memberId)

        if (removed !== true) {
            return HttpResponse.json(
                { error: "Team or member not found", teamId, memberId },
                { status: 404 },
            )
        }

        return HttpResponse.json({ removed: true })
    }),

    /**
     * PUT /teams/:teamId/repositories — обновляет назначенные репозитории.
     */
    http.put(api("/teams/:teamId/repositories"), async ({ params, request }) => {
        await delay(80)
        const store = getMockStore()
        const teamId = params["teamId"] as string
        const body = (await request.json()) as {
            readonly repositoryIds: ReadonlyArray<string>
        }

        const team = store.teams.updateRepositories(teamId, body.repositoryIds)

        if (team === undefined) {
            return HttpResponse.json(
                { error: "Team not found", teamId },
                { status: 404 },
            )
        }

        return HttpResponse.json({ team })
    }),
]
