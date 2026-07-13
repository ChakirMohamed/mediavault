import { useEffect, useMemo } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import {
  Archive,
  Download,
  HardDriveDownload,
  History,
  Settings,
  ShieldCheck,
  Wand2,
} from "lucide-react";

import { toast } from "sonner";

import { ConverterPanel } from "@/components/ConverterPanel";
import { DownloadQueue } from "@/components/DownloadQueue";
import { MediaPickerDialog } from "@/components/MediaPickerDialog";
import { ProgressCard } from "@/components/ProgressCard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { UrlInput } from "@/components/UrlInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDownloadEvents } from "@/hooks/useDownloadEvents";
import { useGlobalDrop } from "@/hooks/useGlobalDrop";
import { checkDependencies } from "@/lib/dependencies";
import { openDownloadLocation } from "@/lib/downloads";
import { cn } from "@/lib/utils";
import { useAppStore, type AppView, type DownloadItem } from "@/store/app-store";

const navItems: Array<{
  id: AppView;
  label: string;
  icon: typeof Download;
}> = [
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "converter", label: "Converter", icon: Wand2 },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

const titles: Record<AppView, { title: string; description: string }> = {
  downloads: {
    title: "Downloads",
    description: "Capture, inspect, and process media URLs.",
  },
  converter: {
    title: "Converter",
    description: "Prepare local audio, video, and image batches.",
  },
  history: {
    title: "History",
    description: "Review completed, failed, and cancelled jobs.",
  },
  settings: {
    title: "Settings",
    description: "Control defaults, dependencies, and appearance.",
  },
};

function HistoryView() {
  const downloads = useAppStore((state) => state.downloads);
  const historyItems = downloads.filter((download) =>
    ["completed", "failed", "cancelled"].includes(download.status),
  );
  const completedItems = historyItems.filter((download) => download.status === "completed");
  const failedItems = historyItems.filter((download) => download.status !== "completed");

  const handleOpenFolder = async (download: DownloadItem) => {
    try {
      await openDownloadLocation(download);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const renderHistory = (items: typeof historyItems, emptyLabel: string) =>
    items.length === 0 ? (
      <div className="flex min-h-96 items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Archive className="mx-auto size-8 text-muted-foreground" />
          <div className="mt-3 text-sm font-medium">{emptyLabel}</div>
          <div className="mt-1 text-xs text-muted-foreground">Finished jobs will appear here.</div>
        </div>
      </div>
    ) : (
      <div className="grid gap-3">
        {items.map((download) => (
          <ProgressCard
            key={download.id}
            title={download.title}
            subtitle={download.url}
            status={download.status}
            progress={download.progress}
            tone={download.status === "completed" ? "success" : "danger"}
            meta={[
              { label: "Source", value: download.source },
              { label: "Format", value: download.outputFormat.toUpperCase() },
              { label: "Quality", value: download.quality.toUpperCase() },
              { label: "Created", value: new Date(download.createdAt).toLocaleTimeString() },
            ]}
            actions={{
              onOpenFolder:
                download.status === "completed" && (download.filePath || download.outputDir)
                  ? () => handleOpenFolder(download)
                  : undefined,
            }}
          />
        ))}
      </div>
    );

  return (
    <Tabs defaultValue="all" className="grid gap-4">
      <TabsList className="w-fit">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="completed">Completed</TabsTrigger>
        <TabsTrigger value="failed">Failed</TabsTrigger>
      </TabsList>

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

function AppFrame() {
  useGlobalDrop();
  useDownloadEvents();

  const activeView = useAppStore((state) => state.activeView);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const settings = useAppStore((state) => state.settings);
  const downloads = useAppStore((state) => state.downloads);
  const conversions = useAppStore((state) => state.conversions);
  const dependencies = useAppStore((state) => state.dependencies);
  const setDependencies = useAppStore((state) => state.setDependencies);
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(settings.theme);
  }, [setTheme, settings.theme]);

  useEffect(() => {
    checkDependencies()
      .then((status) => {
        setDependencies(status);

        if (!status.ytDlp.installed || !status.ffmpeg.installed) {
          toast.warning("yt-dlp or FFmpeg is missing", {
            description: "Open Settings and use Install/update to download them.",
            action: {
              label: "Settings",
              onClick: () => useAppStore.getState().setActiveView("settings"),
            },
          });
        }
      })
      .catch((error) => console.error("Dependency check failed:", error));
  }, [setDependencies]);

  const currentTitle = titles[activeView];
  const activeCount = useMemo(
    () => downloads.filter((download) => !["completed", "failed", "cancelled"].includes(download.status)).length,
    [downloads],
  );

  return (
    <div className="flex h-screen min-h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-20 shrink-0 flex-col border-r bg-sidebar md:w-64">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
            <HardDriveDownload className="size-5 text-cyan-400" />
          </div>
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-sm font-semibold">MediaVault</div>
            <div className="truncate text-xs text-muted-foreground">Downloader studio</div>
          </div>
        </div>

        <Separator />

        <nav className="grid gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <Button
                key={item.id}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "h-10 justify-center gap-3 md:justify-start",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
                onClick={() => setActiveView(item.id)}
                aria-label={item.label}
              >
                <Icon />
                <span className="hidden md:inline">{item.label}</span>
              </Button>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-3 p-3">
          <div className="hidden rounded-lg border bg-background/70 p-3 md:block">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              Local engine
            </div>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
              <div className="flex justify-between gap-2">
                <span>yt-dlp</span>
                <span>{dependencies?.ytDlp.installed ? "ready" : "pending"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>FFmpeg</span>
                <span>{dependencies?.ffmpeg.installed ? "ready" : "pending"}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 lg:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{currentTitle.title}</h1>
            <p className="truncate text-xs text-muted-foreground">{currentTitle.description}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {activeCount} active
            </Badge>
            <Badge variant="outline" className="hidden sm:inline-flex">
              {conversions.length} conversions
            </Badge>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          {activeView === "downloads" && (
            <div className="grid gap-4">
              <UrlInput />
              <DownloadQueue />
            </div>
          )}
          {activeView === "converter" && <ConverterPanel />}
          {activeView === "history" && <HistoryView />}
          {activeView === "settings" && <SettingsPanel />}
        </div>
      </main>

      <MediaPickerDialog />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={250}>
        <AppFrame />
        <Toaster richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
