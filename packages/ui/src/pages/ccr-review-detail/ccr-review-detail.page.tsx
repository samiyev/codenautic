/**
 * Страница детального просмотра CCR review.
 *
 * Оркестрирует секции: заголовок, файловое дерево, diff-просмотр, анализ.
 * Делегирует управление состоянием хуку `useCcrReviewState`,
 * а рендеринг — четырём секционным компонентам.
 */

import type { ReactElement } from "react"

import type { ICcrRowData } from "@/pages/ccr-data"
import type { ICcrWorkspaceContextResponse } from "@/lib/api/endpoints/ccr-workspace.endpoint"

import { useCcrReviewState } from "./hooks/use-ccr-review-state"
import { HeaderSection } from "./sections/header-section"
import { SidebarFilesSection } from "./sections/sidebar-files-section"
import { DiffSection } from "./sections/diff-section"
import { SidebarRightSection } from "./sections/sidebar-right-section"

/**
 * Свойства страницы детального просмотра CCR review.
 */
export interface ICcrReviewDetailPageProps {
    /**
     * Данные CCR, для которой рендерится review context.
     */
    readonly ccr: ICcrRowData
    /**
     * API-контекст review workspace (опционально).
     */
    readonly workspaceContext?: ICcrWorkspaceContextResponse
    /**
     * SSE источник для дополнительного стриминга по CCR.
     */
    readonly streamSourceUrl?: string
}

/**
 * Страница детального просмотра CCR review.
 *
 * Оркестрирует секции: заголовок с метаданными и решением,
 * файловое дерево с CodeCity mini-map, центральный diff-просмотр
 * с impact analysis и правую панель с риск-индикатором, SafeGuard trace,
 * feedback loop и чатом.
 *
 * @param props - Свойства страницы.
 * @returns Элемент страницы детального просмотра.
 */
export function CcrReviewDetailPage(props: ICcrReviewDetailPageProps): ReactElement {
    const state = useCcrReviewState({
        ccr: props.ccr,
        workspaceContext: props.workspaceContext,
    })

    return (
        <section className="space-y-4">
            <HeaderSection ccr={props.ccr} state={state} />
            <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_420px]">
                <aside className="space-y-4">
                    <SidebarFilesSection state={state} />
                </aside>
                <DiffSection
                    ccrId={props.ccr.id}
                    state={state}
                    streamSourceUrl={props.streamSourceUrl}
                />
                <aside className="min-w-0 space-y-4">
                    <SidebarRightSection ccrId={props.ccr.id} state={state} />
                </aside>
            </div>
        </section>
    )
}
