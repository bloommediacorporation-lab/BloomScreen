#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // File system
            commands::store_recorded_video,
            commands::store_recorded_session,
            commands::read_binary_file,
            commands::save_exported_video,
            commands::save_project_file,
            commands::load_project_file,
            commands::load_current_project_file,
            // Dialogs
            commands::open_video_file_picker,
            commands::reveal_in_folder,
            // State
            commands::set_current_video_path,
            commands::get_current_video_path,
            commands::set_current_recording_session,
            commands::get_current_recording_session,
            commands::clear_current_video_path,
            commands::get_platform,
            commands::get_shortcuts,
            commands::save_shortcuts,
            commands::get_asset_base_path,
            commands::open_external_url,
            // Recording
            commands::set_recording_state,
            commands::get_cursor_telemetry,
            // Screen capture
            commands::get_sources,
            commands::select_source,
            commands::get_selected_source,
            commands::request_camera_access,
            // Window management
            commands::switch_to_editor,
            commands::switch_to_hud,
            commands::open_source_selector_window,
            commands::start_new_recording_window,
            commands::hud_overlay_hide,
            commands::hud_overlay_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
