import type { Meta, StoryObj } from "@storybook/react"

import type { ICommandPaletteRouteOption } from "./command-palette"
import type { IHeaderOrganizationOption } from "./header"
import type { IBreadcrumbSegment } from "@/lib/navigation/route-guard-map"
import { Header } from "./header"

const meta: Meta<typeof Header> = {
    title: "Layout/Header",
    component: Header,
}

export default meta

type TStory = StoryObj<typeof Header>

const MOCK_ORGANIZATIONS: ReadonlyArray<IHeaderOrganizationOption> = [
    { id: "org-1", label: "Acme Corp" },
    { id: "org-2", label: "Globex Inc" },
    { id: "org-3", label: "Initech" },
]

const MOCK_COMMAND_PALETTE_ROUTES: ReadonlyArray<ICommandPaletteRouteOption> = [
    { label: "Dashboard", path: "/" },
    { label: "CCR Management", path: "/reviews" },
    { label: "Issues", path: "/issues" },
    { label: "Repositories", path: "/repositories" },
    { label: "Settings", path: "/settings" },
    { label: "Reports", path: "/reports" },
]

const MOCK_SETTINGS_BREADCRUMBS: ReadonlyArray<IBreadcrumbSegment> = [
    { label: "Settings", path: "/settings" },
    { label: "Privacy Export" },
]

const MOCK_DEEP_BREADCRUMBS: ReadonlyArray<IBreadcrumbSegment> = [
    { label: "Dashboard", path: "/" },
    { label: "Reports", path: "/reports" },
    { label: "Generator" },
]

export const Default: TStory = {
    args: {
        userName: "Alex Petrov",
        userEmail: "alex@codenautic.com",
        notificationCount: 3,
        breadcrumbs: MOCK_SETTINGS_BREADCRUMBS,
        organizations: MOCK_ORGANIZATIONS,
        activeOrganizationId: "org-1",
        commandPaletteRoutes: MOCK_COMMAND_PALETTE_ROUTES,
    },
}

export const Minimal: TStory = {
    args: {
        userName: "Guest",
    },
}

export const DeepBreadcrumbs: TStory = {
    args: {
        userName: "Maria Ivanova",
        userEmail: "maria@codenautic.com",
        breadcrumbs: MOCK_DEEP_BREADCRUMBS,
        notificationCount: 0,
        organizations: MOCK_ORGANIZATIONS,
        activeOrganizationId: "org-2",
        commandPaletteRoutes: MOCK_COMMAND_PALETTE_ROUTES,
    },
}

export const WithNotifications: TStory = {
    args: {
        userName: "Maria Ivanova",
        breadcrumbs: [
            { label: "Dashboard", path: "/" },
            { label: "Reviews" },
        ],
        notificationCount: 12,
    },
}
