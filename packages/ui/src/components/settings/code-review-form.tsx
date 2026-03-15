import { type ChangeEvent, type ReactElement } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { Button, Input, ListBox, ListBoxItem, Select, Switch } from "@heroui/react"

import { FormField, type IFormSelectOption } from "@/components/forms"
import {
    CODE_REVIEW_CADENCE_OPTIONS,
    CODE_REVIEW_SEVERITY_OPTIONS,
    codeReviewFormSchema,
    type ICodeReviewFormValues,
} from "@/components/settings/settings-form-schemas"

/**
 * Параметры формы code-review.
 */
export interface ICodeReviewFormProps {
    /** Начальные значения. */
    readonly initialValues?: Partial<ICodeReviewFormValues>
    /** Сабмит формы. */
    readonly onSubmit: (values: ICodeReviewFormValues) => void
}

/**
 * Форма настроек code-review с RHF + Zod валидацией.
 *
 * @param props Конфигурация.
 * @returns Набор полей для конфигурации ревью.
 */
export function CodeReviewForm(props: ICodeReviewFormProps): ReactElement {
    const { t } = useTranslation(["settings"])

    const cadenceOptions: ReadonlyArray<IFormSelectOption> = CODE_REVIEW_CADENCE_OPTIONS.map(
        (item): IFormSelectOption => ({
            label: `${item.charAt(0).toUpperCase()}${item.slice(1)}`,
            value: item,
        }),
    )
    const severityOptions: ReadonlyArray<IFormSelectOption> = CODE_REVIEW_SEVERITY_OPTIONS.map(
        (item): IFormSelectOption => ({
            label: `${item.charAt(0).toUpperCase()}${item.slice(1)}`,
            value: item,
        }),
    )
    const form = useForm<z.input<typeof codeReviewFormSchema>, unknown, ICodeReviewFormValues>({
        defaultValues: {
            cadence: props.initialValues?.cadence ?? CODE_REVIEW_CADENCE_OPTIONS[0],
            enableDriftSignals: props.initialValues?.enableDriftSignals === true,
            severity: props.initialValues?.severity ?? CODE_REVIEW_SEVERITY_OPTIONS[1],
            suggestionsLimit: props.initialValues?.suggestionsLimit ?? 8,
        },
        resolver: zodResolver(codeReviewFormSchema),
    })
    const handleSubmit = (): void => {
        void form.handleSubmit((values: ICodeReviewFormValues): void => {
            props.onSubmit(values)
        })()
    }

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <FormField
                control={form.control}
                id="code-review-cadence"
                label={t("settings:codeReviewForm.reviewCadence")}
                name="cadence"
                renderField={({
                    field,
                    hasError,
                    fieldId,
                    accessibilityLabel,
                    ariaDescribedBy,
                }): ReactElement => {
                    const selectedKey = field.value === undefined ? null : String(field.value)

                    return (
                        <Select
                            aria-describedby={ariaDescribedBy}
                            aria-label={accessibilityLabel}
                            aria-invalid={hasError}
                            name={field.name}
                            id={fieldId}
                            selectedKey={selectedKey}
                            onSelectionChange={(key): void => {
                                const nextValue = typeof key === "string" ? key : undefined
                                field.onChange(nextValue)
                            }}
                        >
                            <Select.Trigger>
                                <Select.Value />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {cadenceOptions.map(
                                        (option): ReactElement => (
                                            <ListBoxItem
                                                key={option.value}
                                                id={option.value}
                                                textValue={option.label}
                                                isDisabled={option.isDisabled}
                                            >
                                                <div className="flex flex-col">
                                                    <span>{option.label}</span>
                                                    {option.description === undefined ? null : (
                                                        <span className="text-xs text-muted">
                                                            {option.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </ListBoxItem>
                                        ),
                                    )}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    )
                }}
            />
            <FormField
                control={form.control}
                id="code-review-severity"
                label={t("settings:codeReviewForm.severityThreshold")}
                name="severity"
                renderField={({
                    field,
                    hasError,
                    fieldId,
                    accessibilityLabel,
                    ariaDescribedBy,
                }): ReactElement => {
                    const selectedKey = field.value === undefined ? null : String(field.value)

                    return (
                        <Select
                            aria-describedby={ariaDescribedBy}
                            aria-label={accessibilityLabel}
                            aria-invalid={hasError}
                            name={field.name}
                            id={fieldId}
                            selectedKey={selectedKey}
                            onSelectionChange={(key): void => {
                                const nextValue = typeof key === "string" ? key : undefined
                                field.onChange(nextValue)
                            }}
                        >
                            <Select.Trigger>
                                <Select.Value />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {severityOptions.map(
                                        (option): ReactElement => (
                                            <ListBoxItem
                                                key={option.value}
                                                id={option.value}
                                                textValue={option.label}
                                                isDisabled={option.isDisabled}
                                            >
                                                <div className="flex flex-col">
                                                    <span>{option.label}</span>
                                                    {option.description === undefined ? null : (
                                                        <span className="text-xs text-muted">
                                                            {option.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </ListBoxItem>
                                        ),
                                    )}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    )
                }}
            />
            <FormField
                control={form.control}
                id="code-review-suggestions-limit"
                label={t("settings:codeReviewForm.suggestionsLimit")}
                name="suggestionsLimit"
                renderField={({
                    field,
                    hasError,
                    fieldId,
                    accessibilityLabel,
                    ariaDescribedBy,
                }): ReactElement => {
                    const value = field.value === undefined ? "" : `${field.value as number}`

                    return (
                        <Input
                            aria-describedby={ariaDescribedBy}
                            aria-label={accessibilityLabel}
                            aria-invalid={hasError}
                            id={fieldId}
                            inputMode="decimal"
                            min={1}
                            name={field.name}
                            placeholder={t("settings:codeReviewForm.suggestionsLimitPlaceholder")}
                            type="number"
                            value={value}
                            onBlur={field.onBlur}
                            onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                                const nextValue = event.target.value

                                if (nextValue === "") {
                                    field.onChange(undefined)
                                    return
                                }

                                const parsedNumber = Number(nextValue)
                                if (Number.isNaN(parsedNumber) === true) {
                                    field.onChange(undefined)
                                    return
                                }

                                field.onChange(parsedNumber)
                            }}
                        />
                    )
                }}
            />
            <FormField
                control={form.control}
                gapClass="gap-1"
                helperText={t("settings:codeReviewForm.enableDriftSignalsHelper")}
                hideLabel={true}
                label={t("settings:codeReviewForm.enableDriftSignals")}
                name="enableDriftSignals"
                showRequiredMarker={false}
                renderField={({
                    field,
                    hasError,
                    accessibilityLabel,
                    ariaDescribedBy,
                }): ReactElement => (
                    <Switch
                        aria-describedby={ariaDescribedBy}
                        aria-label={accessibilityLabel}
                        aria-invalid={hasError}
                        name={field.name}
                        isSelected={field.value === true}
                        onChange={field.onChange}
                    >
                        {t("settings:codeReviewForm.enableDriftSignals")}
                    </Switch>
                )}
            />
            <Button
                aria-busy={form.formState.isSubmitting}
                isDisabled={form.formState.isSubmitting}
                type="submit"
            >
                {t("settings:codeReviewForm.saveReviewConfig")}
            </Button>
        </form>
    )
}
