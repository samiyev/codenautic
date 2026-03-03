import {Expert, type IExpertProps} from "../../value-objects/prompt/expert"
import {ExpertPanel} from "../../value-objects/prompt/expert-panel"

const SAFEGUARD_PANEL_PRESET: readonly IExpertProps[] = [
    {
        name: "Edward",
        role: "VETO",
        responsibilities: [
            "Block suggestions with critical regression risk",
            "Escalate uncertain changes for manual review",
        ],
        priority: 0,
    },
    {
        name: "Alice",
        role: "Syntax",
        responsibilities: [
            "Verify syntax correctness in generated patches",
            "Reject malformed edits that break parser constraints",
        ],
        priority: 1,
    },
    {
        name: "Bob",
        role: "Logic",
        responsibilities: [
            "Validate semantic correctness of code changes",
            "Detect behavioral regressions and unsafe assumptions",
        ],
        priority: 2,
    },
    {
        name: "Charles",
        role: "Style",
        responsibilities: [
            "Check readability and maintainability conventions",
            "Ensure consistency with repository style guidelines",
        ],
        priority: 3,
    },
    {
        name: "Diana",
        role: "Referee",
        responsibilities: [
            "Resolve conflicts between expert recommendations",
            "Produce balanced final verdict for the panel output",
        ],
        priority: 4,
    },
]

const CLASSIFIER_PANEL_PRESET: readonly IExpertProps[] = [
    {
        name: "Alice",
        role: "Syntax peer-review",
        responsibilities: [
            "Classify syntax-level defects in proposed changes",
            "Mark parser and formatting violations for triage",
        ],
        priority: 0,
    },
    {
        name: "Bob",
        role: "Logic peer-review",
        responsibilities: [
            "Classify semantic and behavioral defects",
            "Identify risky control-flow and state transitions",
        ],
        priority: 1,
    },
    {
        name: "Charles",
        role: "Style peer-review",
        responsibilities: [
            "Classify maintainability and readability concerns",
            "Mark consistency issues against team conventions",
        ],
        priority: 2,
    },
]

/**
 * Creates default five-expert panel used by safeguard review flow.
 *
 * @returns Expert panel with VETO, syntax, logic, style, and referee experts.
 */
export function createSafeguardPanel(): ExpertPanel {
    return createPanelFromPreset(SAFEGUARD_PANEL_PRESET)
}

/**
 * Creates default three-expert peer-review panel used by classifier flow.
 *
 * @returns Expert panel with syntax, logic, and style reviewers.
 */
export function createClassifierPanel(): ExpertPanel {
    return createPanelFromPreset(CLASSIFIER_PANEL_PRESET)
}

/**
 * Builds immutable expert panel from static preset.
 *
 * @param preset Static expert definitions.
 * @returns Expert panel value object.
 */
function createPanelFromPreset(preset: readonly IExpertProps[]): ExpertPanel {
    const experts = preset.map((expertProps) => Expert.create(expertProps))
    return ExpertPanel.create(experts)
}
