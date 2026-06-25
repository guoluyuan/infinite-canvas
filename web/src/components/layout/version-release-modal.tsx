"use client";

import type { CSSProperties } from "react";
import { Modal, Tag, Timeline } from "antd";
import { useVersionCheck } from "@/hooks/use-version-check";
import { useCopyText } from "@/hooks/use-copy-text";
import { APP_VERSION } from "@/constant/env";

const dockerUpdateCommand = "docker compose pull && docker compose up -d";

type VersionReleaseModalProps = {
    className?: string;
    style?: CSSProperties;
};

type DockerUpdateNoticeProps = {
    show: boolean;
    onCopy: () => void;
};

type VersionSummaryProps = {
    latestVersion: string;
    checking: boolean;
    onRefresh: () => void;
};

function getTagColor(type: string) {
    if (type === "新增") return "green";
    if (type === "修复") return "red";
    if (type === "调整") return "blue";
    if (type === "文档") return "purple";
    return "default";
}

function getReleaseTitle(version: string) {
    return version === "Unreleased" ? "未发布" : version;
}

function DockerUpdateNotice({ show, onCopy }: DockerUpdateNoticeProps) {
    if (!show) return null;

    return (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">
            <div className="font-medium">有新版本</div>
            <div className="mt-1">Watchtower 会自动更新。也可手动执行：</div>
            <div className="mt-2 flex items-center gap-2 rounded-md bg-white/70 px-2 py-1.5 dark:bg-black/20">
                <code className="min-w-0 flex-1 truncate text-xs">{dockerUpdateCommand}</code>
                <button type="button" className="shrink-0 text-xs font-medium underline-offset-2 hover:underline" onClick={onCopy}>
                    复制命令
                </button>
            </div>
        </div>
    );
}

function VersionSummary({ latestVersion, checking, onRefresh }: VersionSummaryProps) {
    return (
        <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                <div className="text-xs text-stone-500 dark:text-stone-400">当前版本</div>
                <div className="mt-1 text-base font-semibold text-stone-950 dark:text-stone-100">{APP_VERSION}</div>
            </div>
            <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-stone-500 dark:text-stone-400">最新版本</div>
                    <button type="button" className="cursor-pointer bg-transparent p-0 text-[11px] font-normal text-stone-400 underline-offset-2 transition hover:text-stone-700 hover:underline dark:text-stone-500 dark:hover:text-stone-300" onClick={onRefresh}>
                        {checking ? "刷新中..." : "刷新信息"}
                    </button>
                </div>
                <div className="mt-1 text-base font-semibold text-stone-950 dark:text-stone-100">{latestVersion}</div>
            </div>
        </div>
    );
}

function ReleaseTimeline({ latestVersion, releases }: Pick<ReturnType<typeof useVersionCheck>, "latestVersion" | "releases">) {
    return (
        <Timeline
            items={releases.map((release) => ({
                content: (
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-stone-950 dark:text-stone-100">{getReleaseTitle(release.version)}</span>
                            <span className="text-xs text-stone-500 dark:text-stone-400">{release.date}</span>
                            <div className="flex min-w-0 items-center gap-1.5">
                                {release.version === latestVersion ? <Tag color="green">最新</Tag> : null}
                                {release.version === APP_VERSION ? <Tag>当前</Tag> : null}
                            </div>
                        </div>
                        <div className="mt-2 space-y-1.5">
                            {release.items.map((item, index) => (
                                <div key={`${release.version}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-stone-700 dark:text-stone-300">
                                    <Tag color={getTagColor(item.type)} className="m-0 mt-0.5 shrink-0 whitespace-nowrap">
                                        {item.type}
                                    </Tag>
                                    <span className="min-w-0 flex-1">{item.content}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ),
            }))}
        />
    );
}

export function VersionReleaseModal({ className, style }: VersionReleaseModalProps) {
    const copyText = useCopyText();
    const versionCheck = useVersionCheck();
    const { open, setOpen, openReleaseModal, latestVersion, releases, releaseNotice, checking, hasNewVersion, checkLatestRelease } = versionCheck;

    return (
        <>
            <button type="button" className={className || "shrink-0 cursor-pointer text-xs font-medium text-stone-500 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-white"} style={style} onClick={openReleaseModal} title="查看版本信息">
                <span className="relative inline-flex">
                    {APP_VERSION}
                    {hasNewVersion ? <span className="absolute -right-1.5 -top-1 size-1.5 rounded-full bg-green-500" /> : null}
                </span>
            </button>
            <Modal title="版本信息" open={open} width={680} centered footer={null} onCancel={() => setOpen(false)}>
                <VersionSummary latestVersion={latestVersion} checking={checking} onRefresh={() => void checkLatestRelease(true)} />
                <DockerUpdateNotice show={hasNewVersion} onCopy={() => copyText(dockerUpdateCommand, "命令已复制")} />
                {releaseNotice ? <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{releaseNotice}</div> : null}
                <div className="max-h-[56vh] overflow-y-auto pr-2">
                    <ReleaseTimeline latestVersion={latestVersion} releases={releases} />
                </div>
            </Modal>
        </>
    );
}
