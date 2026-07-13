import { useEffect } from "react";
import { toast } from "sonner";

import { processDownloadQueue } from "@/lib/download-queue";
import { isCollectionUrl, parseUrls } from "@/lib/media-urls";
import { useAppStore } from "@/store/app-store";

export function useGlobalDrop() {
  const addDownloads = useAppStore((state) => state.addDownloads);
  const addConversionFiles = useAppStore((state) => state.addConversionFiles);
  const openMediaPicker = useAppStore((state) => state.openMediaPicker);
  const settings = useAppStore((state) => state.settings);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();

      const text = event.dataTransfer?.getData("text/plain").trim();
      const files = Array.from(event.dataTransfer?.files ?? []);

      if (text) {
        const urls = parseUrls(text);

        if (urls.length === 0) {
          toast.error("Dropped text is not a valid URL");
          return;
        }

        if (urls.length > 1 || isCollectionUrl(urls[0])) {
          openMediaPicker({
            urls,
            outputFormat: "mp4",
            quality: settings.defaultVideoQuality,
          });
          return;
        }

        addDownloads([{ url: urls[0] }], "mp4", settings.defaultVideoQuality);
        processDownloadQueue();
        toast.success("Download queued");
        return;
      }

      if (files.length > 0) {
        addConversionFiles(
          files.map((file) => ({
            name: file.name,
          })),
        );
        toast.success(`${files.length} file${files.length === 1 ? "" : "s"} added`);
      }
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [addConversionFiles, addDownloads, openMediaPicker, settings.defaultVideoQuality]);
}
