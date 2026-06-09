import axios, { type AxiosProgressEvent } from "axios";

import { buildApiUrl, type AiConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { dataUrlToFile } from "@/lib/image-utils";
import { buildImageReferencePromptText } from "@/lib/image-reference-prompt";
import { imageToDataUrl } from "@/services/image-storage";
import type { ReferenceImage } from "@/types/image";
import { applyGrokEditAspect, buildGrokEditPrompt, isGrokImageModel, resolveGrokEditModel, resolveGrokEditSize, resolveGrokGenerationSize } from "@/services/api/image-grok";
import { parseImagePayload, type ImageApiResponse } from "@/services/api/image-response";
import { normalizeQuality, resolveRequestSize } from "@/services/api/image-size";

export type ChatCompletionMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

const IMAGE_OUTPUT_FORMAT = "png";

type ImageRequestOptions = {
    signal?: AbortSignal;
};

function readAxiosError(error: unknown, fallback: string) {
    if (axios.isAxiosError<{ error?: { message?: string }; msg?: string; code?: number }>(error)) {
        const responseData = error.response?.data;
        return responseData?.msg || responseData?.error?.message || readStatusError(error.response?.status, fallback);
    }
    return error instanceof Error ? error.message : fallback;
}

function readStatusError(status: number | undefined, fallback: string) {
    if (status === 401 || status === 403) return "鉴权失败，请检查 API Key、套餐权限或模型权限";
    if (status === 429) return "请求被限流或额度不足，请稍后重试";
    return status ? `${fallback}：${status}` : fallback;
}

function parseStreamChunk(chunk: string, onDelta: (value: string) => void) {
    let deltaText = "";
    for (const eventBlock of chunk.split("\n\n")) {
        const data = eventBlock
            .split("\n")
            .find((line) => line.startsWith("data: "))
            ?.slice(6);
        if (!data || data === "[DONE]") continue;
        const delta = (JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta?.content || "";
        deltaText += delta;
    }
    if (deltaText) onDelta(deltaText);
}

function appendStreamAnswer(chunk: string, answer: string, onDelta: (text: string) => void) {
    let nextAnswer = answer;
    parseStreamChunk(chunk, (delta) => {
        nextAnswer += delta;
        onDelta(nextAnswer);
    });
    return nextAnswer;
}

function createTextStreamReader(onChunk: (chunk: string) => void) {
    let buffer = "";
    let processedLength = 0;
    return {
        handle(event: AxiosProgressEvent) {
            const responseText = readProgressResponseText(event);
            const nextText = responseText.slice(processedLength);
            processedLength = responseText.length;
            buffer += nextText;
            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() || "";
            chunks.forEach(onChunk);
        },
        flush() {
            if (buffer) onChunk(buffer);
        },
    };
}

function readProgressResponseText(event: AxiosProgressEvent) {
    const target = event.event?.target as { responseText?: string } | undefined;
    return String(target?.responseText || "");
}

function withSystemPrompt(config: AiConfig, prompt: string) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
}

function aiApiUrl(config: AiConfig, path: string) {
    return config.channelMode === "remote" ? `/api/v1${path}` : buildApiUrl(config.baseUrl, path);
}

function aiHeaders(config: AiConfig, contentType?: string) {
    const token = useUserStore.getState().token;
    return config.channelMode === "remote"
        ? {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(contentType ? { "Content-Type": contentType } : {}),
          }
        : {
              Authorization: `Bearer ${config.apiKey}`,
              ...(contentType ? { "Content-Type": contentType } : {}),
          };
}

function refreshRemoteUser(config: AiConfig) {
    if (config.channelMode === "remote") void useUserStore.getState().hydrateUser();
}

function withSystemMessage(config: AiConfig, messages: ChatCompletionMessage[]) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? [{ role: "system" as const, content: systemPrompt }, ...messages] : messages;
}

function assertChatStreamResponse(data: unknown) {
    if (typeof data === "object" && data && "code" in data && (data as { code?: number }).code !== 0) {
        throw new Error((data as { msg?: string }).msg || "请求失败");
    }
    if (typeof data !== "string") return;
    let apiError = "";
    try {
        const payload = JSON.parse(data) as { code?: number; msg?: string };
        if (typeof payload.code === "number" && payload.code !== 0) apiError = payload.msg || "请求失败";
    } catch {
        // ignore plain text stream content
    }
    if (apiError) throw new Error(apiError);
}

