import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  /** Folder the download is saved into. */
  outputDir: string;
  /** Full path of the finished file, once known. */
  filePath?: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  errorMessage?: string;
  createdAt: string;
};

export type DownloadRequest = {
  url: string;
  title?: string;
};

export type MediaPickerRequest = {
  urls: string[];
  outputFormat: string;
  quality: string;
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
  pickerRequest: MediaPickerRequest | null;
  setActiveView: (view: AppView) => void;
  openMediaPicker: (request: MediaPickerRequest) => void;
  closeMediaPicker: () => void;
  addDownloads: (requests: DownloadRequest[], outputFormat: string, quality: string) => string[];
  updateDownloadStatus: (id: string, status: DownloadStatus) => void;
  patchDownload: (id: string, patch: Partial<DownloadItem>) => void;
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

const defaultSettings: AppSettings = {
  defaultOutputFolder: "",
  maxConcurrentDownloads: 3,
  defaultVideoQuality: "best",
  defaultAudioFormat: "mp3",
  defaultAudioBitrate: "320k",
  autoConvertAfterDownload: false,
  theme: "dark",
};

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

/** Downloads that were mid-flight when the app closed have no backing process
 *  anymore, so rehydrate them as paused (resumable). */
const sanitizeDownloads = (downloads: DownloadItem[]) =>
  downloads.map((download) =>
    ["queued", "analyzing", "downloading"].includes(download.status)
      ? { ...download, status: "paused" as const, speed: "-", eta: "-" }
      : download,
  );

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeView: "downloads",
      downloads: [],
      conversions: [],
      dependencies: undefined,
      settings: defaultSettings,
      pickerRequest: null,
      setActiveView: (view) => set({ activeView: view }),
      openMediaPicker: (request) => set({ pickerRequest: request }),
      closeMediaPicker: () => set({ pickerRequest: null }),
      addDownloads: (requests, outputFormat, quality) => {
        const ids: string[] = [];

        set((state) => ({
          activeView: "downloads",
          downloads: [
            ...requests.map((request) => {
              const id = crypto.randomUUID();
              ids.push(id);

              return {
                id,
                title: request.title?.trim() || titleFromUrl(request.url),
                source: detectSource(request.url),
                url: request.url,
                outputFormat,
                quality,
                outputDir: state.settings.defaultOutputFolder,
                status: "queued" as const,
                progress: 0,
                speed: "-",
                eta: "-",
                createdAt: now(),
              };
            }),
            ...state.downloads,
          ],
        }));

        return ids;
      },
      updateDownloadStatus: (id, status) =>
        set((state) => ({
          downloads: state.downloads.map((download) =>
            download.id === id
              ? {
                  ...download,
                  status,
                }
              : download,
          ),
        })),
      patchDownload: (id, patch) =>
        set((state) => ({
          downloads: state.downloads.map((download) =>
            download.id === id ? { ...download, ...patch } : download,
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
    }),
    {
      name: "mediavault-store",
      version: 1,
      partialize: (state) => ({
        settings: state.settings,
        downloads: state.downloads,
      }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<
          Pick<AppState, "settings" | "downloads">
        >;

        return {
          ...current,
          settings: { ...current.settings, ...stored.settings },
          downloads: sanitizeDownloads(stored.downloads ?? []),
        };
      },
    },
  ),
);
