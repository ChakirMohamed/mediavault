import { useEffect } from "react";
import { toast } from "sonner";

import { useAppStore } from "@/store/app-store";

export function useGlobalDrop() {
  const addDownloadFromUrl = useAppStore((state) => state.addDownloadFromUrl);
  const addConversionFiles = useAppStore((state) => state.addConversionFiles);
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
        addDownloadFromUrl(text, "mp4", settings.defaultVideoQuality);
        toast.success("URL added");
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
  }, [addConversionFiles, addDownloadFromUrl, settings.defaultVideoQuality]);
}
