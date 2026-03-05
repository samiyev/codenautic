import { type ChangeEvent, type ReactElement, useMemo, useState } from "react"

import { Alert, Button, Card, CardBody, CardHeader } from "@/components/ui"
import { showToastInfo, showToastSuccess } from "@/lib/notifications/toast"

type TScheduleFormat = "pdf" | "png" | "html"

/**
 * Диалог настройки расписания доставки отчётов.
 *
 * @returns UI c recipients, cron, format и preview schedule.
 */
export function ReportScheduleDialog(): ReactElement {
    const [isOpen, setIsOpen] = useState<boolean>(false)
    const [recipients, setRecipients] = useState<string>("team@codenautic.app")
    const [cronExpression, setCronExpression] = useState<string>("0 9 * * 1")
    const [format, setFormat] = useState<TScheduleFormat>("pdf")
    const [status, setStatus] = useState<string>("No scheduled delivery configured yet.")

    const schedulePreview = useMemo((): string => {
        const normalizedRecipients = recipients.trim().length === 0 ? "no recipients" : recipients.trim()
        return `Cron: ${cronExpression} · Recipients: ${normalizedRecipients} · Format: ${format.toUpperCase()}`
    }, [cronExpression, format, recipients])

    const handleRecipientsChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setRecipients(event.currentTarget.value)
    }
    const handleCronChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setCronExpression(event.currentTarget.value)
    }
    const handleSaveSchedule = (): void => {
        setStatus(`Scheduled delivery saved (${format.toUpperCase()}) for cron "${cronExpression}".`)
        showToastSuccess("Report schedule saved.")
    }

    return (
        <Card>
            <CardHeader>
                <p className="text-base font-semibold text-[var(--foreground)]">Report schedule</p>
            </CardHeader>
            <CardBody className="space-y-3">
                <div className="flex gap-2">
                    <Button
                        onPress={(): void => {
                            setIsOpen(true)
                            showToastInfo("Schedule dialog opened.")
                        }}
                    >
                        Open schedule dialog
                    </Button>
                </div>
                {isOpen === false ? null : (
                    <div
                        aria-label="Report schedule dialog"
                        className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3"
                        role="dialog"
                    >
                        <label className="space-y-1 text-sm">
                            <span className="font-semibold text-[var(--foreground)]">Recipients</span>
                            <input
                                aria-label="Schedule recipients"
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                                type="text"
                                value={recipients}
                                onChange={handleRecipientsChange}
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="font-semibold text-[var(--foreground)]">Cron expression</span>
                            <input
                                aria-label="Schedule cron expression"
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                                type="text"
                                value={cronExpression}
                                onChange={handleCronChange}
                            />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="font-semibold text-[var(--foreground)]">Delivery format</span>
                            <select
                                aria-label="Schedule format"
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                                value={format}
                                onChange={(event): void => {
                                    const nextValue = event.currentTarget.value
                                    if (nextValue === "pdf" || nextValue === "png" || nextValue === "html") {
                                        setFormat(nextValue)
                                    }
                                }}
                            >
                                <option value="pdf">pdf</option>
                                <option value="png">png</option>
                                <option value="html">html</option>
                            </select>
                        </label>
                        <Alert color="primary" title="Schedule preview" variant="flat">
                            <span aria-label="Schedule preview value">{schedulePreview}</span>
                        </Alert>
                        <div className="flex gap-2">
                            <Button onPress={handleSaveSchedule}>Save schedule</Button>
                            <Button
                                variant="flat"
                                onPress={(): void => {
                                    setIsOpen(false)
                                }}
                            >
                                Close dialog
                            </Button>
                        </div>
                    </div>
                )}
                <Alert color="primary" title="Schedule status" variant="flat">
                    {status}
                </Alert>
            </CardBody>
        </Card>
    )
}
