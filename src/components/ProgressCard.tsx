import {
  CheckCircle2,
  CircleX,
  Clock3,
  FolderOpen,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ProgressCardProps = {
  title: string;
  subtitle: string;
  status: string;
  progress: number;
  meta: Array<{ label: string; value: string }>;
  tone?: "neutral" | "active" | "success" | "danger" | "warning";
  actions?: {
    onResume?: () => void;
    onPause?: () => void;
    onOpenFolder?: () => void;
    onCancel?: () => void;
  };
};

const statusIcon = {
  neutral: Clock3,
  active: RotateCcw,
  success: CheckCircle2,
  danger: CircleX,
  warning: Pause,
};

const toneClasses = {
  neutral: "border-border bg-card",
  active: "border-cyan-500/30 bg-cyan-500/5",
  success: "border-emerald-500/30 bg-emerald-500/5",
  danger: "border-red-500/30 bg-red-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
};

export function ProgressCard({
  title,
  subtitle,
  status,
  progress,
  meta,
  tone = "neutral",
  actions,
}: ProgressCardProps) {
  const StatusIcon = statusIcon[tone];

  return (
    <Card className={cn("rounded-lg", toneClasses[tone])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-medium">{title}</h3>
              <Badge variant="secondary" className="shrink-0 gap-1">
                <StatusIcon className="size-3" />
                {status}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Resume"
                  disabled={!actions?.onResume}
                  onClick={actions?.onResume}
                >
                  <Play />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resume</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Pause"
                  disabled={!actions?.onPause}
                  onClick={actions?.onPause}
                >
                  <Pause />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pause</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Open folder"
                  disabled={!actions?.onOpenFolder}
                  onClick={actions?.onOpenFolder}
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
                  aria-label="Cancel"
                  disabled={!actions?.onCancel}
                  onClick={actions?.onCancel}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <Progress value={progress} />
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
            {meta.map((item) => (
              <div key={item.label} className="min-w-0">
                <div className="truncate">{item.label}</div>
                <div className="truncate font-medium text-foreground">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
