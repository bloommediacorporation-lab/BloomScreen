use crate::state::{AppState, DesktopSource, RecordingSession, StoreRecordedSessionInput};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

// ─── File System Commands ───────────────────────────────────────

#[tauri::command]
pub async fn store_recorded_video(
    state: State<'_, AppState>,
    video_data: String, // base64
    file_name: String,
) -> Result<Value, String> {
    let recordings_dir = AppState::recordings_dir();
    fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;

    let sanitized = Path::new(&file_name)
        .file_name()
        .ok_or("Invalid file name")?
        .to_string_lossy()
        .to_string();

    let output_path = recordings_dir.join(&sanitized);
    let decoded = BASE64.decode(&video_data).map_err(|e| e.to_string())?;
    fs::write(&output_path, decoded).map_err(|e| e.to_string())?;

    let session = RecordingSession {
        screen_video_path: output_path.to_string_lossy().to_string(),
        webcam_video_path: None,
        created_at: chrono::Utc::now().timestamp_millis(),
    };
    *state.current_recording_session.lock().unwrap() = Some(session.clone());
    *state.current_project_path.lock().unwrap() = None;

    Ok(serde_json::json!({
        "success": true,
        "path": output_path.to_string_lossy().to_string(),
        "message": "Video stored successfully"
    }))
}

#[tauri::command]
pub async fn store_recorded_session(
    state: State<'_, AppState>,
    payload: StoreRecordedSessionInput,
) -> Result<Value, String> {
    let recordings_dir = AppState::recordings_dir();
    fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;

    let screen_path = recordings_dir.join(
        Path::new(&payload.screen.file_name)
            .file_name()
            .ok_or("Invalid screen file name")?,
    );
    let decoded = BASE64.decode(&payload.screen.video_data).map_err(|e| e.to_string())?;
    fs::write(&screen_path, decoded).map_err(|e| e.to_string())?;

    let mut webcam_path: Option<String> = None;
    if let Some(ref webcam) = payload.webcam {
        let wp = recordings_dir.join(
            Path::new(&webcam.file_name)
                .file_name()
                .ok_or("Invalid webcam file name")?,
        );
        let decoded = BASE64.decode(&webcam.video_data).map_err(|e| e.to_string())?;
        fs::write(&wp, decoded).map_err(|e| e.to_string())?;
        webcam_path = Some(wp.to_string_lossy().to_string());
    }

    let created_at = payload.created_at.unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

    let session = RecordingSession {
        screen_video_path: screen_path.to_string_lossy().to_string(),
        webcam_video_path: webcam_path,
        created_at,
    };

    // Save session manifest
    let base_name = screen_path.file_stem().unwrap().to_string_lossy();
    let session_suffix = if base_name.ends_with("-webcam") {
        &base_name[..base_name.len() - 7]
    } else {
        &base_name
    };
    let manifest_path = recordings_dir.join(format!("{}.session.json", session_suffix));
    fs::write(&manifest_path, serde_json::to_string_pretty(&session).unwrap())
        .map_err(|e| e.to_string())?;

    *state.current_recording_session.lock().unwrap() = Some(session.clone());
    *state.current_project_path.lock().unwrap() = None;

    Ok(serde_json::json!({
        "success": true,
        "path": screen_path.to_string_lossy().to_string(),
        "message": "Recording session stored successfully"
    }))
}

