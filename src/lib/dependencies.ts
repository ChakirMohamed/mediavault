import { invoke } from "@tauri-apps/api/core";

export type ToolDependencyStatus = {
  name: string;
  installed: boolean;
  managed: boolean;
  path: string | null;
  version: string | null;
};

export type DependencyStatus = {
  ytDlp: ToolDependencyStatus;
  ffmpeg: ToolDependencyStatus;
  binDir: string;
};

export async function checkDependencies() {
  return invoke<DependencyStatus>("check_dependencies");
}

export async function installDependencies() {
  return invoke<DependencyStatus>("install_dependencies");
}
