import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"

import { Alert, Button, Card, CardContent, CardHeader, TextArea } from "@heroui/react"
import { TYPOGRAPHY } from "@/lib/constants/typography"

import type { IContractValidationState } from "../use-contract-validation-state"

/**
 * Props for the contract payload section.
 */
export interface IContractSectionProps {
    /**
     * Shared contract validation page state.
     */
    readonly state: IContractValidationState
}

/**
 * Contract payload section: textarea for raw JSON contract input,
 * validate/apply buttons, validation result display with errors,
 * migration hints and apply status.
 *
 * @param props Component props.
 * @returns The contract section element.
 */
export function ContractSection({ state }: IContractSectionProps): ReactElement {
    const { t } = useTranslation(["settings"])
    return (
        <>
            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.sectionTitle}>Contract payload</p>
                </CardHeader>
                <CardContent className="space-y-3">
                    <TextArea
                        aria-label={t("settings:ariaLabel.contractValidation.contractJson")}
                        className="min-h-[250px]"
                        value={state.rawContract}
                        onChange={(e): void => {
                            state.setRawContract(e.target.value)
                        }}
                    />
                    <div className="flex gap-2">
                        <Button variant="primary" onPress={state.handleValidateContract}>
                            Validate contract
                        </Button>
                        <Button variant="secondary" onPress={state.handleApplyContract}>
                            Apply validated contract
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.sectionTitle}>Validation result</p>
                </CardHeader>
                <CardContent className="space-y-2">
                    {state.validationResult.errors.length === 0 ? (
                        <Alert status="success">
                            <Alert.Title>Contract is valid</Alert.Title>
                            <Alert.Description>{state.previewSummary}</Alert.Description>
                        </Alert>
                    ) : (
                        <Alert status="danger">
                            <Alert.Title>Contract validation errors</Alert.Title>
                            <Alert.Description>
                                <ul
                                    aria-label={t(
                                        "settings:ariaLabel.contractValidation.contractErrorsList",
                                    )}
                                    className="space-y-1"
                                >
                                    {state.validationResult.errors.map(
                                        (error): ReactElement => (
                                            <li key={error}>{error}</li>
                                        ),
                                    )}
                                </ul>
                            </Alert.Description>
                        </Alert>
                    )}
                    {state.validationResult.migrationHints.length === 0 ? null : (
                        <Alert status="warning">
                            <Alert.Title>Migration hints</Alert.Title>
                            <Alert.Description>
                                <ul
                                    aria-label={t(
                                        "settings:ariaLabel.contractValidation.contractMigrationHintsList",
                                    )}
                                    className="space-y-1"
                                >
                                    {state.validationResult.migrationHints.map(
                                        (hint): ReactElement => (
                                            <li key={hint}>{hint}</li>
                                        ),
                                    )}
                                </ul>
                            </Alert.Description>
                        </Alert>
                    )}
                    <Alert status="accent">
                        <Alert.Title>Apply status</Alert.Title>
                        <Alert.Description>{state.lastAppliedState}</Alert.Description>
                    </Alert>
                </CardContent>
            </Card>
        </>
    )
}
