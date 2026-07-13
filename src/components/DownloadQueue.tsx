import { DownloadCloud } from "lucide-react";
import { toast } from "sonner";

import { ProgressCard } from "@/components/ProgressCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { processDownloadQueue, releaseDownloadSlot } from "@/lib/download-queue";
import { cancelDownload, openDownloadLocation } from "@/lib/downloads";
import { useAppStore, type DownloadItem, type DownloadStatus } from "@/store/app-store";

const toneForStatus = (status: DownloadStatus) => {
  if (status === "downloading" || status === "analyzing") {
    return "active" as const;
  }

  if (status === "completed") {
    return "success" as const;
  }

  if (status === "failed" || status === "cancelled") {
    return "danger" as const;
  }

  if (status === "paused") {
    return "warning" as const;
  }

  return "neutral" as const;
};

export function DownloadQueue() {
  const downloads = useAppStore((state) => state.downloads);
  const maxConcurrentDownloads = useAppStore((state) => state.settings.maxConcurrentDownloads);
  const updateDownloadStatus = useAppStore((state) => state.updateDownloadStatus);
  const activeDownloads = downloads.filter(
    (download) => !["completed", "failed", "cancelled"].includes(download.status),
  );

  // Mark the item paused/cancelled BEFORE killing the process, so the
  // process-exit error event is recognized as intentional and ignored.
  const handlePause = async (download: DownloadItem) => {
    updateDownloadStatus(download.id, "paused");

    try {
      await cancelDownload(download.id);
    } catch {
      // process may have already exited
    }

    releaseDownloadSlot(download.id);
  };

  const handleResume = (download: DownloadItem) => {
    updateDownloadStatus(download.id, "queued");
    processDownloadQueue();
  };

  const handleCancel = async (download: DownloadItem) => {
    updateDownloadStatus(download.id, "cancelled");

    try {
      await cancelDownload(download.id);
    } catch {
      // process may have already exited
    }

    releaseDownloadSlot(download.id);
  };

  const handleOpenFolder = async (download: DownloadItem) => {
    try {
      await openDownloadLocation(download);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <section className="grid min-h-0 gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card/50 p-4">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="mt-1 text-2xl font-semibold">{activeDownloads.length}</div>
        </div>
        <div className="rounded-lg border bg-card/50 p-4">
          <div className="text-xs text-muted-foreground">Queued</div>
          <div className="mt-1 text-2xl font-semibold">
            {downloads.filter((download) => download.status === "queued").length}
          </div>
        </div>
        <div className="rounded-lg border bg-card/50 p-4">
          <div className="text-xs text-muted-foreground">Concurrent</div>
          <div className="mt-1 text-2xl font-semibold">{maxConcurrentDownloads}</div>
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <DownloadCloud className="mx-auto size-8 text-muted-foreground" />
            <div className="mt-3 text-sm font-medium">No downloads</div>
            <div className="mt-1 text-xs text-muted-foreground">Paste or drop a URL to start.</div>
          </div>
        </div>
      ) : (
        <ScrollArea className="min-h-0 pr-3">
          <div className="grid gap-3">
            {downloads.map((download) => (
              <ProgressCard
                key={download.id}
                title={download.title}
                subtitle={`${download.source} - ${download.url}`}
                status={download.status}
                tone={toneForStatus(download.status)}
                progress={download.progress}
                errorMessage={download.status === "failed" ? download.errorMessage : undefined}
                meta={[
                  { label: "Format", value: download.outputFormat.toUpperCase() },
                  { label: "Quality", value: download.quality.toUpperCase() },
                  { label: "Speed", value: download.speed },
                  { label: "ETA", value: download.eta },
                ]}
                actions={{
                  onResume: download.status === "paused" ? () => handleResume(download) : undefined,
                  onPause:
                    ["queued", "analyzing", "downloading"].includes(download.status)
                      ? () => handlePause(download)
                      : undefined,
                  onCancel: activeDownloads.some((item) => item.id === download.id)
                    ? () => handleCancel(download)
                    : undefined,
                  onOpenFolder:
                    download.status === "completed" && (download.filePath || download.outputDir)
                      ? () => handleOpenFolder(download)
                      : undefined,
                }}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </section>
  );
}
