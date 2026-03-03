import { type ReactElement, useMemo } from "react"
import { Background, Controls, MiniMap, type Edge, ReactFlow, type Node } from "@xyflow/react"

import "@xyflow/react/dist/style.css"

import {
    calculateGraphLayout,
    type IGraphEdge,
    type IGraphLayoutOptions,
    type IGraphNode,
} from "./xyflow-graph-layout"

/** Параметры визуального рендера XYFlow. */
interface IXYFlowGraphRendererProps {
    /** Входные ноды для графа. */
    readonly nodes: ReadonlyArray<IGraphNode>
    /** Входные рёбра для графа. */
    readonly edges: ReadonlyArray<IGraphEdge>
    /** Аргументы автолэйаута. */
    readonly layoutOptions?: IGraphLayoutOptions
    /** Показывать ли миникарту. */
    readonly showMiniMap?: boolean
    /** Показывать ли панель управления. */
    readonly showControls?: boolean
    /** Разрешить перетаскивание узлов. */
    readonly nodesDraggable?: boolean
    /** Автоматически подогнать масштаб под содержимое. */
    readonly fitView?: boolean
    /** aria-label для контейнера графа. */
    readonly ariaLabel?: string
    /** Высота графа. */
    readonly height: string
}

/** Реальный рендерер графа на базе `@xyflow/react`. */
export function XYFlowGraphRenderer(props: IXYFlowGraphRendererProps): ReactElement {
    const {
        fitView = true,
        nodesDraggable = false,
        showControls = true,
        showMiniMap = false,
    } = props

    const layoutedNodes = useMemo(
        () => calculateGraphLayout(props.nodes, props.edges, props.layoutOptions),
        [props.edges, props.layoutOptions, props.nodes],
    )

    const reactFlowNodes = useMemo((): Array<Node<IGraphNode>> => {
        return layoutedNodes.map((node): Node<IGraphNode> => {
            return {
                id: node.id,
                data: node,
                position: node.position,
                draggable: nodesDraggable,
                style: {
                    width: `${node.width}px`,
                    height: `${node.height}px`,
                    padding: 8,
                    borderRadius: 12,
                    border: "1px solid hsl(var(--nextui-colors-defaultBorder))",
                    backgroundColor: "hsl(var(--nextui-colors-content1))",
                    color: "hsl(var(--nextui-colors-foreground))",
                },
                type: "default",
                sourcePosition: "right",
                targetPosition: "left",
            }
        })
    }, [layoutedNodes, nodesDraggable])

    const reactFlowEdges = useMemo((): Array<Edge<IGraphEdge>> => {
        return props.edges.map((edge): Edge<IGraphEdge> => {
            const id = edge.id ?? `${edge.source}-${edge.target}`
            return {
                id,
                source: edge.source,
                target: edge.target,
                label: edge.label,
                type: "smoothstep",
                animated: false,
                data: edge,
                style: {
                    strokeWidth: 2,
                    stroke: "hsl(var(--nextui-colors-primary))",
                },
            }
        })
    }, [props.edges])

    return (
        <section aria-label={props.ariaLabel} style={{ width: "100%", height: props.height }}>
            <ReactFlow
                nodes={reactFlowNodes}
                edges={reactFlowEdges}
                fitView={fitView}
                fitViewOptions={{ padding: 0.15, minZoom: 0.15 }}
                minZoom={0.2}
                maxZoom={2}
                panOnDrag
                panOnScroll
                zoomOnScroll
                zoomOnPinch
                nodesDraggable={nodesDraggable}
                nodesConnectable={false}
                elementsSelectable={false}
            >
                <Background color="hsl(var(--nextui-colors-defaultBorder))" gap={16} />
                {showControls === true ? <Controls /> : null}
                {showMiniMap === true ? <MiniMap pannable /> : null}
            </ReactFlow>
        </section>
    )
}

export default XYFlowGraphRenderer
