import { useState } from "react";
import { CheckCircle2, DownloadCloud, FolderOpen, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { checkDependencies, installDependencies, type ToolDependencyStatus } from "@/lib/dependencies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAppStore, type ThemeMode } from "@/store/app-store";

type DependencyRowProps = {
  tool?: ToolDependencyStatus;
  fallbackName: string;
};

function DependencyRow({ tool, fallbackName }: DependencyRowProps) {
  const installed = tool?.installed ?? false;
  const path = tool?.path ?? "Not detected";
  const version = tool?.version ?? "Unknown version";

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            {installed ? (
              <CheckCircle2 className="size-4 text-emerald-400" />
            ) : (
              <TriangleAlert className="size-4 text-amber-400" />
            )}
            {tool?.name ?? fallbackName}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{version}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{path}</div>
        </div>
        <Badge variant={installed ? "secondary" : "outline"}>{installed ? "Ready" : "Missing"}</Badge>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const [busy, setBusy] = useState<"check" | "install" | null>(null);
  const settings = useAppStore((state) => state.settings);
  const dependencies = useAppStore((state) => state.dependencies);
  const setDependencies = useAppStore((state) => state.setDependencies);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const handleCheckDependencies = async () => {
    setBusy("check");

    try {
      const status = await checkDependencies();
      setDependencies(status);
      toast.success("Dependency check complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dependency check failed");
    } finally {
      setBusy(null);
    }
  };

  const handleInstallDependencies = async () => {
    setBusy("install");

    try {
      const status = await installDependencies();
      setDependencies(status);
      toast.success("Dependencies installed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dependency install failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Downloads</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label>Default output folder</Label>
            <div className="flex gap-2">
              <Input
                value={settings.defaultOutputFolder}
                onChange={(event) => updateSettings({ defaultOutputFolder: event.target.value })}
                placeholder="Choose output folder"
              />
              <Button type="button" size="icon" variant="outline" aria-label="Choose folder">
                <FolderOpen />
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Max concurrent downloads</Label>
            <Select
              value={String(settings.maxConcurrentDownloads)}
              onValueChange={(value) => updateSettings({ maxConcurrentDownloads: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Default video quality</Label>
            <Select
              value={settings.defaultVideoQuality}
              onValueChange={(value) =>
                updateSettings({ defaultVideoQuality: value as typeof settings.defaultVideoQuality })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best">Best</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="480p">480p</SelectItem>
                <SelectItem value="audio">Audio only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Auto-convert after download</Label>
              <p className="mt-1 text-xs text-muted-foreground">Use the selected default audio/video profile.</p>
            </div>
            <Switch
              checked={settings.autoConvertAfterDownload}
              onCheckedChange={(checked) => updateSettings({ autoConvertAfterDownload: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">App</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label>Default audio format</Label>
            <Select
              value={settings.defaultAudioFormat}
              onValueChange={(value) =>
                updateSettings({ defaultAudioFormat: value as typeof settings.defaultAudioFormat })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp3">MP3</SelectItem>
                <SelectItem value="aac">AAC</SelectItem>
                <SelectItem value="flac">FLAC</SelectItem>
                <SelectItem value="wav">WAV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Default audio bitrate</Label>
            <Select
              value={settings.defaultAudioBitrate}
              onValueChange={(value) =>
                updateSettings({ defaultAudioBitrate: value as typeof settings.defaultAudioBitrate })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="128k">128k</SelectItem>
                <SelectItem value="192k">192k</SelectItem>
                <SelectItem value="256k">256k</SelectItem>
                <SelectItem value="320k">320k</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Theme</Label>
            <Select
              value={settings.theme}
              onValueChange={(value) => updateSettings({ theme: value as ThemeMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid gap-3">
            <DependencyRow tool={dependencies?.ytDlp} fallbackName="yt-dlp" />
            <DependencyRow tool={dependencies?.ffmpeg} fallbackName="FFmpeg" />
          </div>

          {dependencies?.binDir && (
            <div className="truncate rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              Managed bin: {dependencies.binDir}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCheckDependencies}
              disabled={busy !== null}
            >
              <RefreshCw className={busy === "check" ? "animate-spin" : undefined} />
              Check
            </Button>
            <Button
              type="button"
              onClick={handleInstallDependencies}
              disabled={busy !== null}
            >
              <DownloadCloud className={busy === "install" ? "animate-pulse" : undefined} />
              Install/update
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
