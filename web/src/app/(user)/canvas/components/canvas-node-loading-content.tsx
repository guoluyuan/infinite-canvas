"use client";

import { useEffect, useState } from "react";

import { formatDuration } from "@/lib/image-utils";
import type { CanvasTheme } from "./canvas-node-shared";
import type { CanvasNodeData } from "../types";

export function LoadingContent({ node, theme }: { node: CanvasNodeData; theme: CanvasTheme }) {
    const elapsedMs = useGenerationElapsedMs(node.metadata?.generationStartedAt);
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3" style={{ color: theme.node.activeStroke }}>
            <div className="size-10 animate-spin rounded-full border-2" style={{ borderColor: theme.node.stroke, borderTopColor: theme.node.activeStroke }} />
            <span className="text-[10px] tracking-[0.2em]">生成中</span>
            <span className="text-[11px] tabular-nums opacity-70">{formatDuration(elapsedMs)}</span>
        </div>
    );
}

function useGenerationElapsedMs(startedAt?: number) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!startedAt) return;
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [startedAt]);
    return startedAt ? Math.max(0, now - startedAt) : 0;
}
