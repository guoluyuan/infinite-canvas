import type { ReactNode, RefObject } from "react";

import type { CanvasTheme } from "@/lib/canvas-theme";
import type { CanvasNodeData } from "../types";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";

export type { CanvasTheme };
export type ResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type NodeContentRendererProps = {
    node: CanvasNodeData;
    theme: CanvasTheme;
    isEditingContent: boolean;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    isBatchRoot: boolean;
    batchCount: number;
    batchExpanded: boolean;
    batchOpening: boolean;
    batchRecovering: boolean;
    renderNodeContent?: (node: CanvasNodeData) => ReactNode;
    onContentChange: (nodeId: string, content: string) => void;
    onStopEditing: () => void;
    mentionReferences: CanvasResourceReference[];
    onRetry?: (node: CanvasNodeData) => void;
    onGenerateImage?: (node: CanvasNodeData) => void;
    onToggleBatch?: () => void;
    onSetBatchPrimary?: () => void;
};
