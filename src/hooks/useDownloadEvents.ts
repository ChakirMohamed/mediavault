import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";

import { releaseDownloadSlot } from "@/lib/download-queue";
import type {
  DownloadCompleteEvent,
  DownloadErrorEvent,
  DownloadInfoEvent,
  DownloadProgressEvent,
} from "@/lib/downloads";
import { useAppStore } from "@/store/app-store";

const stageLabel: Record<DownloadProgressEvent["stage"], string> = {
  downloading: "downloading",
  merging: "merging audio + video",
  converting: "converting",
};

export function useDownloadEvents() {
  const patchDownload = useAppStore((state) => state.patchDownload);

  useEffect(() => {
    const unlisten = [
      listen<DownloadInfoEvent>("download-info", (event) => {
        patchDownload(event.payload.id, { title: event.payload.title });
      }),
      listen<DownloadProgressEvent>("download-progress", (event) => {
        const { id, percent, speed, eta, stage } = event.payload;

        patchDownload(id, {
          status: "downloading",
          errorMessage: undefined,
          ...(percent >= 0 ? { progress: Math.round(percent) } : {}),
          speed: speed ?? stageLabel[stage],
          eta: eta ?? "-",
        });
      }),
      listen<DownloadCompleteEvent>("download-complete", (event) => {
        const { id, outputPath, outputDir } = event.payload;

        patchDownload(id, {
          status: "completed",
          progress: 100,
          speed: "-",
          eta: "-",
          errorMessage: undefined,
          outputDir,
          ...(outputPath ? { filePath: outputPath } : {}),
        });
        releaseDownloadSlot(id);
        toast.success("Download complete");
      }),
      listen<DownloadErrorEvent>("download-error", (event) => {
        const { id, message } = event.payload;
        const errorMessage = message || "Download failed";
        const download = useAppStore.getState().downloads.find((item) => item.id === id);

        // A kill triggered by pause/cancel also surfaces as a process error;
        // keep the status the user chose instead of flipping to failed.
        if (download && ["paused", "cancelled"].includes(download.status)) {
          releaseDownloadSlot(id);
          return;
        }

        patchDownload(id, { status: "failed", speed: "-", eta: "-", errorMessage });
        releaseDownloadSlot(id);
        console.error(`[download ${id}] failed:`, errorMessage);
        toast.error(errorMessage);
      }),
    ];

    return () => {
      unlisten.forEach((promise) => {
        promise.then((fn) => fn());
      });
    };
  }, [patchDownload]);
}
