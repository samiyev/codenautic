import type { OrganizationCollection } from "../collections/organization-collection"

/**
 * Заполняет organization-коллекцию начальным набором данных.
 *
 * Загружает профиль организации, биллинг и 3 участников.
 *
 * @param organization - Коллекция организации для заполнения.
 */
export function seedOrganization(organization: OrganizationCollection): void {
    organization.seed({
        profile: {
            name: "Acme Platform",
            slug: "acme-platform",
            timezone: "UTC+05:00",
            domain: "acme.dev",
        },
        billing: {
            plan: "pro",
            status: "active",
            seatsUsed: 18,
            seatsTotal: 30,
            renewalAt: "2026-04-01",
            paymentMethod: "Visa **** 8891",
        },
        members: [
            {
                id: "member-1",
                name: "Neo Anderson",
                email: "neo@acme.dev",
                role: "admin",
            },
            {
                id: "member-2",
                name: "Trinity",
                email: "trinity@acme.dev",
                role: "lead",
            },
            {
                id: "member-3",
                name: "Morpheus",
                email: "morpheus@acme.dev",
                role: "developer",
            },
        ],
    })
}
