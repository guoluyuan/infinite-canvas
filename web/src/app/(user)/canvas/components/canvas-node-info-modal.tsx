"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal, Segmented } from "antd";

import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes, formatDuration, getDataUrlByteSize } from "@/lib/image-utils";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "../types";

export function CanvasNodeInfoModal({ node, open, onClose }: { node: CanvasNodeData | null; open: boolean; onClose: () => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [view, setView] = useState<"info" | "json">("info");
    const imageBytes = node?.type === CanvasNodeType.Image && node.metadata?.content ? getDataUrlByteSize(node.metadata.content) : 0;
    const batchCount = node?.type === CanvasNodeType.Image ? node.metadata?.batchChildIds?.length || 0 : 0;
    const json = useMemo(() => {
        if (!node) return "";
        return JSON.stringify(node, nodeInfoReplacer, 2);
    }, [node]);

    useEffect(() => {
        if (open) setView("info");
    }, [node?.id, open]);

    return (
        <Modal className="canvas-node-info-modal" title={<InfoTitle view={view} onViewChange={setView} />} open={open && Boolean(node)} centered footer={null} onCancel={onClose}>
            {node ? (
                <div className="h-[56vh] min-h-[360px] text-sm">
                    {view === "info" ? (
                        <div className="thin-scrollbar h-full space-y-3 overflow-auto pr-1">
                            <InfoRow label="ID" value={node.id} />
                            <InfoRow label="类型" value={nodeTypeLabel(node.type)} />
                            <InfoRow label="尺寸" value={`${Math.round(node.width)} x ${Math.round(node.height)}`} />
                            <InfoRow label="位置" value={`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`} />
                            <InfoRow label="状态" value={node.metadata?.status || "idle"} />
                            {typeof node.metadata?.generationDurationMs === "number" ? <InfoRow label="耗时" value={formatDuration(node.metadata.generationDurationMs)} /> : null}
                            {batchCount > 1 ? <InfoRow label="图片组" value={`${batchCount} 张`} /> : null}
                            {node.metadata?.prompt ? <InfoRow label="提示词" value={node.metadata.prompt} /> : null}
                            {imageBytes ? <InfoRow label="图片大小" value={formatBytes(imageBytes)} /> : null}
                            {node.metadata?.errorDetails ? (
                                <div className="rounded-lg border p-3 text-red-400" style={{ borderColor: theme.node.stroke }}>
                                    {node.metadata.errorDetails}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <pre className="thin-scrollbar h-full overflow-auto rounded-lg border p-3 text-xs leading-5" style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}>
                            {json}
                        </pre>
                    )}
                </div>
            ) : null}
        </Modal>
    );
}

function InfoTitle({ view, onViewChange }: { view: "info" | "json"; onViewChange: (view: "info" | "json") => void }) {
    return (
        <div className="flex items-center justify-between gap-4 pr-12">
            <span>节点信息</span>
            <Segmented size="small" value={view} onChange={(value) => onViewChange(value as "info" | "json")} options={[{ label: "信息", value: "info" }, { label: "JSON", value: "json" }]} />
        </div>
    );
}

function nodeInfoReplacer(key: string, value: unknown) {
    if (key === "title") return undefined;
    if (key === "content" && typeof value === "string" && value.startsWith("data:image/")) return "[base64 image]";
    return value;
}

function nodeTypeLabel(type: CanvasNodeType) {
    if (type === CanvasNodeType.Text) return "文本";
    if (type === CanvasNodeType.Image) return "图片";
    if (type === CanvasNodeType.Video) return "视频";
    if (type === CanvasNodeType.Audio) return "音频";
    return "生成配置";
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <span className="opacity-50">{label}</span>
            <span className="min-w-0 whitespace-pre-wrap break-words">{value}</span>
        </div>
    );
}
