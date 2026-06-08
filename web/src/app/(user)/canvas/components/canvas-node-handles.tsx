"use client";

import type { MouseEvent } from "react";

import type { CanvasTheme, ResizeCorner } from "./canvas-node-shared";

type ResizeHandleProps = {
    corner: ResizeCorner;
    onMouseDown: (event: MouseEvent, corner: ResizeCorner) => void;
};

type ConnectionHandleDotProps = {
    theme: CanvasTheme;
    side: "left" | "right";
    visible: boolean;
    onMouseDown: (event: MouseEvent) => void;
};

export function ResizeHandle({ corner, onMouseDown }: ResizeHandleProps) {
    const positionClass = {
        "top-left": "-left-[14px] -top-[14px] cursor-nwse-resize",
        "top-right": "-right-[14px] -top-[14px] cursor-nesw-resize",
        "bottom-left": "-bottom-[14px] -left-[14px] cursor-nesw-resize",
        "bottom-right": "-bottom-[14px] -right-[14px] cursor-nwse-resize",
    }[corner];

    return <div className={`absolute z-50 size-7 ${positionClass}`} onMouseDown={(event) => onMouseDown(event, corner)} />;
}

export function ConnectionHandleDot({ theme, side, visible, onMouseDown }: ConnectionHandleDotProps) {
    return (
        <div
            className={`absolute top-1/2 z-30 flex size-12 -translate-y-1/2 cursor-crosshair items-center justify-center transition-opacity duration-150 ${
                side === "left" ? "-left-6" : "-right-6"
            } ${visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
            onMouseDown={onMouseDown}
        >
            <div className="size-3 rounded-full border-2 transition-all hover:scale-125" style={{ background: theme.node.panel, borderColor: theme.node.muted }} />
        </div>
    );
}
