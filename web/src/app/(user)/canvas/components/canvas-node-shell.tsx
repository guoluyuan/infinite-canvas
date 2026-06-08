"use client";

import type { CSSProperties, MouseEvent, ReactNode, RefObject } from "react";

import { CanvasNodeType, type CanvasNodeData } from "../types";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";
import { ImageInfoBar, NodeContent, ResourceLabelBadge } from "./canvas-node-content";
import { ConnectionHandleDot, ResizeHandle } from "./canvas-node-handles";
import type { CanvasTheme, ResizeCorner } from "./canvas-node-shared";

const selectionBlue = "#2f80ff";
const NODE_PANEL_MIN_WIDTH = 500;

type CanvasNodeShellProps = {
    data: CanvasNodeData;
    theme: CanvasTheme;
    flags: CanvasNodeShellFlags;
    batch: CanvasNodeShellBatch;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    isEditingContent: boolean;
    resourceLabel?: CanvasResourceReference;
    mentionReferences: CanvasResourceReference[];
    renderPanel?: (node: CanvasNodeData) => ReactNode;
    renderNodeContent?: (node: CanvasNodeData) => ReactNode;
    onStopEditing: () => void;
    onMouseDown: (event: MouseEvent, nodeId: string) => void;
    onHoverStart: (nodeId: string) => void;
    onHoverEnd: (nodeId: string) => void;
    onConnectStart: (event: MouseEvent, nodeId: string, handleType: "source" | "target") => void;
    onResizeMouseDown: (event: MouseEvent, corner: ResizeCorner) => void;
    onContentChange: (nodeId: string, content: string) => void;
    onToggleBatch?: (nodeId: string) => void;
    onSetBatchPrimary?: (node: CanvasNodeData) => void;
    onRetry?: (node: CanvasNodeData) => void;
    onGenerateImage?: (node: CanvasNodeData) => void;
    onViewImage?: (node: CanvasNodeData) => void;
    onContextMenu: (event: MouseEvent, nodeId: string) => void;
    onEditingStart: () => void;
};

type CanvasNodeShellFlags = {
    isSelected: boolean;
    isRelated: boolean;
    isFocusRelated: boolean;
    isConnectionTarget: boolean;
    isConnecting: boolean;
    showPanel: boolean;
    showImageInfo: boolean;
    hovered: boolean;
    hasImageContent: boolean;
    hasVideoContent: boolean;
    hasAudioContent: boolean;
    isBatchRoot: boolean;
    isBatchChild: boolean;
};

type CanvasNodeShellBatch = {
    count: number;
    expanded: boolean;
    closing: boolean;
    opening: boolean;
    recovering: boolean;
    motion?: { x: number; y: number; index: number };
};

export function CanvasNodeShell(props: CanvasNodeShellProps) {
    const nodeStyle = buildNodeStyle(props.data);
    const panelStyle = { width: props.data.width, minWidth: NODE_PANEL_MIN_WIDTH };

    return (
        <div data-node-id={props.data.id} className={`node-element absolute flex select-none flex-col transition-shadow duration-200 ${props.flags.isSelected ? "z-50" : "z-10"}`} style={nodeStyle} onMouseEnter={() => props.onHoverStart(props.data.id)} onMouseLeave={() => props.onHoverEnd(props.data.id)} onContextMenu={(event) => props.onContextMenu(event, props.data.id)}>
            <CanvasNodeBody {...props} />
            <ConnectionHandleDot theme={props.theme} side="left" visible={props.flags.hovered || props.flags.isSelected || props.flags.isConnecting} onMouseDown={(event) => props.onConnectStart(event, props.data.id, "target")} />
            <ConnectionHandleDot theme={props.theme} side="right" visible={props.data.type !== CanvasNodeType.Config && (props.flags.hovered || props.flags.isSelected || props.flags.isConnecting)} onMouseDown={(event) => props.onConnectStart(event, props.data.id, "source")} />
            {props.flags.showPanel && props.renderPanel ? (
                <div className="absolute left-1/2 top-full z-[70] -translate-x-1/2 pt-4" style={panelStyle}>
                    {props.renderPanel(props.data)}
                </div>
            ) : null}
        </div>
    );
}