#[tauri::command]
pub async fn read_binary_file(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<Value, String> {
    if !state.is_path_allowed(&file_path) {
        return Err("Access denied: path outside allowed directories".into());
    }

    match fs::read(&file_path) {
        Ok(data) => {
            let encoded = BASE64.encode(&data);
            Ok(serde_json::json!({
                "success": true,
                "data": encoded,
                "path": file_path
            }))
        }
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

#[tauri::command]
pub async fn save_exported_video(
    app: tauri::AppHandle,
    video_data: String, // base64
    file_name: String,
) -> Result<Value, String> {
    use tauri_plugin_dialog::DialogExt;
    let is_gif = file_name.to_lowercase().ends_with(".gif");
    let ext = if is_gif { "gif" } else { "mp4" };

    let result = app.dialog()
        .file()
        .add_filter(if is_gif { "GIF Image" } else { "MP4 Video" }, &[ext])
        .set_file_name(&file_name)
        .blocking_save_file();

    match result {
        Some(path) => {
            let path_str = path.to_string();
            let decoded = BASE64.decode(&video_data).map_err(|e| e.to_string())?;
            fs::write(&path_str, decoded).map_err(|e| e.to_string())?;
            Ok(serde_json::json!({
                "success": true,
                "path": path_str,
                "message": "Video exported successfully"
            }))
        }
        None => Ok(serde_json::json!({
            "success": false,
            "canceled": true,
            "message": "Export canceled"
        })),
    }
}

// PathBuf already imported above

#[tauri::command]
pub async fn save_project_file(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    project_data: Value,
    suggested_name: Option<String>,
    existing_project_path: Option<String>,
) -> Result<Value, String> {
    // If existing trusted path, save directly
    if let Some(ref existing) = existing_project_path {
        let current = state.current_project_path.lock().unwrap();
        if let Some(ref cp) = *current {
            if cp == existing {
                drop(current);
                fs::write(existing, serde_json::to_string_pretty(&project_data).unwrap())
                    .map_err(|e| e.to_string())?;
                *state.current_project_path.lock().unwrap() = Some(existing.clone());
                return Ok(serde_json::json!({
                    "success": true,
                    "path": existing,
                    "message": "Project saved successfully"
                }));
            }
        }
    }

    let safe_name = suggested_name
        .unwrap_or_else(|| format!("project-{}", chrono::Utc::now().timestamp()))
        .replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let default_name = if safe_name.ends_with(".openscreen") {
        safe_name
    } else {
        format!("{}.openscreen", safe_name)
    };

    use tauri_plugin_dialog::DialogExt;
    let result = app.dialog()
        .file()
        .add_filter("Openscreen Project", &["openscreen"])
        .add_filter("JSON", &["json"])
        .set_file_name(&default_name)
        .blocking_save_file();

    match result {
        Some(path) => {
            let path_str = path.to_string();
            fs::write(&path_str, serde_json::to_string_pretty(&project_data).unwrap())
                .map_err(|e| e.to_string())?;
            *state.current_project_path.lock().unwrap() = Some(path_str.clone());
            Ok(serde_json::json!({
                "success": true,
                "path": path_str,
                "message": "Project saved successfully"
            }))
        }
        None => Ok(serde_json::json!({
            "success": false,
            "canceled": true,
            "message": "Save project canceled"
        })),
    }
}

#[tauri::command]
pub async fn load_project_file(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Value, String> {
    use tauri_plugin_dialog::DialogExt;
    let result = app.dialog()
        .file()
        .add_filter("Openscreen Project", &["openscreen"])
        .add_filter("JSON", &["json"])
        .blocking_pick_file();

    match result {
        Some(path) => {
            let path_str = path.to_string();
            let content = fs::read_to_string(&path_str).map_err(|e| e.to_string())?;
            let project: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
            state.approve_path(&path_str);
            *state.current_project_path.lock().unwrap() = Some(path_str.clone());
            Ok(serde_json::json!({
                "success": true,
                "path": path_str,
                "project": project
            }))
        }
        None => Ok(serde_json::json!({
            "success": false,
            "canceled": true,
            "message": "Open project canceled"
        })),
    }
}

#[tauri::command]
pub async fn load_current_project_file(state: State<'_, AppState>) -> Result<Value, String> {
    let current = state.current_project_path.lock().unwrap().clone();
    match current {
        Some(path) => {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let project: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
            Ok(serde_json::json!({
                "success": true,
                "path": path,
                "project": project
            }))
        }
        None => Ok(serde_json::json!({
            "success": false,
            "message": "No active project"
        })),
    }
}

// ─── Dialog Commands ────────────────────────────────────────────

#[tauri::command]
pub async fn open_video_file_picker(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Value, String> {
    use tauri_plugin_dialog::DialogExt;
    let result = app.dialog()
        .file()
        .add_filter("Video Files", &["webm", "mp4", "mov", "avi", "mkv"])
        .blocking_pick_file();

    match result {
        Some(path) => {
            let path_str = path.to_string();
            state.approve_path(&path_str);
            *state.current_project_path.lock().unwrap() = None;
            Ok(serde_json::json!({
                "success": true,
                "path": path_str
            }))
        }
        None => Ok(serde_json::json!({
            "success": false,
            "canceled": true
        })),
    }
}

#[tauri::command]
pub async fn reveal_in_folder(file_path: String) -> Result<Value, String> {
    // Use macOS open -R to reveal in Finder
    let output = std::process::Command::new("open")
        .arg("-R")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(serde_json::json!({ "success": true }))
    } else {
        // Fallback: open parent directory
        if let Some(parent) = Path::new(&file_path).parent() {
            std::process::Command::new("open")
                .arg(parent)
                .output()
                .map_err(|e| e.to_string())?;
        }
        Ok(serde_json::json!({
            "success": true,
            "message": "Could not reveal item, but opened directory."
        }))
    }
}

// ─── State Commands ─────────────────────────────────────────────

#[tauri::command]
pub async fn set_current_video_path(
    state: State<'_, AppState>,
    path: String,
) -> Result<Value, String> {
    if !state.is_path_allowed(&path) {
        return Err("Video path has not been approved".into());
    }
    state.approve_path(&path);

    // Try to load associated recording session
    let session = load_session_for_video(&path);
    if let Some(s) = &session {
        state.approve_path(&s.screen_video_path);
        if let Some(ref wp) = s.webcam_video_path {
            state.approve_path(wp);
        }
    }

    *state.current_recording_session.lock().unwrap() = session.or_else(|| {
        Some(RecordingSession {
            screen_video_path: path.clone(),
            webcam_video_path: None,
            created_at: chrono::Utc::now().timestamp_millis(),
        })
    });
    *state.current_project_path.lock().unwrap() = None;

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn get_current_video_path(state: State<'_, AppState>) -> Result<Value, String> {
    let session = state.current_recording_session.lock().unwrap();
    match &*session {
        Some(s) => Ok(serde_json::json!({
            "success": true,
            "path": s.screen_video_path
        })),
        None => Ok(serde_json::json!({ "success": false })),
    }
}

#[tauri::command]
pub async fn set_current_recording_session(
    state: State<'_, AppState>,
    session: Option<RecordingSession>,
) -> Result<Value, String> {
    *state.current_recording_session.lock().unwrap() = session.clone();
    *state.current_project_path.lock().unwrap() = None;
    Ok(serde_json::json!({
        "success": true,
        "session": session
    }))
}

#[tauri::command]
pub async fn get_current_recording_session(state: State<'_, AppState>) -> Result<Value, String> {
    let session = state.current_recording_session.lock().unwrap();
    match &*session {
        Some(s) => Ok(serde_json::json!({
            "success": true,
            "session": s
        })),
        None => Ok(serde_json::json!({ "success": false })),
    }
}

#[tauri::command]
pub async fn clear_current_video_path(state: State<'_, AppState>) -> Result<Value, String> {
    *state.current_recording_session.lock().unwrap() = None;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn get_platform() -> Result<String, String> {
    Ok(std::env::consts::OS.to_string())
}

#[tauri::command]
pub async fn get_shortcuts() -> Result<Value, String> {
    let path = AppState::shortcuts_file();
    match fs::read_to_string(&path) {
        Ok(content) => Ok(serde_json::from_str(&content).unwrap_or(Value::Null)),
        Err(_) => Ok(Value::Null),
    }
}

#[tauri::command]
pub async fn save_shortcuts(shortcuts: Value) -> Result<Value, String> {
    let path = AppState::shortcuts_file();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, serde_json::to_string_pretty(&shortcuts).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn get_asset_base_path() -> Result<String, String> {
    // In Tauri, assets are accessed differently
    Ok("".to_string())
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<Value, String> {
    open::that(&url).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

// ─── Recording Commands ─────────────────────────────────────────

#[tauri::command]
pub async fn set_recording_state(
    state: State<'_, AppState>,
    recording: bool,
) -> Result<Value, String> {
    *state.recording_active.lock().unwrap() = recording;
    if recording {
        state.cursor_samples.lock().unwrap().clear();
    }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn get_cursor_telemetry(
    state: State<'_, AppState>,
    video_path: Option<String>,
) -> Result<Value, String> {
    // Try to load from file first
    if let Some(ref vp) = video_path {
        let telemetry_path = format!("{}.cursor.json", vp);
        if let Ok(content) = fs::read_to_string(&telemetry_path) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&content) {
                return Ok(serde_json::json!({
                    "success": true,
                    "samples": parsed.get("samples").cloned().unwrap_or(serde_json::json!([]))
                }));
            }
        }
    }

    let samples = state.cursor_samples.lock().unwrap().clone();
    Ok(serde_json::json!({
        "success": true,
        "samples": samples
    }))
}

// ─── Screen Capture Commands ────────────────────────────────────
// macOS ScreenCaptureKit integration placeholder
// Full implementation requires screencapturekit crate (requires macOS SDK headers)

#[tauri::command]
pub async fn get_sources() -> Result<Value, String> {
    // On macOS, we use CGWindowListCopyWindowInfo via the screencapturekit crate
    // For now, return empty sources with a note that screen capture needs the native crate
    Ok(serde_json::json!([]))
}

#[tauri::command]
pub async fn select_source(
    state: State<'_, AppState>,
    source: DesktopSource,
) -> Result<DesktopSource, String> {
    *state.selected_source.lock().unwrap() = Some(source.clone());
    Ok(source)
}

#[tauri::command]
pub async fn get_selected_source(state: State<'_, AppState>) -> Result<Value, String> {
    let source = state.selected_source.lock().unwrap();
    match &*source {
        Some(s) => Ok(serde_json::to_value(s).unwrap()),
        None => Ok(Value::Null),
    }
}

#[tauri::command]
pub async fn request_camera_access() -> Result<Value, String> {
    // macOS camera permission — in Tauri, this is handled via tauri-plugin-dialog
    // or via the AVCaptureDevice API in Swift/ObjC bridge
    Ok(serde_json::json!({
        "success": true,
        "granted": true,
        "status": "granted"
    }))
}

// ─── Helper Functions ───────────────────────────────────────────

fn load_session_for_video(video_path: &str) -> Option<RecordingSession> {
    let path = Path::new(video_path);
    let stem = path.file_stem()?.to_string_lossy();
    let base_name = if stem.ends_with("-webcam") {
        &stem[..stem.len() - 7]
    } else {
        &stem
    };
    let session_path = path.parent()?.join(format!("{}.session.json", base_name));

    let content = fs::read_to_string(&session_path).ok()?;
    let session: RecordingSession = serde_json::from_str(&content).ok()?;

    let target = std::fs::canonicalize(video_path).ok()?;
    let screen = std::fs::canonicalize(&session.screen_video_path).ok()?;

    if screen == target {
        return Some(session);
    }

    if let Some(ref wp) = session.webcam_video_path {
        let webcam = std::fs::canonicalize(wp).ok()?;
        if webcam == target {
            return Some(session);
        }
    }

    None
}
