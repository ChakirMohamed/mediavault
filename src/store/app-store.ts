import { create } from "zustand";

import type { DependencyStatus } from "@/lib/dependencies";

export type AppView = "downloads" | "converter" | "history" | "settings";

export type DownloadStatus =
  | "queued"
  | "analyzing"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ConversionStatus =
  | "queued"
  | "converting"
  | "completed"
  | "failed"
  | "cancelled";

export type ThemeMode = "dark" | "light" | "system";

export type DownloadItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  outputFormat: string;
  quality: string;
  outputPath: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  createdAt: string;
};

export type ConversionItem = {
  id: string;
  fileName: string;
  inputPath: string;
  outputFormat: string;
  quality: string;
  status: ConversionStatus;
  progress: number;
  createdAt: string;
};

export type AppSettings = {
  defaultOutputFolder: string;
  maxConcurrentDownloads: number;
  defaultVideoQuality: "best" | "1080p" | "720p" | "480p" | "audio";
  defaultAudioFormat: "mp3" | "aac" | "flac" | "wav";
  defaultAudioBitrate: "128k" | "192k" | "256k" | "320k";
  autoConvertAfterDownload: boolean;
  theme: ThemeMode;
};

type AppState = {
  activeView: AppView;
  downloads: DownloadItem[];
  conversions: ConversionItem[];
  settings: AppSettings;
  dependencies?: DependencyStatus;
  setActiveView: (view: AppView) => void;
  addDownloadFromUrl: (url: string, outputFormat: string, quality: string) => void;
  updateDownloadStatus: (id: string, status: DownloadStatus) => void;
  addConversionFiles: (
    files: Array<{ name: string; path?: string }>,
    outputFormat?: string,
    quality?: string,
  ) => void;
  updateConversionStatus: (id: string, status: ConversionStatus) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setDependencies: (dependencies: DependencyStatus) => void;
};

const now = () => new Date().toISOString();

const detectSource = (url: string) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");

    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      return "YouTube";
    }

    if (host.includes("instagram.com")) {
      return "Instagram";
    }

    if (host.includes("tiktok.com")) {
      return "TikTok";
    }

    if (host.includes("twitter.com") || host.includes("x.com")) {
      return "Twitter/X";
    }

    if (host.includes("facebook.com") || host.includes("fb.watch")) {
      return "Facebook";
    }

    if (host.includes("soundcloud.com")) {
      return "SoundCloud";
    }

    if (host.includes("vimeo.com")) {
      return "Vimeo";
    }

    return host;
  } catch {
    return "Web";
  }
};

const titleFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];

    return lastSegment ? decodeURIComponent(lastSegment) : parsed.hostname;
  } catch {
    return "Untitled media";
  }
};

export const useAppStore = create<AppState>((set) => ({
  activeView: "downloads",
  downloads: [],
  conversions: [],
  dependencies: undefined,
  settings: {
    defaultOutputFolder: "",
    maxConcurrentDownloads: 3,
    defaultVideoQuality: "best",
    defaultAudioFormat: "mp3",
    defaultAudioBitrate: "320k",
    autoConvertAfterDownload: false,
    theme: "dark",
  },
  setActiveView: (view) => set({ activeView: view }),
  addDownloadFromUrl: (url, outputFormat, quality) =>
    set((state) => ({
      activeView: "downloads",
      downloads: [
        {
          id: crypto.randomUUID(),
          title: titleFromUrl(url),
          source: detectSource(url),
          url,
          outputFormat,
          quality,
          outputPath: state.settings.defaultOutputFolder,
          status: "queued",
          progress: 0,
          speed: "-",
          eta: "-",
          createdAt: now(),
        },
        ...state.downloads,
      ],
    })),
  updateDownloadStatus: (id, status) =>
    set((state) => ({
      downloads: state.downloads.map((download) =>
        download.id === id
          ? {
              ...download,
              status,
              progress: status === "cancelled" ? download.progress : download.progress,
            }
          : download,
      ),
    })),
  addConversionFiles: (files, outputFormat = "mp4", quality = "high") =>
    set((state) => ({
      activeView: "converter",
      conversions: [
        ...files.map((file) => ({
          id: crypto.randomUUID(),
          fileName: file.name,
          inputPath: file.path ?? file.name,
          outputFormat,
          quality,
          status: "queued" as const,
          progress: 0,
          createdAt: now(),
        })),
        ...state.conversions,
      ],
    })),
  updateConversionStatus: (id, status) =>
    set((state) => ({
      conversions: state.conversions.map((conversion) =>
        conversion.id === id ? { ...conversion, status } : conversion,
      ),
    })),
  updateSettings: (settings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...settings,
      },
    })),
  setDependencies: (dependencies) => set({ dependencies }),
}));
