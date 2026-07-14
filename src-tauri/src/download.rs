use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Read},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::utils::{hide_child_window, resolve_ffmpeg_dir, resolve_yt_dlp_path};

const TITLE_MARKER: &str = "__MEDIAVAULT_TITLE__:";
const FILEPATH_MARKER: &str = "__MEDIAVAULT_FILEPATH__:";
const AUDIO_ONLY_FORMATS: [&str; 4] = ["mp3", "aac", "flac", "wav"];

#[derive(Default)]
pub struct DownloadProcessMap(pub Mutex<HashMap<String, Arc<Mutex<Child>>>>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadInfoEvent {
    id: String,
    title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgressEvent {
    id: String,
    percent: f32,
    speed: Option<String>,
    eta: Option<String>,
    stage: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadCompleteEvent {
    id: String,
    output_path: Option<String>,
    output_dir: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadErrorEvent {
    id: String,
    message: String,
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    id: String,
    url: String,
    output_format: String,
    quality: String,
    output_dir: Option<String>,
) -> Result<(), String> {
    let yt_dlp_path = resolve_yt_dlp_path(&app)?;
    let ffmpeg_dir = resolve_ffmpeg_dir(&app)?;

    let output_dir = match output_dir.filter(|dir| !dir.trim().is_empty()) {
        Some(dir) => PathBuf::from(dir),
        None => app
            .path()
            .download_dir()
            .map_err(|error| error.to_string())?,
    };
    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;

    // Include the video id: distinct videos can share a title, and a
    // title-only template makes yt-dlp treat the second one as already
    // downloaded (reported complete without downloading anything).
    let output_template = output_dir.join("%(title)s [%(id)s].%(ext)s");
    let args = build_args(&url, &output_format, &quality, &output_template, &ffmpeg_dir);

    // yt-dlp only emits live [download] progress text when stdout and stderr
    // are the same stream (or a real terminal); with genuinely separate pipes
    // it withholds progress entirely. Merge both into one pipe, like `2>&1`.
    let (reader, writer) = os_pipe::pipe().map_err(|error| error.to_string())?;
    let writer_clone = writer.try_clone().map_err(|error| error.to_string())?;

    let mut command = Command::new(&yt_dlp_path);
    command
        .args(&args)
        .stdin(Stdio::null())
        .stdout(writer)
        .stderr(writer_clone);
    hide_child_window(&mut command);

    let child = command
        .spawn()
        .map_err(|error| format!("Failed to start yt-dlp: {error}"))?;

    let child = Arc::new(Mutex::new(child));
    app.state::<DownloadProcessMap>()
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .insert(id.clone(), child.clone());

    let last_output_path: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let recent_lines: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

    let app_handle = app.clone();
    let progress_id = id.clone();
    let output_path = last_output_path.clone();
    let recent_lines_clone = recent_lines.clone();
    let resolved_output_dir = output_dir.to_string_lossy().to_string();
    std::thread::spawn(move || {
        for line in read_lines_lossy(reader) {
            handle_output_line(&app_handle, &progress_id, &line, &output_path);

            let mut lines = recent_lines_clone.lock().unwrap();
            lines.push(line);
            if lines.len() > 20 {
                lines.remove(0);
            }
        }

        let exit_status = child.lock().unwrap().wait();

        app_handle
            .state::<DownloadProcessMap>()
            .0
            .lock()
            .unwrap()
            .remove(&progress_id);

        match exit_status {
            Ok(status) if status.success() => {
                let _ = app_handle.emit(
                    "download-complete",
                    DownloadCompleteEvent {
                        id: progress_id.clone(),
                        output_path: last_output_path.lock().unwrap().clone(),
                        output_dir: resolved_output_dir.clone(),
                    },
                );
            }
            Ok(_) => {
                let message = recent_lines
                    .lock()
                    .unwrap()
                    .iter()
                    .rev()
                    .find(|line| !line.trim().is_empty())
                    .cloned()
                    .unwrap_or_else(|| "yt-dlp exited with an error".to_string());
                let _ = app_handle.emit(
                    "download-error",
                    DownloadErrorEvent {
                        id: progress_id.clone(),
                        message,
                    },
                );
            }
            Err(error) => {
                let _ = app_handle.emit(
                    "download-error",
                    DownloadErrorEvent {
                        id: progress_id.clone(),
                        message: error.to_string(),
                    },
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(app: AppHandle, id: String) -> Result<(), String> {
    let child = app
        .state::<DownloadProcessMap>()
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .get(&id)
        .cloned();

    if let Some(child) = child {
        child
            .lock()
            .map_err(|error| error.to_string())?
            .kill()
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

/// Reads newline-terminated lines from a raw byte stream, lossily decoding
/// each as UTF-8 instead of silently dropping lines that aren't valid UTF-8
/// (which `BufRead::lines()` does), since child processes may emit output
/// in a non-UTF-8 locale encoding on Windows.
fn read_lines_lossy<R: Read>(reader: R) -> impl Iterator<Item = String> {
    let mut buffered = BufReader::new(reader);
    std::iter::from_fn(move || {
        let mut buf: Vec<u8> = Vec::new();
        match buffered.read_until(b'\n', &mut buf) {
            Ok(0) => None,
            Ok(_) => {
                while matches!(buf.last(), Some(b'\n') | Some(b'\r')) {
                    buf.pop();
                }
                Some(String::from_utf8_lossy(&buf).into_owned())
            }
            Err(_) => None,
        }
    })
}

fn handle_output_line(
    app_handle: &AppHandle,
    progress_id: &str,
    line: &str,
    last_output_path: &Arc<Mutex<Option<String>>>,
) {
    if let Some(title) = line.strip_prefix(TITLE_MARKER) {
        if !title.trim().is_empty() {
            let _ = app_handle.emit(
                "download-info",
                DownloadInfoEvent {
                    id: progress_id.to_string(),
                    title: title.trim().to_string(),
                },
            );
        }
        return;
    }

    if let Some(path) = line.strip_prefix(FILEPATH_MARKER) {
        *last_output_path.lock().unwrap() = Some(path.trim().to_string());
        return;
    }

    // When the file already exists, yt-dlp skips the download entirely and
    // the after_move print never fires; recover the path from the notice.
    if let Some(rest) = line.trim_start().strip_prefix("[download] ") {
        if let Some(path) = rest.trim_end().strip_suffix(" has already been downloaded") {
            *last_output_path.lock().unwrap() = Some(path.trim().to_string());
            return;
        }
    }

    if let Some(progress) = parse_progress_line(line) {
        let _ = app_handle.emit(
            "download-progress",
            DownloadProgressEvent {
                id: progress_id.to_string(),
                percent: progress.0,
                speed: progress.1,
                eta: progress.2,
                stage: stage_for_line(line),
            },
        );
    } else if let Some(stage) = stage_only(line) {
        let _ = app_handle.emit(
            "download-progress",
            DownloadProgressEvent {
                id: progress_id.to_string(),
                percent: -1.0,
                speed: None,
                eta: None,
                stage,
            },
        );
    }
}

fn build_args(
    url: &str,
    output_format: &str,
    quality: &str,
    output_template: &PathBuf,
    ffmpeg_dir: &PathBuf,
) -> Vec<String> {
    let mut args = vec![
        "--newline".to_string(),
        // --print implies --quiet, which would suppress the [download] progress
        // lines the UI parses; --progress forces them back on.
        "--progress".to_string(),
        "--no-playlist".to_string(),
        "--no-mtime".to_string(),
        "--continue".to_string(),
        "--ffmpeg-location".to_string(),
        ffmpeg_dir.to_string_lossy().to_string(),
        "-o".to_string(),
        output_template.to_string_lossy().to_string(),
        "--print".to_string(),
        format!("before_dl:{TITLE_MARKER}%(title)s"),
        "--print".to_string(),
        format!("after_move:{FILEPATH_MARKER}%(filepath)s"),
    ];

    if quality == "audio" || AUDIO_ONLY_FORMATS.contains(&output_format) {
        let audio_format = if AUDIO_ONLY_FORMATS.contains(&output_format) {
            output_format
        } else {
            "mp3"
        };

        args.push("-x".to_string());
        args.push("--audio-format".to_string());
        args.push(audio_format.to_string());
    } else {
        let format_selector = match quality {
            "1080p" => "bestvideo[height<=1080]+bestaudio/best[height<=1080]".to_string(),
            "720p" => "bestvideo[height<=720]+bestaudio/best[height<=720]".to_string(),
            "480p" => "bestvideo[height<=480]+bestaudio/best[height<=480]".to_string(),
            _ => "bestvideo+bestaudio/best".to_string(),
        };

        let container = match output_format {
            "mp4" | "webm" | "mkv" => output_format,
            _ => "mp4",
        };

        args.push("-f".to_string());
        args.push(format_selector);
        args.push("--merge-output-format".to_string());
        args.push(container.to_string());
    }

    args.push(url.to_string());
    args
}

/// Parses a yt-dlp `[download]` progress line into (percent, speed, eta).
fn parse_progress_line(line: &str) -> Option<(f32, Option<String>, Option<String>)> {
    if !line.trim_start().starts_with("[download]") {
        return None;
    }

    let tokens: Vec<&str> = line.split_whitespace().collect();
    let percent = tokens
        .iter()
        .find_map(|token| token.strip_suffix('%').and_then(|value| value.parse::<f32>().ok()))?;

    let speed = tokens
        .iter()
        .position(|&token| token == "at")
        .and_then(|index| tokens.get(index + 1))
        .map(|value| value.to_string());

    let eta = tokens
        .iter()
        .position(|&token| token == "ETA")
        .and_then(|index| tokens.get(index + 1))
        .map(|value| value.to_string());

    Some((percent, speed, eta))
}

fn stage_for_line(line: &str) -> String {
    let trimmed = line.trim_start();

    if trimmed.starts_with("[Merger]") {
        "merging".to_string()
    } else if trimmed.starts_with("[ExtractAudio]") || trimmed.starts_with("[ffmpeg]") {
        "converting".to_string()
    } else {
        "downloading".to_string()
    }
}

fn stage_only(line: &str) -> Option<String> {
    let trimmed = line.trim_start();

    if trimmed.starts_with("[Merger]") {
        Some("merging".to_string())
    } else if trimmed.starts_with("[ExtractAudio]") || trimmed.starts_with("[ffmpeg]") {
        Some("converting".to_string())
    } else {
        None
    }
}