function CanvasNodeBody(props: CanvasNodeShellProps) {
    const style = buildBodyStyle(props);

    return (
        <div className="relative h-full w-full overflow-visible rounded-3xl border-2" style={style} onMouseDown={(event) => props.onMouseDown(event, props.data.id)} onDoubleClick={(event) => handleNodeDoubleClick(event, props)}>
            <CanvasNodeInner {...props} />
            {props.flags.showImageInfo && props.flags.hasImageContent ? <ImageInfoBar node={props.data} /> : null}
            {props.resourceLabel ? <ResourceLabelBadge reference={props.resourceLabel} /> : null}
            {!props.flags.hasImageContent && !props.flags.hasVideoContent && !props.flags.hasAudioContent ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12" style={{ background: `linear-gradient(to top, ${props.theme.canvas.background}66, transparent)` }} /> : null}
            <ResizeHandle corner="top-left" onMouseDown={props.onResizeMouseDown} />
            <ResizeHandle corner="top-right" onMouseDown={props.onResizeMouseDown} />
            <ResizeHandle corner="bottom-left" onMouseDown={props.onResizeMouseDown} />
            <ResizeHandle corner="bottom-right" onMouseDown={props.onResizeMouseDown} />
        </div>
    );
}

function CanvasNodeInner(props: CanvasNodeShellProps) {
    return (
        <div className={`relative flex h-full w-full items-center justify-center rounded-[inherit] ${props.flags.isBatchRoot ? "overflow-visible" : "overflow-hidden"}`} style={buildInnerStyle(props)}>
            <NodeContent
                node={props.data}
                theme={props.theme}
                isEditingContent={props.isEditingContent}
                textareaRef={props.textareaRef}
                isBatchRoot={props.flags.isBatchRoot}
                batchCount={props.batch.count}
                batchExpanded={props.batch.expanded}
                batchOpening={props.batch.opening}
                batchRecovering={props.batch.recovering}
                renderNodeContent={props.renderNodeContent}
                mentionReferences={props.mentionReferences}
                onContentChange={props.onContentChange}
                onStopEditing={props.onStopEditing}
                onRetry={props.onRetry}
                onGenerateImage={props.onGenerateImage}
                onToggleBatch={() => props.onToggleBatch?.(props.data.id)}
                onSetBatchPrimary={() => props.onSetBatchPrimary?.(props.data)}
            />
        </div>
    );
}

function handleNodeDoubleClick(event: MouseEvent, props: CanvasNodeShellProps) {
    if (props.flags.isBatchRoot) {
        event.stopPropagation();
        props.onToggleBatch?.(props.data.id);
        return;
    }
    if (props.data.type === CanvasNodeType.Image && props.flags.hasImageContent) {
        event.stopPropagation();
        props.onViewImage?.(props.data);
        return;
    }
    if (props.data.type !== CanvasNodeType.Text) return;
    event.stopPropagation();
    props.onEditingStart();
}

function buildNodeStyle(data: CanvasNodeData): CSSProperties {
    return {
        transform: `translate(${data.position.x}px, ${data.position.y}px)`,
        width: data.width,
        height: data.height,
        transition: "box-shadow 200ms ease",
        contain: "layout style",
    };
}

function buildBodyStyle({ flags, theme }: CanvasNodeShellProps): CSSProperties {
    const isActive = flags.isConnectionTarget || flags.isSelected || flags.isFocusRelated;
    const imageBorderColor = isActive ? selectionBlue : flags.isRelated && !flags.isBatchChild ? theme.node.muted : "transparent";

    return {
        background: flags.hasImageContent || flags.hasVideoContent ? "transparent" : theme.node.fill,
        borderColor: flags.hasImageContent ? imageBorderColor : isActive ? selectionBlue : flags.isRelated ? theme.node.muted : theme.node.stroke,
        boxShadow: isActive ? `0 0 0 1px ${selectionBlue}55` : flags.isRelated && !flags.isBatchChild ? `0 0 0 1px ${theme.node.muted}55, 0 18px 48px rgba(0,0,0,.14)` : undefined,
    };
}

function buildInnerStyle({ data, flags, theme, batch }: CanvasNodeShellProps): CSSProperties {
    return {
        background: flags.hasImageContent || flags.hasVideoContent ? "transparent" : theme.node.fill,
        "--batch-from-x": `${batch.motion?.x || 0}px`,
        "--batch-from-y": `${batch.motion?.y || 0}px`,
        "--batch-from-rotate": `${6 + (batch.motion?.index || 0) * 4}deg`,
        animation: data.metadata?.batchRootId ? (batch.closing ? "canvas-batch-child-out 260ms cubic-bezier(.4,0,.2,1) both" : "canvas-batch-child-in 340ms cubic-bezier(.2,.85,.18,1) both") : undefined,
        animationDelay: data.metadata?.batchRootId ? `${batch.closing ? 0 : 45 + (batch.motion?.index || 0) * 24}ms` : undefined,
    } as CSSProperties;
}
