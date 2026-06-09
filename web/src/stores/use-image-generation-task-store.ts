"use client";

import { create } from "zustand";

import type { AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";

export type GeneratedImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType?: string;
};

export type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    image?: GeneratedImage;
    error?: string;
};

export type GenerationLog = {
    id: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    imageCount: number;
    size: string;
    quality: string;
    status: "成功" | "失败" | "生成中" | "已终止";
    images: GeneratedImage[];
    thumbnails: string[];
};

export type GenerationLogConfig = Pick<AiConfig, "model" | "imageModel" | "quality" | "size" | "count">;
export type GenerationSnapshot = { text: string; config: AiConfig; references: ReferenceImage[] };
export type GenerationRunContext = { logId: string; signal: AbortSignal };

type StartTaskPayload = {
    log: GenerationLog;
    results: GenerationResult[];
    startedAt: number;
    controller: AbortController;
};

type ImageGenerationTaskStore = {
    runningLog: GenerationLog | null;
    runningResults: GenerationResult[];
    startedAt: number;
    elapsedMs: number;
    activeRunningLogId: string | null;
    controller: AbortController | null;
    startTask: (payload: StartTaskPayload) => void;
    updateElapsedMs: (durationMs: number) => void;
    setActiveRunningLogId: (id: string | null) => void;
    updateResultAt: (index: number, next: Partial<GenerationResult>, logId: string) => void;
    stopTask: () => boolean;
    finishTask: (controller: AbortController) => void;
};

export const useImageGenerationTaskStore = create<ImageGenerationTaskStore>((set, get) => ({
    runningLog: null,
    runningResults: [],
    startedAt: 0,
    elapsedMs: 0,
    activeRunningLogId: null,
    controller: null,
    startTask({ log, results, startedAt, controller }) {
        set({ runningLog: log, runningResults: results, startedAt, elapsedMs: 0, activeRunningLogId: log.id, controller });
    },
    updateElapsedMs(durationMs) {
        set((state) => ({
            elapsedMs: durationMs,
            runningLog: state.runningLog?.status === "生成中" ? { ...state.runningLog, durationMs } : state.runningLog,
        }));
    },
    setActiveRunningLogId(id) {
        set({ activeRunningLogId: id });
    },
    updateResultAt(index, next, logId) {
        const state = get();
        const runningResults = updateResultAt(state.runningResults, index, next);
        set({ runningResults, runningLog: syncRunningLogImages(state.runningLog, runningResults, logId) });
    },
    stopTask() {
        const { controller, runningLog } = get();
        if (!controller || controller.signal.aborted) return false;
        controller.abort();
        set({ runningLog: runningLog ? { ...runningLog, status: "已终止" } : runningLog });
        return true;
    },
    finishTask(controller) {
        if (get().controller !== controller) return;
        set({ runningLog: null, runningResults: [], startedAt: 0, elapsedMs: 0, activeRunningLogId: null, controller: null });
    },
}));

function updateResultAt(results: GenerationResult[], index: number, next: Partial<GenerationResult>) {
    return results.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item));
}

function syncRunningLogImages(log: GenerationLog | null, results: GenerationResult[], logId: string) {
    if (!log || log.id !== logId) return log;
    const images = results.map((item) => item.image).filter((image): image is GeneratedImage => Boolean(image));
    return { ...log, successCount: images.length, images, thumbnails: images.map((image) => image.dataUrl).filter(Boolean) };
}
