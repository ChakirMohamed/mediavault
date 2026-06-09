import { FormEvent, useState } from "react";
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
import { useAppStore } from "@/store/app-store";

const outputFormats = ["mp4", "mp3", "aac", "webm", "mkv", "flac", "wav", "jpeg", "png"];
const qualityOptions = ["best", "1080p", "720p", "480p", "audio"];

export function UrlInput() {
  const [url, setUrl] = useState("");
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [quality, setQuality] = useState("best");
  const addDownloadFromUrl = useAppStore((state) => state.addDownloadFromUrl);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      new URL(url);
    } catch {
      toast.error("Enter a valid URL");
      return;
    }

    addDownloadFromUrl(url, outputFormat, quality);
    toast.success("URL added");
    setUrl("");
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
              className="h-10 pl-9"
              placeholder="Paste media URL"
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
            Analyze
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
