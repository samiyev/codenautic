import type {
    IBlueprintHighlightLine,
    IBlueprintNode,
    IBlueprintValidationResult,
} from "./contract-validation-types"

/**
 * Resolves the node kind for a given YAML key in blueprint context.
 *
 * @param key - The YAML key to classify.
 * @returns The blueprint node kind: layer, rule, or metadata.
 */
export function resolveBlueprintNodeKind(key: string): IBlueprintNode["kind"] {
    if (key === "layers" || key === "name" || key === "layer") {
        return "layer"
    }
    if (key === "rules" || key === "source" || key === "target" || key === "mode") {
        return "rule"
    }
    return "metadata"
}

/**
 * Parses YAML blueprint into a lightweight visual model and validates required sections.
 *
 * @param rawYaml - The raw YAML text of the blueprint.
 * @returns Validation errors and visual nodes for preview.
 */
export function parseBlueprintYaml(rawYaml: string): IBlueprintValidationResult {
    const normalizedYaml = rawYaml.replaceAll("\r\n", "\n")
    const lines = normalizedYaml.split("\n")
    const errors: Array<string> = []
    const nodes: Array<IBlueprintNode> = []
    let hasLayers = false
    let hasRules = false
    let activeSectionKind: IBlueprintNode["kind"] = "metadata"

    for (const [index, line] of lines.entries()) {
        if (line.includes("\t")) {
            errors.push(`Line ${String(index + 1)}: tabs are not allowed, use spaces.`)
            continue
        }

        const trimmedLine = line.trim()
        if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
            continue
        }

        const indentation = line.length - line.trimStart().length
        const depth = Math.max(0, Math.floor(indentation / 2))
        const isListItem = trimmedLine.startsWith("- ")
        const normalizedLine = isListItem ? trimmedLine.slice(2).trim() : trimmedLine
        const separatorIndex = normalizedLine.indexOf(":")
        if (separatorIndex <= 0) {
            if (isListItem === true && normalizedLine.length > 0) {
                nodes.push({
                    depth,
                    id: `blueprint-node-${String(index)}-item`,
                    kind: activeSectionKind,
                    label: "item",
                    value: normalizedLine,
                })
                continue
            }
            errors.push(`Line ${String(index + 1)}: expected key-value pair in YAML format.`)
            continue
        }

        const key = normalizedLine.slice(0, separatorIndex).trim()
        const value = normalizedLine.slice(separatorIndex + 1).trim()
        if (key === "layers") {
            hasLayers = true
            activeSectionKind = "layer"
        }
        if (key === "rules") {
            hasRules = true
            activeSectionKind = "rule"
        }

        nodes.push({
            depth,
            id: `blueprint-node-${String(index)}-${key}`,
            kind: resolveBlueprintNodeKind(key),
            label: key,
            value: value.length === 0 ? undefined : value,
        })
    }

    if (hasLayers === false) {
        errors.push("Blueprint must include `layers` section.")
    }
    if (hasRules === false) {
        errors.push("Blueprint must include `rules` section.")
    }

    return {
        errors,
        nodes,
    }
}

/**
 * Builds syntax highlight lines with pseudo key/value coloring for YAML editor preview.
 *
 * @param rawYaml - The raw YAML text.
 * @returns Array of highlight line descriptors for rendering.
 */
export function buildBlueprintHighlightLines(
    rawYaml: string,
): ReadonlyArray<IBlueprintHighlightLine> {
    return rawYaml
        .replaceAll("\r\n", "\n")
        .split("\n")
        .map((line, index): IBlueprintHighlightLine => {
            const indentation = line.length - line.trimStart().length
            const trimmedLine = line.trim()
            if (trimmedLine.startsWith("#")) {
                return {
                    comment: trimmedLine,
                    id: `blueprint-highlight-${String(index)}`,
                    indent: indentation,
                }
            }
            const normalizedLine = trimmedLine.startsWith("- ")
                ? trimmedLine.slice(2).trim()
                : trimmedLine
            const separatorIndex = normalizedLine.indexOf(":")
            if (separatorIndex <= 0) {
                return {
                    id: `blueprint-highlight-${String(index)}`,
                    indent: indentation,
                    value: trimmedLine,
                }
            }

            const key = normalizedLine.slice(0, separatorIndex).trim()
            const value = normalizedLine.slice(separatorIndex + 1).trim()
            return {
                id: `blueprint-highlight-${String(index)}`,
                indent: indentation,
                key,
                value,
            }
        })
}
