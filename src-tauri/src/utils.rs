use std::{
    env,
    fs::{self, File},
    io::{self, Cursor},
    path::{Path, PathBuf},
    process::Command,
};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

const YT_DLP_URL: &str = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
const FFMPEG_URL: &str = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    name: String,
    installed: bool,
    managed: bool,
    path: Option<String>,
    version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyStatus {
    yt_dlp: ToolStatus,
    ffmpeg: ToolStatus,
    bin_dir: String,
}

#[tauri::command]
pub async fn check_dependencies(app: AppHandle) -> Result<DependencyStatus, String> {
    dependency_status(&app).map_err(|error| error.to_string())
}

/// Resolves the yt-dlp executable path, preferring PATH then the managed bin dir.
pub fn resolve_yt_dlp_path(app: &AppHandle) -> Result<PathBuf, String> {
    let bin_dir = managed_bin_dir(app).map_err(|error| error.to_string())?;
    resolve_tool("yt-dlp", &["yt-dlp.exe", "yt-dlp"], &bin_dir)
        .path
        .map(PathBuf::from)
        .ok_or_else(|| "yt-dlp is not installed. Install dependencies from Settings first.".to_string())
}

/// Resolves the directory containing ffmpeg/ffprobe so it can be passed to yt-dlp via --ffmpeg-location.
pub fn resolve_ffmpeg_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let bin_dir = managed_bin_dir(app).map_err(|error| error.to_string())?;
    let ffmpeg_path = resolve_tool("FFmpeg", &["ffmpeg.exe", "ffmpeg"], &bin_dir)
        .path
        .map(PathBuf::from)
        .ok_or_else(|| "FFmpeg is not installed. Install dependencies from Settings first.".to_string())?;

    Ok(ffmpeg_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or(bin_dir))
}

#[tauri::command]
pub async fn install_dependencies(app: AppHandle) -> Result<DependencyStatus, String> {
    let bin_dir = managed_bin_dir(&app).map_err(|error| error.to_string())?;
    fs::create_dir_all(&bin_dir).map_err(|error| error.to_string())?;

    install_yt_dlp(&bin_dir).await?;
    install_ffmpeg(&bin_dir).await?;

    dependency_status(&app).map_err(|error| error.to_string())
}

fn dependency_status(app: &AppHandle) -> io::Result<DependencyStatus> {
    let bin_dir = managed_bin_dir(app)?;
    let yt_dlp = resolve_tool("yt-dlp", &["yt-dlp.exe", "yt-dlp"], &bin_dir);
    let ffmpeg = resolve_tool("FFmpeg", &["ffmpeg.exe", "ffmpeg"], &bin_dir);

    Ok(DependencyStatus {
        yt_dlp,
        ffmpeg,
        bin_dir: bin_dir.to_string_lossy().to_string(),
    })
}

fn managed_bin_dir(app: &AppHandle) -> io::Result<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("bin"))
        .map_err(|error| io::Error::new(io::ErrorKind::Other, error))
}

fn resolve_tool(display_name: &str, names: &[&str], managed_bin_dir: &Path) -> ToolStatus {
    let managed_path = names
        .iter()
        .map(|name| managed_bin_dir.join(name))
        .find(|path| path.is_file());

    let path = find_on_path(names).or(managed_path);
    let managed = path
        .as_ref()
        .is_some_and(|tool_path| tool_path.starts_with(managed_bin_dir));
    let version = path.as_ref().and_then(|tool_path| tool_version(display_name, tool_path));

    ToolStatus {
        name: display_name.to_string(),
        installed: path.is_some(),
        managed,
        path: path.map(|tool_path| tool_path.to_string_lossy().to_string()),
        version,
    }
}

fn find_on_path(names: &[&str]) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;

    env::split_paths(&path_var)
        .flat_map(|dir| names.iter().map(move |name| dir.join(name)))
        .find(|candidate| candidate.is_file())
}

fn tool_version(display_name: &str, path: &Path) -> Option<String> {
    let mut command = Command::new(path);

    if display_name == "FFmpeg" {
        command.arg("-version");
    } else {
        command.arg("--version");
    }

    hide_child_window(&mut command);

    let output = command.output().ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let text = if stdout.trim().is_empty() { stderr } else { stdout };

    text.lines().next().map(|line| line.trim().to_string())
}

async fn install_yt_dlp(bin_dir: &Path) -> Result<(), String> {
    let bytes = download_bytes(YT_DLP_URL).await?;
    let target = bin_dir.join("yt-dlp.exe");
    fs::write(target, bytes).map_err(|error| error.to_string())
}

async fn install_ffmpeg(bin_dir: &Path) -> Result<(), String> {
    let bytes = download_bytes(FFMPEG_URL).await?;
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|error| error.to_string())?;

    extract_zip_binary(&mut archive, "ffmpeg.exe", &bin_dir.join("ffmpeg.exe"))?;
    let _ = extract_zip_binary(&mut archive, "ffprobe.exe", &bin_dir.join("ffprobe.exe"));

    Ok(())
}

async fn download_bytes(url: &str) -> Result<Vec<u8>, String> {
    let response = reqwest::get(url).await.map_err(|error| error.to_string())?;
    let status = response.status();

    if !status.is_success() {
        return Err(format!("Download failed for {url}: HTTP {status}"));
    }

    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|error| error.to_string())
}

fn extract_zip_binary(
    archive: &mut ZipArchive<Cursor<Vec<u8>>>,
    binary_name: &str,
    destination: &Path,
) -> Result<(), String> {
    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|error| error.to_string())?;
        let normalized_name = file.name().replace('\\', "/");

        if !normalized_name.ends_with(&format!("/bin/{binary_name}")) {
            continue;
        }

        let mut output = File::create(destination).map_err(|error| error.to_string())?;
        io::copy(&mut file, &mut output).map_err(|error| error.to_string())?;
        return Ok(());
    }

    Err(format!("{binary_name} was not found in the downloaded archive"))
}

#[cfg(windows)]
pub(crate) fn hide_child_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
pub(crate) fn hide_child_window(_command: &mut Command) {}
