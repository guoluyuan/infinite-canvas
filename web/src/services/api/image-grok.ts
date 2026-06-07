import type { AiConfig } from "@/stores/use-config-store";

export const GROK_EDIT_MODEL = "grok-imagine-image-edit";
export const GROK_EDIT_SIZE = "1024x1024";
const GROK_DEFAULT_SIZE = "1024x1024";
const ASPECT_MATCH_TOLERANCE = 0.03;
const ASPECT_CROP_TOLERANCE = 0.01;
const KNOWN_ASPECTS = [
    { label: "1:1", width: 1, height: 1 },
    { label: "16:9", width: 16, height: 9 },
    { label: "9:16", width: 9, height: 16 },
    { label: "3:2", width: 3, height: 2 },
    { label: "2:3", width: 2, height: 3 },
    { label: "4:3", width: 4, height: 3 },
    { label: "3:4", width: 3, height: 4 },
];
const GROK_GENERATION_SIZES = [
    { label: "1:1", width: 1, height: 1, size: "1024x1024" },
    { label: "16:9", width: 16, height: 9, size: "1280x720" },
    { label: "9:16", width: 9, height: 16, size: "720x1280" },
    { label: "3:2", width: 3, height: 2, size: "1792x1024" },
    { label: "2:3", width: 2, height: 3, size: "1024x1792" },
];

export function isGrokImageModel(model: string) {
    return model.trim().toLowerCase().startsWith("grok-imagine-image");
}

export function resolveGrokGenerationSize(size: string) {
    const aspect = readGrokAspect(size);
    if (!aspect) return GROK_DEFAULT_SIZE;
    const exact = GROK_GENERATION_SIZES.find((item) => item.label === aspect.label);
    return exact?.size || closestGrokSize(aspect.width / aspect.height);
}

export function resolveGrokEditSize() {
    return GROK_EDIT_SIZE;
}

export function resolveGrokEditModel(config: Pick<AiConfig, "channelMode" | "model">) {
    return isGrokImageModel(config.model) && config.channelMode === "local" ? GROK_EDIT_MODEL : config.model;
}

export function buildGrokEditPrompt(prompt: string, size: string) {
    const aspect = readGrokAspect(size);
    if (!aspect) return prompt;
    return `${prompt}\n\n输出宽高比：${aspect.label}。Output aspect ratio: ${aspect.label}. 请严格按该比例生成最终图片，不要输出方图。`;
}

export function readGrokAspect(size: string) {
    const value = size.trim().toLowerCase();
    if (!value || value === "auto") return null;
    const ratio = readRatioValue(value);
    if (!ratio) return null;
    return closestKnownAspect(ratio.width, ratio.height) || normalizeAspect(ratio.width, ratio.height);
}

export async function applyGrokEditAspect<T extends { dataUrl: string }>(images: T[], size: string) {
    const aspect = readGrokAspect(size);
    if (!aspect) return images;
    const ratio = aspect.width / aspect.height;
    return Promise.all(images.map(async (image) => ({ ...image, dataUrl: await cropGrokImageToAspect(image.dataUrl, ratio) })));
}

function readRatioValue(value: string) {
    const ratio = value.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)/);
    if (ratio) return validRatio(Number(ratio[1]), Number(ratio[2]));
    const dimensions = value.match(/^(\d+)x(\d+)$/);
    if (!dimensions) return null;
    return validRatio(Number(dimensions[1]), Number(dimensions[2]));
}

function validRatio(width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return { width, height };
}

function closestKnownAspect(width: number, height: number) {
    const target = width / height;
    return KNOWN_ASPECTS.find((item) => Math.abs(item.width / item.height - target) / target < ASPECT_MATCH_TOLERANCE);
}

function normalizeAspect(width: number, height: number) {
    const divisor = gcd(Math.round(width), Math.round(height));
    return { label: `${Math.round(width) / divisor}:${Math.round(height) / divisor}`, width, height };
}

function closestGrokSize(ratio: number) {
    return GROK_GENERATION_SIZES.reduce((best, item) => {
        const bestDelta = Math.abs(best.width / best.height - ratio);
        const delta = Math.abs(item.width / item.height - ratio);
        return delta < bestDelta ? item : best;
    }).size;
}

function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : Math.max(1, a);
}

async function cropGrokImageToAspect(dataUrl: string, targetRatio: number) {
    const image = await loadGrokImage(dataUrl);
    const crop = coverCrop(image.naturalWidth || image.width, image.naturalHeight || image.height, targetRatio);
    if (isFullImageCrop(crop, image)) return dataUrl;
    return drawGrokCrop(image, crop);
}

function coverCrop(width: number, height: number, targetRatio: number) {
    const sourceRatio = width / Math.max(1, height);
    if (Math.abs(sourceRatio - targetRatio) / targetRatio < ASPECT_CROP_TOLERANCE) return { sx: 0, sy: 0, sw: width, sh: height };
    if (sourceRatio > targetRatio) {
        const sw = height * targetRatio;
        return { sx: (width - sw) / 2, sy: 0, sw, sh: height };
    }
    const sh = width / targetRatio;
    return { sx: 0, sy: (height - sh) / 2, sw: width, sh };
}

function isFullImageCrop(crop: { sx: number; sy: number; sw: number; sh: number }, image: HTMLImageElement) {
    return crop.sx === 0 && crop.sy === 0 && crop.sw === image.naturalWidth && crop.sh === image.naturalHeight;
}

function drawGrokCrop(image: HTMLImageElement, crop: { sx: number; sy: number; sw: number; sh: number }) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(crop.sw));
    canvas.height = Math.max(1, Math.round(crop.sh));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法裁切 Grok 返回图片");
    context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
}

function loadGrokImage(dataUrl: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("读取 Grok 返回图片失败"));
        image.src = dataUrl;
    });
}
