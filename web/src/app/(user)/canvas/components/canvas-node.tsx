"use client";

import React, { useState } from "react";
import type { ReactNode } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData, type Position } from "../types";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";
import { useCanvasNodeEditing, useCanvasNodeResize } from "./canvas-node-hooks";
import { CanvasNodeShell } from "./canvas-node-shell";

type CanvasNodeProps = {
    data: CanvasNodeData;
    scale: number;
    isSelected: boolean;
    isRelated: boolean;
    isFocusRelated: boolean;
    isConnectionTarget: boolean;
    isConnecting: boolean;
    editRequestNonce?: number;
    showPanel: boolean;
    showImageInfo: boolean;
    resourceLabel?: CanvasResourceReference;
    mentionReferences?: CanvasResourceReference[];
    renderPanel?: (node: CanvasNodeData) => ReactNode;
    renderNodeContent?: (node: CanvasNodeData) => ReactNode;
    batchCount?: number;
    batchExpanded?: boolean;
    batchClosing?: boolean;
    batchOpening?: boolean;
    batchRecovering?: boolean;
    batchMotion?: { x: number; y: number; index: number };
    onMouseDown: (event: React.MouseEvent, nodeId: string) => void;
    onHoverStart: (nodeId: string) => void;
    onHoverEnd: (nodeId: string) => void;
    onConnectStart: (event: React.MouseEvent, nodeId: string, handleType: "source" | "target") => void;
    onResize: (nodeId: string, width: number, height: number, position?: Position) => void;
    onContentChange: (nodeId: string, content: string) => void;
    onToggleBatch?: (nodeId: string) => void;
    onSetBatchPrimary?: (node: CanvasNodeData) => void;
    onRetry?: (node: CanvasNodeData) => void;
    onGenerateImage?: (node: CanvasNodeData) => void;
    onViewImage?: (node: CanvasNodeData) => void;
    onContextMenu: (event: React.MouseEvent, nodeId: string) => void;
};

export const CanvasNode = React.memo(function CanvasNode(props: CanvasNodeProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [hovered, setHovered] = useState(false);
    const editing = useCanvasNodeEditing(props.data, props.editRequestNonce ?? 0);
    const handleResizeMouseDown = useCanvasNodeResize({ node: props.data, scale: props.scale, onResize: props.onResize });
    const flags = buildFlags({ ...props, hovered, batchCount: props.batchCount ?? 0 });
    const batch = buildBatch(props);
    const hoverHandlers = buildHoverHandlers(setHovered, props.onHoverStart, props.onHoverEnd);

    return (
        <CanvasNodeShell
            data={props.data}
            theme={theme}
            flags={flags}
            batch={batch}
            textareaRef={editing.textareaRef}
            isEditingContent={editing.isEditingContent}
            resourceLabel={props.resourceLabel}
            mentionReferences={props.mentionReferences ?? []}
            renderPanel={props.renderPanel}
            renderNodeContent={props.renderNodeContent}
            onStopEditing={() => editing.setIsEditingContent(false)}
            onMouseDown={props.onMouseDown}
            onHoverStart={hoverHandlers.onHoverStart}
            onHoverEnd={hoverHandlers.onHoverEnd}
            onConnectStart={props.onConnectStart}
            onResizeMouseDown={handleResizeMouseDown}
            onContentChange={props.onContentChange}
            onToggleBatch={props.onToggleBatch}
            onSetBatchPrimary={props.onSetBatchPrimary}
            onRetry={props.onRetry}
            onGenerateImage={props.onGenerateImage}
            onViewImage={props.onViewImage}
            onContextMenu={props.onContextMenu}
            onEditingStart={() => editing.setIsEditingContent(true)}
        />
    );
});

function buildFlags({
    data,
    batchCount,
    hovered,
    isSelected,
    isRelated,
    isFocusRelated,
    isConnectionTarget,
    isConnecting,
    showPanel,
    showImageInfo,
}: Pick<CanvasNodeProps, "data" | "isSelected" | "isRelated" | "isFocusRelated" | "isConnectionTarget" | "isConnecting" | "showPanel" | "showImageInfo"> & { batchCount: number; hovered: boolean }) {
    return {
        isSelected,
        isRelated,
        isFocusRelated,
        isConnectionTarget,
        isConnecting,
        showPanel,
        showImageInfo,
        hovered,
        hasImageContent: data.type === CanvasNodeType.Image && Boolean(data.metadata?.content),
        hasVideoContent: data.type === CanvasNodeType.Video && Boolean(data.metadata?.content),
        hasAudioContent: data.type === CanvasNodeType.Audio && Boolean(data.metadata?.content),
        isBatchRoot: data.type === CanvasNodeType.Image && Boolean(data.metadata?.isBatchRoot) && batchCount > 1,
        isBatchChild: data.type === CanvasNodeType.Image && Boolean(data.metadata?.batchRootId),
    };
}

function buildBatch(props: CanvasNodeProps) {
    return {
        count: props.batchCount ?? 0,
        expanded: props.batchExpanded ?? false,
        closing: props.batchClosing ?? false,
        opening: props.batchOpening ?? false,
        recovering: props.batchRecovering ?? false,
        motion: props.batchMotion,
    };
}

function buildHoverHandlers(setHovered: (value: boolean) => void, onHoverStart: (nodeId: string) => void, onHoverEnd: (nodeId: string) => void) {
    return {
        onHoverStart: (nodeId: string) => {
            setHovered(true);
            onHoverStart(nodeId);
        },
        onHoverEnd: (nodeId: string) => {
            setHovered(false);
            onHoverEnd(nodeId);
        },
    };
}
