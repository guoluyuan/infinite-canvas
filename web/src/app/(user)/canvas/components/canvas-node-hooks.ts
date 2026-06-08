"use client";

import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CanvasNodeType, type CanvasNodeData, type Position } from "../types";
import type { ResizeCorner } from "./canvas-node-shared";

const NODE_MIN_WIDTH = 220;
const NODE_MIN_HEIGHT = 160;

export function useCanvasNodeEditing(node: CanvasNodeData, editRequestNonce: number) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isEditingContent, setIsEditingContent] = useState(false);

    useTextareaWheelStop(textareaRef, node.type, isEditingContent);
    useFocusEditingTextarea(textareaRef, isEditingContent);
    useExternalEditRequest(node.type, editRequestNonce, setIsEditingContent);
    useCloseEditingOnOutsidePointer(textareaRef, isEditingContent, setIsEditingContent);

    return { textareaRef, isEditingContent, setIsEditingContent };
}

export function useCanvasNodeResize({ node, scale, onResize }: { node: CanvasNodeData; scale: number; onResize: (nodeId: string, width: number, height: number, position?: Position) => void }) {
    const resizeRef = useRef(createResizeState());

    const handleResizeMove = useCallback(
        (event: MouseEvent) => {
            if (!resizeRef.current.isResizing) return;

            const dx = (event.clientX - resizeRef.current.startX) / scale;
            const dy = (event.clientY - resizeRef.current.startY) / scale;
            const size = nextResizeSize(resizeRef.current, dx, dy);
            const fromLeft = resizeRef.current.corner.includes("left");
            const fromTop = resizeRef.current.corner.includes("top");
            const startRight = resizeRef.current.startLeft + resizeRef.current.startWidth;
            const startBottom = resizeRef.current.startTop + resizeRef.current.startHeight;

            onResize(node.id, size.width, size.height, {
                x: fromLeft ? startRight - size.width : resizeRef.current.startLeft,
                y: fromTop ? startBottom - size.height : resizeRef.current.startTop,
            });
        },
        [node.id, onResize, scale],
    );

    const handleResizeUp = useCallback(() => {
        resizeRef.current.isResizing = false;
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeUp);
    }, [handleResizeMove]);

    const handleResizeMouseDown = useCallback(
        (event: ReactMouseEvent, corner: ResizeCorner) => {
            event.stopPropagation();
            event.preventDefault();
            resizeRef.current = createResizeState(node, event, corner);
            window.addEventListener("mousemove", handleResizeMove);
            window.addEventListener("mouseup", handleResizeUp);
        },
        [handleResizeMove, handleResizeUp, node],
    );

    useEffect(() => {
        return () => {
            window.removeEventListener("mousemove", handleResizeMove);
            window.removeEventListener("mouseup", handleResizeUp);
        };
    }, [handleResizeMove, handleResizeUp]);

    return handleResizeMouseDown;
}

function useTextareaWheelStop(textareaRef: RefObject<HTMLTextAreaElement | null>, nodeType: CanvasNodeType, isEditingContent: boolean) {
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const handleWheel = (event: WheelEvent) => event.stopPropagation();
        textarea.addEventListener("wheel", handleWheel, { passive: false });
        return () => textarea.removeEventListener("wheel", handleWheel);
    }, [textareaRef, nodeType, isEditingContent]);
}

function useFocusEditingTextarea(textareaRef: RefObject<HTMLTextAreaElement | null>, isEditingContent: boolean) {
    useEffect(() => {
        if (!isEditingContent) return;
        const textarea = textareaRef.current;
        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
    }, [textareaRef, isEditingContent]);
}

function useExternalEditRequest(nodeType: CanvasNodeType, editRequestNonce: number, setIsEditingContent: (value: boolean) => void) {
    useEffect(() => {
        if (!editRequestNonce || nodeType !== CanvasNodeType.Text) return;
        setIsEditingContent(true);
    }, [editRequestNonce, nodeType, setIsEditingContent]);
}

function useCloseEditingOnOutsidePointer(textareaRef: RefObject<HTMLTextAreaElement | null>, isEditingContent: boolean, setIsEditingContent: (value: boolean) => void) {
    useEffect(() => {
        if (!isEditingContent) return;

        const handleOutsidePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (textareaRef.current?.contains(target)) return;
            setIsEditingContent(false);
        };

        window.addEventListener("pointerdown", handleOutsidePointerDown, true);
        return () => window.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    }, [textareaRef, isEditingContent, setIsEditingContent]);
}

function createResizeState(node?: CanvasNodeData, event?: ReactMouseEvent, corner: ResizeCorner = "bottom-right") {
    return {
        isResizing: Boolean(node && event),
        corner,
        startX: event?.clientX || 0,
        startY: event?.clientY || 0,
        startLeft: node?.position.x || 0,
        startTop: node?.position.y || 0,
        startWidth: node?.width || 0,
        startHeight: node?.height || 0,
        keepRatio: Boolean(node && ((node.type === CanvasNodeType.Image && !node.metadata?.freeResize) || node.type === CanvasNodeType.Video)),
        ratio: (node?.metadata?.naturalWidth || node?.width || 1) / (node?.metadata?.naturalHeight || node?.height || 1),
    };
}

function nextResizeSize(state: ReturnType<typeof createResizeState>, dx: number, dy: number) {
    const fromLeft = state.corner.includes("left");
    const fromTop = state.corner.includes("top");
    const rawWidth = Math.max(NODE_MIN_WIDTH, state.startWidth + (fromLeft ? -dx : dx));
    const rawHeight = Math.max(NODE_MIN_HEIGHT, state.startHeight + (fromTop ? -dy : dy));
    if (!state.keepRatio) return { width: rawWidth, height: rawHeight };

    const byWidth = Math.abs(dx) >= Math.abs(dy);
    const width = byWidth ? rawWidth : rawHeight * state.ratio;
    const height = byWidth ? rawWidth / state.ratio : rawHeight;
    return clampRatioSize(width, height, state.ratio);
}

function clampRatioSize(width: number, height: number, ratio: number) {
    if (height < NODE_MIN_HEIGHT) return { width: NODE_MIN_HEIGHT * ratio, height: NODE_MIN_HEIGHT };
    if (width < NODE_MIN_WIDTH) return { width: NODE_MIN_WIDTH, height: NODE_MIN_WIDTH / ratio };
    return { width, height };
}