export async function requestGeneration(config: AiConfig, prompt: string, options?: ImageRequestOptions) {
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const isGrokImage = isGrokImageModel(config.model);
    const quality = isGrokImage ? undefined : normalizeQuality(config.quality);
    const requestSize = isGrokImage ? resolveGrokGenerationSize(config.size) : resolveRequestSize(quality, config.size);
    try {
        const response = await axios.post<ImageApiResponse>(
            aiApiUrl(config, "/images/generations"),
            {
                model: config.model,
                prompt: withSystemPrompt(config, prompt),
                ...(!isGrokImage || n > 1 ? { n } : {}),
                ...(quality ? { quality } : {}),
                ...(requestSize ? { size: requestSize } : {}),
                response_format: "b64_json",
                ...(!isGrokImage ? { output_format: IMAGE_OUTPUT_FORMAT } : {}),
            },
            {
                headers: aiHeaders(config, "application/json"),
                signal: options?.signal,
            },
        );
        const images = await parseImagePayload(response.data, config);
        refreshRemoteUser(config);
        return images;
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

export async function requestEdit(config: AiConfig, prompt: string, references: ReferenceImage[], mask?: ReferenceImage, options?: ImageRequestOptions) {
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const isGrokEdit = isGrokImageModel(config.model);
    const quality = isGrokEdit ? undefined : normalizeQuality(config.quality);
    const requestSize = isGrokEdit ? resolveGrokEditSize() : resolveRequestSize(quality, config.size);
    const referencePrompt = buildImageReferencePromptText(prompt, references);
    const requestPrompt = isGrokEdit ? buildGrokEditPrompt(referencePrompt, config.size) : referencePrompt;
    const formData = new FormData();
    formData.set("model", resolveGrokEditModel(config));
    formData.set("prompt", withSystemPrompt(config, requestPrompt));
    formData.set("n", String(n));
    formData.set("response_format", "b64_json");
    if (!isGrokEdit) formData.set("output_format", IMAGE_OUTPUT_FORMAT);
    if (!isGrokEdit && quality) {
        formData.set("quality", quality);
    }
    if (requestSize) formData.set("size", requestSize);
    const files = await Promise.all(references.map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    files.forEach((file) => formData.append(isGrokEdit ? "image[]" : "image", file));
    if (isGrokEdit && mask) throw new Error("Grok 图片编辑暂不支持蒙版");
    if (mask) formData.set("mask", dataUrlToFile(mask));

    try {
        const response = await axios.post<ImageApiResponse>(aiApiUrl(config, "/images/edits"), formData, { headers: aiHeaders(config), signal: options?.signal });
        const parsedImages = await parseImagePayload(response.data, config);
        const images = isGrokEdit ? await applyGrokEditAspect(parsedImages, config.size) : parsedImages;
        refreshRemoteUser(config);
        return images;
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
}

export async function requestImageQuestion(config: AiConfig, messages: ChatCompletionMessage[], onDelta: (text: string) => void) {
    let answer = "";
    const streamReader = createTextStreamReader((chunk) => {
        answer = appendStreamAnswer(chunk, answer, onDelta);
    });

    try {
        const response = await axios.post(
            aiApiUrl(config, "/chat/completions"),
            {
                model: config.model,
                messages: withSystemMessage(config, messages),
                stream: true,
            },
            {
                headers: {
                    ...aiHeaders(config, "application/json"),
                } as Record<string, string>,
                responseType: "text",
                onDownloadProgress: streamReader.handle,
            },
        );
        assertChatStreamResponse(response.data);
        streamReader.flush();
    } catch (error) {
        throw new Error(readAxiosError(error, "请求失败"));
    }
    refreshRemoteUser(config);
    return answer || "没有返回内容";
}

export async function fetchImageModels(config: AiConfig) {
    if (config.channelMode === "remote") return config.models;
    try {
        const response = await axios.get<{ data?: Array<{ id?: string }>; error?: { message?: string } }>(buildApiUrl(config.baseUrl, "/models"), {
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
            },
        });
        return (response.data.data || [])
            .map((model) => model.id)
            .filter((id): id is string => Boolean(id))
            .sort((a, b) => a.localeCompare(b));
    } catch (error) {
        throw new Error(readAxiosError(error, "读取模型失败"));
    }
}
