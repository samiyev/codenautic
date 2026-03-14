import type { Meta, StoryObj } from "@storybook/react"

import type { ITeamActivityPoint } from "./team-activity-widget"
import { TeamActivityWidget } from "./team-activity-widget"

const meta: Meta<typeof TeamActivityWidget> = {
    title: "Dashboard/TeamActivityWidget",
    component: TeamActivityWidget,
}

export default meta

type TStory = StoryObj<typeof TeamActivityWidget>

const TEAM_POINTS: ReadonlyArray<ITeamActivityPoint> = [
    { developer: "Neo", ccrMerged: 24 },
    { developer: "Trinity", ccrMerged: 18 },
    { developer: "Morpheus", ccrMerged: 31 },
    { developer: "Niobe", ccrMerged: 12 },
    { developer: "Tank", ccrMerged: 27 },
]

export const Default: TStory = {
    args: {
        points: TEAM_POINTS,
    },
}

export const Empty: TStory = {
    args: {
        points: [],
    },
}
