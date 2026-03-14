import { type ReactElement } from "react"
import { useTranslation } from "react-i18next"

import { Button, Chip, Select, SelectItem, Slider, Tooltip } from "@/components/ui"

/**
 * Свойства карточки управления колонкой таблицы.
 */
export interface IColumnCardProps {
    /** Уникальный идентификатор колонки. */
    readonly columnId: string
    /** Заголовок колонки. */
    readonly header: string
    /** Индекс колонки в порядке отображения. */
    readonly index: number
    /** Общее количество колонок. */
    readonly totalColumns: number
    /** Видима ли колонка. */
    readonly isVisible: boolean
    /** Можно ли скрыть колонку. */
    readonly canHide: boolean
    /** Закреплена ли колонка и с какой стороны. */
    readonly pinnedSide: "left" | "right" | false
    /** Текущая ширина колонки в пикселях. */
    readonly currentWidth: number
    /** Callback переключения видимости. */
    readonly onToggleVisibility: () => void
    /** Callback перемещения колонки влево. */
    readonly onMoveLeft: () => void
    /** Callback перемещения колонки вправо. */
    readonly onMoveRight: () => void
    /** Callback изменения закрепления. */
    readonly onPinChange: (pin: "left" | "right" | false) => void
    /** Callback мгновенного изменения ширины (визуальный feedback). */
    readonly onWidthChange: (width: number) => void
    /** Callback завершения изменения ширины (commit). */
    readonly onWidthChangeEnd: (width: number) => void
}

/**
 * Форматирует значение ширины колонки для отображения.
 *
 * @param value Ширина в пикселях.
 * @returns Строка вида "200px".
 */
function formatWidthOutput(value: number): string {
    return `${String(value)}px`
}

/**
 * Карточка управления отдельной колонкой enterprise-таблицы.
 *
 * Содержит: toggle visibility, move left/right, pin select, width slider.
 * Использует HeroUI компоненты для accessibility и единого дизайна.
 *
 * @param props Свойства карточки колонки.
 * @returns Карточка с элементами управления колонкой.
 */
export function ColumnCard(props: IColumnCardProps): ReactElement {
    const { t } = useTranslation(["common"])

    const cardOpacity = props.isVisible ? "" : "opacity-50"
    const pinValue = props.pinnedSide === false ? "none" : props.pinnedSide

    return (
        <div className={`w-56 rounded-lg border border-border bg-surface px-3 py-2 ${cardOpacity}`}>
            <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em]">
                    {props.header}
                </p>
                {props.isVisible === false ? (
                    <Chip color="default" size="sm" variant="flat">
                        {t("common:dataTable.columnHidden")}
                    </Chip>
                ) : null}
                {props.pinnedSide === "left" ? (
                    <Chip color="primary" size="sm" variant="flat">
                        {t("common:dataTable.columnPinnedLeft")}
                    </Chip>
                ) : null}
                {props.pinnedSide === "right" ? (
                    <Chip color="primary" size="sm" variant="flat">
                        {t("common:dataTable.columnPinnedRight")}
                    </Chip>
                ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
                {props.canHide ? (
                    <Button
                        aria-label={
                            props.isVisible
                                ? t("common:dataTable.hideColumnAriaLabel", { column: props.header })
                                : t("common:dataTable.showColumnAriaLabel", { column: props.header })
                        }
                        size="sm"
                        variant="flat"
                        onPress={props.onToggleVisibility}
                    >
                        {props.isVisible
                            ? t("common:dataTable.hide")
                            : t("common:dataTable.show")}
                    </Button>
                ) : null}
                <Tooltip>
                    <Button
                        aria-label={t("common:dataTable.moveLeft")}
                        isDisabled={props.index === 0}
                        size="sm"

                        variant="flat"
                        onPress={props.onMoveLeft}
                    >
                        ←
                    </Button>
                </Tooltip>
                <Tooltip>
                    <Button
                        aria-label={t("common:dataTable.moveRight")}
                        isDisabled={props.index === props.totalColumns - 1}
                        size="sm"
                        variant="flat"
                        onPress={props.onMoveRight}
                    >
                        →
                    </Button>
                </Tooltip>
                <Select
                    aria-label={t("common:dataTable.pinColumnAriaLabel", { column: props.header })}
                    className="w-36"
                    selectedKeys={new Set([pinValue])}
                    size="sm"
                    onSelectionChange={(keys): void => {
                        if (keys === "all") {
                            return
                        }
                        const selected = keys.values().next()
                        if (selected.done === true) {
                            return
                        }
                        const nextValue = String(selected.value)
                        if (nextValue === "left" || nextValue === "right") {
                            props.onPinChange(nextValue)
                            return
                        }
                        props.onPinChange(false)
                    }}
                >
                    <SelectItem value="none">{t("common:dataTable.pinNone")}</SelectItem>
                    <SelectItem value="left">{t("common:dataTable.pinLeft")}</SelectItem>
                    <SelectItem value="right">{t("common:dataTable.pinRight")}</SelectItem>
                </Select>
            </div>
            <Slider
                aria-label={t("common:dataTable.columnWidth") + ` ${props.header}`}
                className="mt-2"
                formatOutput={formatWidthOutput}
                maxValue={420}
                minValue={120}
                onChange={props.onWidthChange}
                onChangeEnd={props.onWidthChangeEnd}
                showOutput={true}
                step={10}
                value={props.currentWidth}
            />
        </div>
    )
}
