import { toast } from "sonner";

import { startDownload } from "@/lib/downloads";
import { useAppStore } from "@/store/app-store";

/**
 * Ids whose start_download invoke is in flight, so a re-entrant
 * processDownloadQueue call can't start the same item twice.
 */
const starting = new Set<string>();

const isActive = (status: string) => status === "analyzing" || status === "downloading";

/**
 * Starts queued downloads until `maxConcurrentDownloads` are running.
 * Call it whenever the queue changes: items added, resumed, finished,
 * failed, paused, or cancelled.
 */
export function processDownloadQueue() {
  const { downloads, settings, patchDownload } = useAppStore.getState();

  const activeCount = downloads.filter(
    (item) => isActive(item.status) || (item.status === "queued" && starting.has(item.id)),
  ).length;
  const slots = settings.maxConcurrentDownloads - activeCount;

  if (slots <= 0) {
    return;
  }

  // Newest downloads are prepended in the store; start the oldest queued first.
  const next = downloads
    .filter((item) => item.status === "queued" && !starting.has(item.id))
    .slice(-slots)
    .reverse();

  for (const item of next) {
    starting.add(item.id);
    patchDownload(item.id, { status: "analyzing", errorMessage: undefined });

    startDownload({
      id: item.id,
      url: item.url,
      outputFormat: item.outputFormat,
      quality: item.quality,
      outputDir: item.outputDir || undefined,
    })
      .then(() => {
        starting.delete(item.id);
      })
      .catch((error) => {
        starting.delete(item.id);
        const message = error instanceof Error ? error.message : String(error);
        useAppStore.getState().patchDownload(item.id, {
          status: "failed",
          speed: "-",
          eta: "-",
          errorMessage: message,
        });
        toast.error(message);
        processDownloadQueue();
      });
  }
}

/** Frees the slot held by a finished/stopped download and starts the next one. */
export function releaseDownloadSlot(id: string) {
  starting.delete(id);
  processDownloadQueue();
}
