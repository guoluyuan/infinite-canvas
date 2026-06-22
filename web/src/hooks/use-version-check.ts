import { useCallback, useEffect, useState } from "react";
import { App } from "antd";
import { APP_VERSION } from "@/constant/env";
import { parseChangelog, type ReleaseInfo } from "@/lib/release";

const repositoryRawBaseUrl = "https://raw.githubusercontent.com/guoluyuan/infinite-canvas/main";
const latestVersionUrl = `${repositoryRawBaseUrl}/VERSION`;
const latestChangelogUrl = `${repositoryRawBaseUrl}/CHANGELOG.md`;
const bundledReleaseUrl = "/api/app-release";

type BundledReleaseInfo = {
    version: string;
    releases: ReleaseInfo[];
};

async function fetchBundledReleaseInfo() {
    const response = await fetch(bundledReleaseUrl);
    if (!response.ok) throw new Error("当前版本信息读取失败");
    return (await response.json()) as BundledReleaseInfo;
}

function toVersionParts(version: string) {
    const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1).map(Number) : null;
}

function isNewerVersion(latestVersion: string, currentVersion: string) {
    const latest = toVersionParts(latestVersion);
    const current = toVersionParts(currentVersion);
    if (!latest || !current) return false;
    return latest.some((value, index) => value > current[index] && latest.slice(0, index).every((part, prevIndex) => part === current[prevIndex]));
}

export function useVersionCheck() {
    const currentVersion = APP_VERSION;
    const { message } = App.useApp();
    const [latestVersion, setLatestVersion] = useState(currentVersion);
    const [releases, setReleases] = useState<ReleaseInfo[]>([]);
    const [releaseNotice, setReleaseNotice] = useState("");
    const [checking, setChecking] = useState(false);
    const [open, setOpen] = useState(false);
    const hasNewVersion = isNewerVersion(latestVersion, currentVersion);

    const checkLatestVersion = useCallback(async () => {
        try {
            const response = await fetch(latestVersionUrl);
            if (!response.ok) return false;
            const version = await response.text();
            setLatestVersion(version.trim() || currentVersion);
            return true;
        } catch {
            return false;
        }
    }, [currentVersion]);

    const checkLatestRelease = useCallback(
        async (showMessage = false) => {
            setChecking(true);
            try {
                const [versionResponse, changelogResponse] = await Promise.all([fetch(latestVersionUrl), fetch(latestChangelogUrl)]);
                if (!versionResponse.ok) throw new Error("版本读取失败");
                if (!changelogResponse.ok) throw new Error("更新日志读取失败");
                const [version, changelog] = await Promise.all([versionResponse.text(), changelogResponse.text()]);
                setLatestVersion(version.trim() || currentVersion);
                if (changelog.trim()) setReleases(parseChangelog(changelog));
                setReleaseNotice("");
                if (showMessage) message.success("已获取最新版本信息");
                return true;
            } catch {
                try {
                    const bundled = await fetchBundledReleaseInfo();
                    setLatestVersion(bundled.version || currentVersion);
                    setReleases(bundled.releases);
                    setReleaseNotice("远程读取失败，显示当前版本信息");
                    if (showMessage) message.error("获取最新版本信息失败，已显示当前版本信息");
                } catch {
                    setLatestVersion(currentVersion);
                    setReleases([]);
                    setReleaseNotice("版本信息读取失败");
                    if (showMessage) message.error("获取版本信息失败");
                }
                return false;
            } finally {
                setChecking(false);
            }
        },
        [currentVersion, message],
    );

    useEffect(() => {
        void checkLatestVersion();
    }, [checkLatestVersion]);

    const openReleaseModal = useCallback(() => {
        setOpen(true);
        void checkLatestRelease();
    }, [checkLatestRelease]);

    return {
        open,
        setOpen,
        openReleaseModal,
        latestVersion,
        releases,
        releaseNotice,
        checking,
        hasNewVersion,
        checkLatestRelease,
    };
}
