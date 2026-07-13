use std::process::{Command, Stdio};

use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

use crate::utils::{hide_child_window, resolve_yt_dlp_path};

/// Hard cap on how many playlist/channel entries are listed, so huge channels
/// don't stall the picker for minutes.
const MAX_ENTRIES: usize = 500;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaEntry {
    id: String,
    title: String,
    url: String,
    duration: Option<f64>,
    uploader: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    kind: String,
    title: Option<String>,
    entries: Vec<MediaEntry>,
    truncated: bool,
}

#[tauri::command]
pub async fn fetch_media_info(app: AppHandle, url: String) -> Result<MediaInfo, String> {
    let yt_dlp_path = resolve_yt_dlp_path(&app)?;

    let output = tauri::async_runtime::spawn_blocking(move || {
        let mut command = Command::new(&yt_dlp_path);
        command
            .args([
                "--flat-playlist",
                "--dump-single-json",
                "--no-warnings",
                "--socket-timeout",
                "15",
                "--playlist-items",
                &format!("1:{MAX_ENTRIES}"),
                &url,
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        hide_child_window(&mut command);
        command.output()
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| format!("Failed to run yt-dlp: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let message = stderr
            .lines()
            .rev()
            .map(str::trim)
            .find(|line| !line.is_empty())
            .unwrap_or("yt-dlp could not read this URL")
            .to_string();
        return Err(message);
    }

    let json: Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Failed to parse yt-dlp output: {error}"))?;

    Ok(media_info_from_json(&json))
}

fn media_info_from_json(json: &Value) -> MediaInfo {
    if json["_type"].as_str() == Some("playlist") || json["entries"].is_array() {
        let mut entries = Vec::new();
        collect_entries(json, &mut entries);
        entries.dedup_by(|a, b| a.id == b.id);

        let truncated = entries.len() >= MAX_ENTRIES;
        entries.truncate(MAX_ENTRIES);

        MediaInfo {
            kind: "playlist".to_string(),
            title: non_empty_str(&json["title"]),
            entries,
            truncated,
        }
    } else {
        MediaInfo {
            kind: "single".to_string(),
            title: None,
            entries: entry_from_json(json).into_iter().collect(),
            truncated: false,
        }
    }
}

/// Recursively flattens playlist entries; channel roots can nest one playlist
/// per tab (Videos, Shorts, Live).
fn collect_entries(node: &Value, out: &mut Vec<MediaEntry>) {
    let Some(entries) = node["entries"].as_array() else {
        return;
    };

    for entry in entries {
        if out.len() >= MAX_ENTRIES {
            return;
        }

        if entry["_type"].as_str() == Some("playlist") || entry["entries"].is_array() {
            collect_entries(entry, out);
        } else if entry["ie_key"].as_str() == Some("YoutubeTab") {
            // A reference to another channel tab/playlist, not a video.
            continue;
        } else if let Some(media) = entry_from_json(entry) {
            out.push(media);
        }
    }
}

fn entry_from_json(entry: &Value) -> Option<MediaEntry> {
    let id = non_empty_str(&entry["id"])?;
    let url = non_empty_str(&entry["webpage_url"])
        .or_else(|| non_empty_str(&entry["url"]))
        .or_else(|| non_empty_str(&entry["original_url"]))?;
    let title = non_empty_str(&entry["title"]).unwrap_or_else(|| id.clone());
    let uploader = non_empty_str(&entry["uploader"])
        .or_else(|| non_empty_str(&entry["channel"]))
        .or_else(|| non_empty_str(&entry["uploader_id"]));

    Some(MediaEntry {
        id,
        title,
        url,
        duration: entry["duration"].as_f64(),
        uploader,
    })
}

fn non_empty_str(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}
