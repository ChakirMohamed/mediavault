import { invoke } from "@tauri-apps/api/core";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

export type StartDownloadArgs = {
  id: string;
  url: string;
  outputFormat: string;
  quality: string;
  outputDir?: string;
};

export async function startDownload(args: StartDownloadArgs) {
  return invoke<void>("start_download", { ...args });
}

export async function cancelDownload(id: string) {
  return invoke<void>("cancel_download", { id });
}

export type MediaEntry = {
  id: string;
  title: string;
  url: string;
  duration: number | null;
  uploader: string | null;
};

export type MediaInfo = {
  kind: "single" | "playlist";
  title: string | null;
  entries: MediaEntry[];
  truncated: boolean;
};

export async function fetchMediaInfo(url: string) {
  return invoke<MediaInfo>("fetch_media_info", { url });
}

/**
 * Reveals the downloaded file in Explorer, falling back to opening the
 * output folder when the file is gone or its recorded path is stale.
 */
export async function openDownloadLocation(location: {
  filePath?: string;
  outputDir: string;
}) {
  if (location.filePath) {
    try {
      await revealItemInDir(location.filePath);
      return;
    } catch {
      // fall back to the folder below
    }
  }

  if (!location.outputDir) {
    throw new Error("No output folder recorded for this download");
  }

  await openPath(location.outputDir);
}

export type DownloadInfoEvent = {
  id: string;
  title: string;
};

export type DownloadProgressEvent = {
  id: string;
  percent: number;
  speed: string | null;
  eta: string | null;
  stage: "downloading" | "merging" | "converting";
};

export type DownloadCompleteEvent = {
  id: string;
  outputPath: string | null;
  outputDir: string;
};

export type DownloadErrorEvent = {
  id: string;
  message: string;
};
