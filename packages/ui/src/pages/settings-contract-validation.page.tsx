import { type ReactElement, useMemo, useState } from "react"

import { Alert, Button, Card, CardBody, CardHeader, Textarea } from "@/components/ui"
import { showToastError, showToastInfo, showToastSuccess } from "@/lib/notifications/toast"

type TContractType = "rules-library" | "theme-library"

interface IContractEnvelope {
    readonly schema: string
    readonly version: number
    readonly type: TContractType
    readonly payload: unknown
}

interface IValidationResult {
    readonly errors: ReadonlyArray<string>
    readonly migrationHints: ReadonlyArray<string>
    readonly normalizedEnvelope?: IContractEnvelope
}

const SUPPORTED_SCHEMA = "codenautic.contract.v1"
const SUPPORTED_VERSIONS: ReadonlyArray<number> = [1, 2]

function parseContractEnvelope(rawValue: string): IValidationResult {
    let parsedValue: unknown
    try {
        parsedValue = JSON.parse(rawValue)
    } catch (_error: unknown) {
        return {
            errors: ["Invalid JSON format. Provide a valid JSON object."],
            migrationHints: [],
        }
    }

    if (typeof parsedValue !== "object" || parsedValue === null) {
        return {
            errors: ["Contract root must be an object envelope."],
            migrationHints: [],
        }
    }

    const candidate = parsedValue as {
        readonly schema?: unknown
        readonly version?: unknown
        readonly type?: unknown
        readonly payload?: unknown
    }

    const errors: Array<string> = []
    const migrationHints: Array<string> = []

    if (candidate.schema !== SUPPORTED_SCHEMA) {
        errors.push(`Unsupported schema. Expected "${SUPPORTED_SCHEMA}".`)
    }

    if (typeof candidate.version !== "number") {
        errors.push("Version is required and must be a number.")
    } else if (SUPPORTED_VERSIONS.includes(candidate.version) !== true) {
        errors.push(`Version ${String(candidate.version)} is not supported.`)
    }

    if (candidate.type !== "theme-library" && candidate.type !== "rules-library") {
        errors.push('Type must be either "theme-library" or "rules-library".')
    }

    if (candidate.payload === undefined) {
        errors.push("Payload is required.")
    }

    if (
        errors.length === 0
        && typeof candidate.version === "number"
        && candidate.version === 1
    ) {
        migrationHints.push(
            "Version 1 contract is accepted with migration. Add explicit `metadata` block for v2.",
        )
    }

    if (errors.length > 0) {
        return {
            errors,
            migrationHints,
        }
    }

    return {
        errors: [],
        migrationHints,
        normalizedEnvelope: {
            payload: candidate.payload,
            schema: candidate.schema as string,
            type: candidate.type as TContractType,
            version: candidate.version as number,
        },
    }
}

/**
 * Экран import/export contract validation.
 *
 * @returns Validation, migration hints и preview before apply.
 */
export function SettingsContractValidationPage(): ReactElement {
    const [rawContract, setRawContract] = useState(
        JSON.stringify(
            {
                payload: {
                    items: [
                        {
                            id: "theme-1",
                            name: "Security Focus",
                        },
                    ],
                },
                schema: SUPPORTED_SCHEMA,
                type: "theme-library",
                version: 1,
            },
            null,
            2,
        ),
    )
    const [lastAppliedState, setLastAppliedState] = useState("No contract applied yet.")
    const [validationResult, setValidationResult] = useState<IValidationResult>({
        errors: [],
        migrationHints: [],
    })

    const previewSummary = useMemo((): string => {
        const envelope = validationResult.normalizedEnvelope
        if (envelope === undefined) {
            return "No preview available."
        }

        const payloadString = JSON.stringify(envelope.payload)
        return `${envelope.type} v${String(envelope.version)} · payload size ${String(
            payloadString.length,
        )} chars`
    }, [validationResult.normalizedEnvelope])

    const handleValidateContract = (): void => {
        const nextResult = parseContractEnvelope(rawContract)
        setValidationResult(nextResult)

        if (nextResult.errors.length > 0) {
            showToastError("Contract validation failed.")
            return
        }

        showToastSuccess("Contract validation passed.")
    }

    const handleApplyContract = (): void => {
        const envelope = validationResult.normalizedEnvelope
        if (envelope === undefined) {
            setLastAppliedState("Apply blocked: validate contract first.")
            showToastError("Contract apply blocked.")
            return
        }

        setLastAppliedState(
            `Applied ${envelope.type} contract v${String(
                envelope.version,
            )} with deterministic preview.`,
        )
        showToastInfo("Contract applied.")
    }

    return (
        <section className="space-y-4">
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Contract validation</h1>
            <p className="text-sm text-[var(--foreground)]/70">
                Validate schema/version for import/export payloads and preview before apply.
            </p>

            <Card>
                <CardHeader>
                    <p className="text-base font-semibold text-[var(--foreground)]">Contract payload</p>
                </CardHeader>
                <CardBody className="space-y-3">
                    <Textarea
                        aria-label="Contract json"
                        minRows={10}
                        value={rawContract}
                        onValueChange={setRawContract}
                    />
                    <div className="flex gap-2">
                        <Button onPress={handleValidateContract}>Validate contract</Button>
                        <Button variant="flat" onPress={handleApplyContract}>
                            Apply validated contract
                        </Button>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-base font-semibold text-[var(--foreground)]">Validation result</p>
                </CardHeader>
                <CardBody className="space-y-2">
                    {validationResult.errors.length === 0 ? (
                        <Alert color="success" title="Contract is valid" variant="flat">
                            {previewSummary}
                        </Alert>
                    ) : (
                        <Alert color="danger" title="Contract validation errors" variant="flat">
                            <ul aria-label="Contract errors list" className="space-y-1">
                                {validationResult.errors.map((error): ReactElement => (
                                    <li key={error}>{error}</li>
                                ))}
                            </ul>
                        </Alert>
                    )}
                    {validationResult.migrationHints.length === 0 ? null : (
                        <Alert color="warning" title="Migration hints" variant="flat">
                            <ul aria-label="Contract migration hints list" className="space-y-1">
                                {validationResult.migrationHints.map((hint): ReactElement => (
                                    <li key={hint}>{hint}</li>
                                ))}
                            </ul>
                        </Alert>
                    )}
                    <Alert color="primary" title="Apply status" variant="flat">
                        {lastAppliedState}
                    </Alert>
                </CardBody>
            </Card>
        </section>
    )
}
