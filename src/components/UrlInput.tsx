import { ClipboardEvent, FormEvent, useState } from "react";
import { Download, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { processDownloadQueue } from "@/lib/download-queue";
import { isCollectionUrl, parseUrls } from "@/lib/media-urls";
import { useAppStore } from "@/store/app-store";

const outputFormats = ["mp4", "mp3", "aac", "webm", "mkv", "flac", "wav", "jpeg", "png"];
const qualityOptions = ["best", "1080p", "720p", "480p", "audio"];

export function UrlInput() {
  const [url, setUrl] = useState("");
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [quality, setQuality] = useState("best");
  const addDownloads = useAppStore((state) => state.addDownloads);
  const openMediaPicker = useAppStore((state) => state.openMediaPicker);

  const submitUrls = (urls: string[]) => {
    if (urls.length === 0) {
      toast.error("Enter a valid URL");
      return;
    }

    setUrl("");

    // Playlists, channels, and multi-URL pastes go through the picker so the
    // user can review which videos get downloaded.
    if (urls.length > 1 || isCollectionUrl(urls[0])) {
      openMediaPicker({ urls, outputFormat, quality });
      return;
    }

    addDownloads([{ url: urls[0] }], outputFormat, quality);
    processDownloadQueue();
    toast.success("Download queued");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitUrls(parseUrls(url));
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const urls = parseUrls(event.clipboardData.getData("text"));

    // Single-line inputs mangle multi-line pastes, so handle them directly.
    if (urls.length > 1) {
      event.preventDefault();
      submitUrls(urls);
    }
  };

  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_140px_auto]">
          <div className="relative min-w-0">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onPaste={handlePaste}
              className="h-10 pl-9"
              placeholder="Paste video, playlist, or channel URLs"
            />
          </div>

          <Select value={outputFormat} onValueChange={setOutputFormat}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {outputFormats.map((format) => (
                <SelectItem key={format} value={format}>
                  {format.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={quality} onValueChange={setQuality}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {qualityOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "audio" ? "Audio only" : option.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="submit" className="h-10">
            <Download />
            Download
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
