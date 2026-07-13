import { useEffect, useState } from "react";
import { Download, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { processDownloadQueue } from "@/lib/download-queue";
import { fetchMediaInfo, type MediaEntry } from "@/lib/downloads";
import { formatDuration, normalizeCollectionUrl } from "@/lib/media-urls";
import { useAppStore } from "@/store/app-store";

type FetchError = {
  url: string;
  message: string;
};

export function MediaPickerDialog() {
  const request = useAppStore((state) => state.pickerRequest);
  const closeMediaPicker = useAppStore((state) => state.closeMediaPicker);
  const addDownloads = useAppStore((state) => state.addDownloads);

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [errors, setErrors] = useState<FetchError[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!request) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setEntries([]);
    setErrors([]);
    setTruncated(false);
    setSelected(new Set());

    (async () => {
      const results = await Promise.allSettled(
        request.urls.map((url) => fetchMediaInfo(normalizeCollectionUrl(url))),
      );

      if (cancelled) {
        return;
      }

      const nextEntries: MediaEntry[] = [];
      const seen = new Set<string>();
      const nextErrors: FetchError[] = [];
      let anyTruncated = false;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          anyTruncated = anyTruncated || result.value.truncated;

          for (const entry of result.value.entries) {
            if (!seen.has(entry.id)) {
              seen.add(entry.id);
              nextEntries.push(entry);
            }
          }
        } else {
          nextErrors.push({
            url: request.urls[index],
            message:
              result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      });

      setEntries(nextEntries);
      setErrors(nextErrors);
      setTruncated(anyTruncated);
      setSelected(new Set(nextEntries.map((entry) => entry.id)));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [request]);

  const toggleEntry = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const allSelected = entries.length > 0 && selected.size === entries.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(entries.map((entry) => entry.id)));
  };

  const handleConfirm = () => {
    if (!request) {
      return;
    }

    const chosen = entries.filter((entry) => selected.has(entry.id));

    if (chosen.length === 0) {
      return;
    }

    addDownloads(
      chosen.map((entry) => ({ url: entry.url, title: entry.title })),
      request.outputFormat,
      request.quality,
    );
    processDownloadQueue();
    toast.success(`${chosen.length} download${chosen.length === 1 ? "" : "s"} queued`);
    closeMediaPicker();
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && closeMediaPicker()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select videos to download</DialogTitle>
          <DialogDescription>
            {loading
              ? "Fetching the video list..."
              : `${entries.length} video${entries.length === 1 ? "" : "s"} found${
                  truncated ? " (showing the first 500)" : ""
                }. Uncheck anything you want to skip.`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" />
            Reading playlist/channel info...
          </div>
        ) : (
          <div className="grid gap-3">
            {errors.length > 0 && (
              <div className="grid gap-1 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                {errors.map((error) => (
                  <div key={error.url} className="flex items-start gap-2 text-xs text-red-400">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    <span className="break-all">
                      {error.url}: {error.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {entries.length > 0 && (
              <>
                <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                  />
                  Select all
                  <Badge variant="secondary">
                    {selected.size}/{entries.length}
                  </Badge>
                </label>

                <ScrollArea className="h-80 rounded-lg border">
                  <div className="grid gap-1 p-2">
                    {entries.map((entry) => (
                      <label
                        key={entry.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={selected.has(entry.id)}
                          onCheckedChange={() => toggleEntry(entry.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{entry.title}</span>
                          {entry.uploader && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {entry.uploader}
                            </span>
                          )}
                        </span>
                        {formatDuration(entry.duration) && (
                          <Badge variant="outline" className="shrink-0 font-mono text-xs">
                            {formatDuration(entry.duration)}
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}

            {entries.length === 0 && errors.length === 0 && (
              <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
                No downloadable videos found for these URLs.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeMediaPicker}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={loading || selected.size === 0}>
            <Download />
            Download {selected.size > 0 ? selected.size : ""} selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
