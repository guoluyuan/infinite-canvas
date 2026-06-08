import axios from "axios";

import type { VideoGenerationResult } from "./video";

const JSON_SCAN_LIMIT = 80;
const MIN_BASE64_VIDEO_LENGTH = 128;
const VIDEO_URL_KEYS = ["video_url", "videoUrl", "url", "download_url", "downloadUrl", "data"];
const VIDEO_BASE64_KEYS = ["b64_json", "b64Json", "base64", "video_base64", "videoBase64", "data"];

type JsonPayload = {
    code?: number;
    msg?: string;
    error?: { message?: string };
    data?: unknown;
};

export async function videoResultFromBlob(blob: Blob): Promise<VideoGenerationResult> {
    const payload = await readJsonPayload(blob);
    if (!payload) return { blob };
    assertJsonPayload(payload);
    const url = findPayloadString(payload, VIDEO_URL_KEYS, isHttpUrl);
    if (url) return videoResultFromUrl(url);
    const dataUrl = findPayloadString(payload, VIDEO_BASE64_KEYS, isVideoData);
    if (dataUrl) return { blob: await (await fetch(dataUrl)).blob() };
    throw new Error("视频接口返回 JSON，但没有可播放的视频 URL 或 base64");
}

export async function videoResultFromUrl(url: string): Promise<VideoGenerationResult> {
    let response;
    try {
        response = await axios.get<Blob>(url, { responseType: "blob" });
    } catch {
        return { url, mimeType: "video/mp4" };
    }
    return videoResultFromBlob(response.data);
}

async function readJsonPayload(blob: Blob) {
    if (!(await looksLikeJsonBlob(blob))) return null;
    try {
        return JSON.parse(await blob.text()) as JsonPayload;
    } catch {
        return null;
    }
}

function assertJsonPayload(payload: JsonPayload) {
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "视频下载失败");
    if (payload.error?.message) throw new Error(payload.error.message);
}

function findPayloadString(payload: unknown, keys: string[], accept: (value: string) => boolean) {
    const pending = [payload];
    const seen = new Set<unknown>();
    while (pending.length && seen.size < JSON_SCAN_LIMIT) {
        const item = pending.shift();
        if (!item || typeof item !== "object" || seen.has(item)) continue;
        seen.add(item);
        const value = readKnownString(item as Record<string, unknown>, keys, accept);
        if (value) return value;
        for (const child of Object.values(item)) {
            if (child && typeof child === "object") pending.push(child);
        }
    }
    return "";
}

function readKnownString(item: Record<string, unknown>, keys: string[], accept: (value: string) => boolean) {
    for (const key of keys) {
        const value = item[key];
        if (typeof value === "string" && accept(value)) return normalizeVideoString(key, value);
    }
    return "";
}

function normalizeVideoString(key: string, value: string) {
    const trimmed = value.trim();
    if (!VIDEO_BASE64_KEYS.includes(key) || isVideoData(trimmed)) return trimmed;
    return `data:video/mp4;base64,${trimmed}`;
}

async function looksLikeJsonBlob(blob: Blob) {
    if (blob.type.includes("json")) return true;
    const head = await blob.slice(0, 32).text();
    return /^[\s]*[{[]/.test(head);
}

function isHttpUrl(value: string) {
    return /^https?:\/\//i.test(value.trim());
}

function isVideoData(value: string) {
    const trimmed = value.trim();
    if (/^data:video\/[^;]+;base64,/i.test(trimmed)) return true;
    return trimmed.length >= MIN_BASE64_VIDEO_LENGTH && /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
}
