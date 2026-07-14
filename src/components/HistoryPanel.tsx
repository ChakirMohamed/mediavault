import { Archive, CheckCircle2, CircleX, FolderOpen, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { processDownloadQueue } from "@/lib/download-queue";
import { openDownloadLocation } from "@/lib/downloads";
import { cn } from "@/lib/utils";
import {
  TERMINAL_STATUSES,
  useAppStore,
  type DownloadItem,
  type DownloadStatus,
} from "@/store/app-store";

const statusStyles: Partial<
  Record<DownloadStatus, { icon: typeof CheckCircle2; iconClass: string; badgeClass: string }>
> = {
  completed: {
    icon: CheckCircle2,
    iconClass: "text-emerald-400",
    badgeClass: "border-emerald-500/40 text-emerald-400",
  },
  failed: {
    icon: CircleX,
    iconClass: "text-red-400",
    badgeClass: "border-red-500/40 text-red-400",
  },
  cancelled: {
    icon: CircleX,
    iconClass: "text-muted-foreground",
    badgeClass: "text-muted-foreground",
  },
};

const formatDate = (isoDate: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(
    new Date(isoDate),
  );

function HistoryRow({ download }: { download: DownloadItem }) {
  const patchDownload = useAppStore((state) => state.patchDownload);
  const removeDownload = useAppStore((state) => state.removeDownload);

  const style = statusStyles[download.status] ?? statusStyles.cancelled!;
  const StatusIcon = style.icon;

  const handleRetry = () => {
    patchDownload(download.id, {
      status: "queued",
      progress: 0,
      speed: "-",
      eta: "-",
      errorMessage: undefined,
    });
    processDownloadQueue();
    toast.success("Download requeued");
  };

  const handleOpenFolder = async () => {
    try {
      await openDownloadLocation(download);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="flex items-center gap-3 p-3">
      <StatusIcon className={cn("size-4 shrink-0", style.iconClass)} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{download.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>{download.source}</span>
          <span>·</span>
          <span>{download.outputFormat.toUpperCase()}</span>
          <span>·</span>
          <span>{download.quality === "audio" ? "Audio only" : download.quality.toUpperCase()}</span>
          <span>·</span>
          <span>{formatDate(download.createdAt)}</span>
        </div>
        {download.status === "failed" && download.errorMessage && (
          <div className="mt-0.5 truncate text-xs text-red-400">{download.errorMessage}</div>
        )}
      </div>

      <Badge variant="outline" className={cn("hidden shrink-0 sm:inline-flex", style.badgeClass)}>
        {download.status}
      </Badge>

      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Redownload" onClick={handleRetry}>
              <RotateCcw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {download.status === "completed" ? "Download again" : "Retry download"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Open folder"
              disabled={
                download.status !== "completed" || !(download.filePath || download.outputDir)
              }
              onClick={handleOpenFolder}
            >
              <FolderOpen />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open folder</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove from history"
              onClick={() => removeDownload(download.id)}
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove from history</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function HistoryPanel() {
  const downloads = useAppStore((state) => state.downloads);
  const clearDownloadHistory = useAppStore((state) => state.clearDownloadHistory);

  const historyItems = downloads.filter((download) =>
    TERMINAL_STATUSES.includes(download.status),
  );
  const completedItems = historyItems.filter((download) => download.status === "completed");
  const failedItems = historyItems.filter((download) => download.status !== "completed");

  const handleClear = () => {
    const count = historyItems.length;
    clearDownloadHistory();
    toast.success(`${count} ${count === 1 ? "entry" : "entries"} cleared`);
  };

  const renderHistory = (items: DownloadItem[], emptyLabel: string) =>
    items.length === 0 ? (
      <div className="flex min-h-96 items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Archive className="mx-auto size-8 text-muted-foreground" />
          <div className="mt-3 text-sm font-medium">{emptyLabel}</div>
          <div className="mt-1 text-xs text-muted-foreground">Finished jobs will appear here.</div>
        </div>
      </div>
    ) : (
      <div className="divide-y rounded-lg border bg-card">
        {items.map((download) => (
          <HistoryRow key={download.id} download={download} />
        ))}
      </div>
    );

  return (
    <Tabs defaultValue="all" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="w-fit">
          <TabsTrigger value="all">All ({historyItems.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedItems.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({failedItems.length})</TabsTrigger>
        </TabsList>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={historyItems.length === 0}
        >
          <Trash2 />
          Clear history
        </Button>
      </div>

      <TabsContent value="all" className="mt-0">
        {renderHistory(historyItems, "No history")}
      </TabsContent>

      <TabsContent value="completed" className="mt-0">
        {renderHistory(completedItems, "No completed jobs")}
      </TabsContent>

      <TabsContent value="failed" className="mt-0">
        {renderHistory(failedItems, "No failed jobs")}
      </TabsContent>
    </Tabs>
  );
}
