import type { CanvasNodeMetadata } from "../types";

export function generationLoadingMetadata(startedAt: number): Pick<CanvasNodeMetadata, "status" | "generationStartedAt" | "generationDurationMs" | "errorDetails"> {
    return { status: "loading", generationStartedAt: startedAt, generationDurationMs: undefined, errorDetails: undefined };
}

export function generationSuccessMetadata(startedAt: number): Pick<CanvasNodeMetadata, "status" | "generationStartedAt" | "generationDurationMs" | "errorDetails"> {
    return { status: "success", generationStartedAt: startedAt, generationDurationMs: elapsedSince(startedAt), errorDetails: undefined };
}

export function generationErrorMetadata(startedAt: number, errorDetails: string): Pick<CanvasNodeMetadata, "status" | "generationStartedAt" | "generationDurationMs" | "errorDetails"> {
    return { status: "error", generationStartedAt: startedAt, generationDurationMs: elapsedSince(startedAt), errorDetails };
}

function elapsedSince(startedAt: number) {
    return Math.max(0, Date.now() - startedAt);
}
