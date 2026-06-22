import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseChangelog } from "@/lib/release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const appRoot = resolve(process.cwd(), "..");
const versionPath = resolve(appRoot, "VERSION");
const changelogPath = resolve(appRoot, "CHANGELOG.md");

async function readTextFile(path: string) {
    return (await readFile(path, "utf8")).trim();
}

export async function GET() {
    const [version, changelog] = await Promise.all([readTextFile(versionPath), readTextFile(changelogPath)]);

    return Response.json({
        version: version || "dev",
        releases: parseChangelog(changelog),
    });
}
