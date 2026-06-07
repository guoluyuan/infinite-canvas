import axios from "axios";
import { nanoid } from "nanoid";

import type { AiConfig } from "@/stores/use-config-store";
import { isGrokImageModel } from "@/services/api/image-grok";

export type ImageApiResponse = {
    data?: Array<Record<string, unknown>>;
    error?: { message?: string };
    code?: number;
    msg?: string;
};

function resolveImageDataUrl(item: Record<string, unknown>) {
    if (typeof item.b64_json === "string" && item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
    }
    if (typeof item.url === "string" && item.url) {
        return item.url;
    }
    return null;
}

export async function parseImagePayload(payload: ImageApiResponse, config: AiConfig) {
    if (typeof payload.code === "number" && payload.code !== 0) {
        throw new Error(payload.msg || "请求失败");
    }
    const values = payload.data?.map(resolveImageDataUrl).filter((value): value is string => Boolean(value)) || [];
    const dataUrls = await Promise.all(values.map((value) => normalizeReturnedImageUrl(value, config)));
    const images = dataUrls.map((dataUrl) => ({ id: nanoid(), dataUrl }));

    if (images.length === 0) {
        throw new Error("接口没有返回图片");
    }

    return images;
}

async function normalizeReturnedImageUrl(value: string, config: AiConfig) {
    if (value.startsWith("data:") || !isGrokImageModel(config.model) || config.channelMode !== "local") return value;
    const response = await axios.get<Blob>(value, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        responseType: "blob",
    });
    return blobToDataUrl(response.data);
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}
