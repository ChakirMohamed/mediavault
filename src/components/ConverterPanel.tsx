import { ChangeEvent, useRef, useState } from "react";
import { FileVideo2, FolderPlus, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { ProgressCard } from "@/components/ProgressCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";

const targetFormats = ["mp4", "webm", "mkv", "avi", "mov", "mp3", "aac", "flac", "wav", "ogg", "jpeg", "png", "webp", "avif"];
const qualityPresets = ["low", "medium", "high", "lossless"];

export function ConverterPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [targetFormat, setTargetFormat] = useState("mp4");
  const [quality, setQuality] = useState("high");
  const conversions = useAppStore((state) => state.conversions);
  const addConversionFiles = useAppStore((state) => state.addConversionFiles);
  const updateConversionStatus = useAppStore((state) => state.updateConversionStatus);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    addConversionFiles(files.map((file) => ({ name: file.name })), targetFormat, quality);
    toast.success(`${files.length} file${files.length === 1 ? "" : "s"} added`);
    event.target.value = "";
  };

  return (
    <section className="grid min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="size-4" />
            Converter
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center transition hover:bg-muted/40"
          >
            <FolderPlus className="size-8 text-muted-foreground" />
            <span className="mt-3 text-sm font-medium">Add files</span>
            <span className="mt-1 text-xs text-muted-foreground">Drag files anywhere in the window.</span>
          </button>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFileChange} />

          <div className="grid gap-2">
            <Label>Target format</Label>
            <Select value={targetFormat} onValueChange={setTargetFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targetFormats.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Quality</Label>
            <Select value={quality} onValueChange={setQuality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qualityPresets.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button>
            <Wand2 />
            Convert queue
          </Button>
        </CardContent>
      </Card>

      <div className="min-h-0">
        {conversions.length === 0 ? (
          <div className="flex min-h-96 items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <FileVideo2 className="mx-auto size-8 text-muted-foreground" />
              <div className="mt-3 text-sm font-medium">No files queued</div>
              <div className="mt-1 text-xs text-muted-foreground">Add local media for conversion.</div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full pr-3">
            <div className="grid gap-3">
              {conversions.map((item) => (
                <ProgressCard
                  key={item.id}
                  title={item.fileName}
                  subtitle={item.inputPath}
                  status={item.status}
                  progress={item.progress}
                  meta={[
                    { label: "Format", value: item.outputFormat.toUpperCase() },
                    { label: "Quality", value: item.quality.toUpperCase() },
                    { label: "State", value: item.status },
                    { label: "Created", value: new Date(item.createdAt).toLocaleTimeString() },
                  ]}
                  actions={{
                    onResume:
                      item.status === "cancelled"
                        ? () => updateConversionStatus(item.id, "queued")
                        : undefined,
                    onCancel:
                      item.status === "queued" || item.status === "converting"
                        ? () => updateConversionStatus(item.id, "cancelled")
                        : undefined,
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </section>
  );
}
