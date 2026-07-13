mod download;
mod media;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(download::DownloadProcessMap::default())
        .invoke_handler(tauri::generate_handler![
            utils::check_dependencies,
            utils::install_dependencies,
            download::start_download,
            download::cancel_download,
            media::fetch_media_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
