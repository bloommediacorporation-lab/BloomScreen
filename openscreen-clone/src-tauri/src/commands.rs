use crate::state::{
    AppState, CursorTelemetryPoint, DesktopSource, RecordingSession, StoreRecordedSessionInput,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "macos")]
use std::ffi::c_void;

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy)]
struct CGPoint {
    x: f64,
    y: f64,
}

#[cfg(target_os = "macos")]
type CGEventRef = *mut c_void;

#[cfg(target_os = "macos")]
type CFTypeRef = *const c_void;

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn CGEventCreate(source: *const c_void) -> CGEventRef;
    fn CGEventGetLocation(event: CGEventRef) -> CGPoint;
    fn CFRelease(cf: CFTypeRef);
}

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
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct CursorTelemetryFile {
        samples: Vec<CursorTelemetryPoint>,
    }

    // Try to load from file first
    if let Some(ref vp) = video_path {
        let telemetry_path = format!("{}.cursor.json", vp);
        if let Ok(content) = fs::read_to_string(&telemetry_path) {
            if let Ok(parsed) = serde_json::from_str::<CursorTelemetryFile>(&content) {
                return Ok(serde_json::json!({
                    "success": true,
                    "samples": parsed.samples
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

// ─── Window Management Commands ───────────────────────────────────

#[tauri::command]
pub fn switch_to_editor(app: tauri::AppHandle) -> Result<Value, String> {
    // Close the main HUD window
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.close();
    }

    // Create editor window if it doesn't exist
    if app.get_webview_window("editor").is_none() {
        let url = if cfg!(debug_assertions) {
            WebviewUrl::External("http://localhost:5173/?windowType=editor".parse().unwrap())
        } else {
            WebviewUrl::App("/?windowType=editor".into())
        };

        WebviewWindowBuilder::new(&app, "editor", url)
            .title("BloomScreen Editor")
            .inner_size(1280.0, 800.0)
            .center()
            .decorations(true)
            .build()
            .map_err(|e| e.to_string())?;
    } else {
        // Editor exists, just show it
        if let Some(editor_win) = app.get_webview_window("editor") {
            let _ = editor_win.show();
            let _ = editor_win.set_focus();
        }
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn switch_to_hud(app: tauri::AppHandle) -> Result<Value, String> {
    // Close the editor window
    if let Some(editor_win) = app.get_webview_window("editor") {
        let _ = editor_win.close();
    }

    // Show the main HUD window
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.show();
        let _ = main_win.set_focus();
    } else {
        // Recreate if somehow closed
        let url = if cfg!(debug_assertions) {
            WebviewUrl::External("http://localhost:5173/?windowType=hud-overlay".parse().unwrap())
        } else {
            WebviewUrl::App("/?windowType=hud-overlay".into())
        };

        WebviewWindowBuilder::new(&app, "main", url)
            .title("BloomScreen")
            .inner_size(800.0, 80.0)
            .decorations(false)
            .always_on_top(true)
            .center()
            .build()
            .map_err(|e| e.to_string())?;
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn open_source_selector_window(app: tauri::AppHandle) -> Result<Value, String> {
    if app.get_webview_window("source-selector").is_some() {
        if let Some(win) = app.get_webview_window("source-selector") {
            let _ = win.show();
            let _ = win.set_focus();
        }
        return Ok(serde_json::json!({ "success": true }));
    }

    let url = if cfg!(debug_assertions) {
        WebviewUrl::External("http://localhost:5173/?windowType=source-selector".parse().unwrap())
    } else {
        WebviewUrl::App("/?windowType=source-selector".into())
    };

    WebviewWindowBuilder::new(&app, "source-selector", url)
        .title("Select Source")
        .inner_size(480.0, 400.0)
        .center()
        .decorations(true)
        .always_on_top(true)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn start_new_recording_window(app: tauri::AppHandle) -> Result<Value, String> {
    // Reset the main window state and ensure it's visible
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.show();
        let _ = main_win.set_focus();
    }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn hud_overlay_hide(app: tauri::AppHandle) -> Result<Value, String> {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.hide();
    }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn hud_overlay_close(app: tauri::AppHandle) -> Result<Value, String> {
    app.exit(0);
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn window_minimize(app: tauri::AppHandle) -> Result<Value, String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.minimize();
    }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn window_maximize(app: tauri::AppHandle) -> Result<Value, String> {
    if let Some(win) = app.get_webview_window("main") {
                let is_max = win.is_maximized().unwrap_or(false);
        if is_max { let _ = win.unmaximize(); } else { let _ = win.maximize(); }
    }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn window_close(app: tauri::AppHandle) -> Result<Value, String> {
    app.exit(0);
    Ok(serde_json::json!({ "success": true }))
}

// ─── Native Screen Recording Commands (macOS) ──────────────────

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

static NATIVE_RECORDING_ACTIVE: AtomicBool = AtomicBool::new(false);
static NATIVE_RECORDING_THREAD: LazyLock<Mutex<Option<std::thread::JoinHandle<Result<(), String>>>>> =
    LazyLock::new(|| Mutex::new(None));
static NATIVE_RECORDING_OUTPUT_PATH: LazyLock<Mutex<Option<String>>> =
    LazyLock::new(|| Mutex::new(None));

fn get_monitor_bounds(monitor: &xcap::Monitor) -> Option<(f64, f64, f64, f64)> {
    Some((
        monitor.x().ok()? as f64,
        monitor.y().ok()? as f64,
        monitor.width().ok()? as f64,
        monitor.height().ok()? as f64,
    ))
}

fn get_monitor_for_recording() -> Result<xcap::Monitor, String> {
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;

    if let Some((cursor_x, cursor_y)) = get_global_cursor_position() {
        if let Ok(monitor) = xcap::Monitor::from_point(cursor_x as i32, cursor_y as i32) {
            return Ok(monitor);
        }
    }

    if let Some(primary) = monitors
        .iter()
        .find(|monitor| monitor.is_primary().unwrap_or(false))
        .cloned()
    {
        return Ok(primary);
    }

    monitors.into_iter().next().ok_or("No monitor".to_string())
}

#[cfg(target_os = "macos")]
fn get_global_cursor_position() -> Option<(f64, f64)> {
    unsafe {
        let event = CGEventCreate(std::ptr::null());
        if event.is_null() {
            return None;
        }

        let location = CGEventGetLocation(event);
        CFRelease(event as CFTypeRef);
        Some((location.x, location.y))
    }
}

#[cfg(not(target_os = "macos"))]
fn get_global_cursor_position() -> Option<(f64, f64)> {
    None
}

fn capture_cursor_sample(
    samples: &mut Vec<CursorTelemetryPoint>,
    recording_start: Instant,
    display_bounds: Option<(f64, f64, f64, f64)>,
) {
    let Some((display_x, display_y, display_width, display_height)) = display_bounds else {
        return;
    };
    let Some((cursor_x, cursor_y)) = get_global_cursor_position() else {
        return;
    };

    if display_width <= 0.0 || display_height <= 0.0 {
        return;
    }

    let normalized_x = (cursor_x - display_x) / display_width;
    let normalized_y = (cursor_y - display_y) / display_height;

    if !(0.0..=1.0).contains(&normalized_x) || !(0.0..=1.0).contains(&normalized_y) {
        return;
    }

    samples.push(CursorTelemetryPoint {
        time_ms: recording_start.elapsed().as_millis() as i64,
        cx: normalized_x,
        cy: normalized_y,
    });
}

/// Start native screen recording using frame capture + ffmpeg encoding
#[tauri::command]
pub async fn native_start_recording(
    state: State<'_, AppState>,
    _app: tauri::AppHandle,
) -> Result<Value, String> {
    if NATIVE_RECORDING_ACTIVE.load(Ordering::SeqCst) {
        return Err("Already recording".to_string());
    }

    NATIVE_RECORDING_ACTIVE.store(true, Ordering::SeqCst);
    *state.recording_active.lock().unwrap() = true;
    state.cursor_samples.lock().unwrap().clear();

    let recordings_dir = AppState::recordings_dir();
    fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;
    let output_path = recordings_dir
        .join(format!("recording-{}.mp4", chrono::Utc::now().timestamp_millis()))
        .to_string_lossy()
        .to_string();

    log::info!("Starting native recording -> {}", output_path);

    // Spawn recording in background thread
    let output_clone = output_path.clone();
    *NATIVE_RECORDING_OUTPUT_PATH.lock().unwrap() = Some(output_path.clone());

    let handle = std::thread::spawn(move || {
        match run_frame_capture(&output_clone) {
            Ok(_) => {
                log::info!("Recording completed: {}", output_clone);
                Ok(())
            }
            Err(e) => {
                log::error!("Recording error: {}", e);
                Err(e)
            }
        }
    });
    *NATIVE_RECORDING_THREAD.lock().unwrap() = Some(handle);

    Ok(serde_json::json!({
        "success": true,
        "outputPath": output_path
    }))
}

fn run_frame_capture(
    output_path: &str,
) -> Result<(), String> {
    use ffmpeg_sidecar::command::FfmpegCommand;
    use std::io::Write;
    use std::sync::mpsc::RecvTimeoutError;

    let fps = 60;
    let frame_interval = Duration::from_secs_f64(1.0 / fps as f64);
    let monitor = get_monitor_for_recording()?;
    let monitor_name = monitor
        .name()
        .unwrap_or_else(|_| "Unknown monitor".to_string());
    let monitor_bounds = get_monitor_bounds(&monitor);

    let (video_recorder, receiver) = monitor
        .video_recorder()
        .map_err(|e| format!("Video recorder init failed: {}", e))?;

    video_recorder
        .start()
        .map_err(|e| format!("Video recorder start failed: {}", e))?;

    let first_frame = match receiver.recv_timeout(Duration::from_secs(3)) {
        Ok(frame) => frame,
        Err(err) => {
            let _ = video_recorder.stop();
            return Err(format!("Initial video frame capture failed: {}", err));
        }
    };

    let width = first_frame.width as usize;
    let height = first_frame.height as usize;
    let expected_raw_len = width
        .checked_mul(height)
        .and_then(|value| value.checked_mul(4))
        .ok_or("Frame dimensions overflow")?;

    log::info!(
        "Native recording frame size: {}x{} on {} -> {}",
        width,
        height,
        monitor_name,
        output_path
    );

    let mut ffmpeg = FfmpegCommand::new()
        .args([
            "-y",
            "-f", "rawvideo",
            "-pix_fmt", "bgra",
            "-s", &format!("{}x{}", width, height),
            "-r", &fps.to_string(),
            "-i", "pipe:0",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            output_path,
        ])
        .spawn()
        .map_err(|e| format!("FFmpeg spawn failed: {}", e))?;

    let mut stdin = ffmpeg
        .take_stdin()
        .ok_or("Failed to acquire FFmpeg stdin")?;

    let recording_start = Instant::now();
    let mut next_frame_at = recording_start;
    let mut frames_written: u64 = 0;
    let mut capture_count: u64 = 1;
    let mut last_frame = first_frame.raw;
    let mut cursor_samples: Vec<CursorTelemetryPoint> = Vec::new();
    let display_bounds = monitor_bounds;

    if last_frame.len() != expected_raw_len {
        let _ = video_recorder.stop();
        return Err(format!(
            "Initial frame buffer size mismatch: got {} bytes, expected {} for {}x{} BGRA",
            last_frame.len(),
            expected_raw_len,
            width,
            height
        ));
    }

    let mut write_frame = |frame: &[u8]| -> Result<(), String> {
        stdin
            .write_all(frame)
            .map_err(|e| format!("FFmpeg write error: {}", e))?;
        frames_written += 1;

        capture_cursor_sample(&mut cursor_samples, recording_start, display_bounds);

        Ok(())
    };

    while NATIVE_RECORDING_ACTIVE.load(Ordering::SeqCst) {
        let now = Instant::now();

        while now >= next_frame_at {
            write_frame(&last_frame)?;
            next_frame_at += frame_interval;
        }

        let wait_duration = next_frame_at.saturating_duration_since(Instant::now());
        match receiver.recv_timeout(wait_duration) {
            Ok(frame) => {
                if frame.raw.len() != expected_raw_len {
                    let _ = video_recorder.stop();
                    return Err(format!(
                        "Frame buffer size mismatch: got {} bytes, expected {} for {}x{} BGRA",
                        frame.raw.len(),
                        expected_raw_len,
                        width,
                        height
                    ));
                }

                last_frame = frame.raw;
                capture_count += 1;
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => {
                let _ = video_recorder.stop();
                return Err("Video recorder disconnected unexpectedly".to_string());
            }
        }
    }

    let _ = video_recorder.stop();

    while let Ok(frame) = receiver.try_recv() {
        if frame.raw.len() == expected_rgba_len {
            last_frame = frame.raw;
            capture_count += 1;
        }
    }

    while Instant::now() >= next_frame_at {
        write_frame(&last_frame)?;
        next_frame_at += frame_interval;
    }

    let telemetry_path = format!("{}.cursor.json", output_path);
    fs::write(
        &telemetry_path,
        serde_json::json!({ "samples": cursor_samples }).to_string(),
    )
    .map_err(|e| format!("Failed to write cursor telemetry: {}", e))?;

    log::info!(
        "Native recording summary: captured {} unique frames, wrote {} frames at {} fps over {:.2}s, cursor samples {}",
        capture_count,
        frames_written,
        fps,
        recording_start.elapsed().as_secs_f64(),
        cursor_samples.len()
    );

    // Graceful shutdown — close stdin to tell ffmpeg to finalize.
    let _ = stdin.flush();
    drop(stdin);
    drop(ffmpeg);
    Ok(())
}

/// Stop native screen recording
#[tauri::command]
pub async fn native_stop_recording(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Value, String> {
    if !NATIVE_RECORDING_ACTIVE.load(Ordering::SeqCst) {
        return Err("Not recording".to_string());
    }

    NATIVE_RECORDING_ACTIVE.store(false, Ordering::SeqCst);
    *state.recording_active.lock().unwrap() = false;

    let join_result = NATIVE_RECORDING_THREAD
        .lock()
        .unwrap()
        .take()
        .ok_or("Recording thread not found")?
        .join()
        .map_err(|_| "Recording thread panicked".to_string())?;

    if let Err(err) = join_result {
        *NATIVE_RECORDING_OUTPUT_PATH.lock().unwrap() = None;
        return Err(format!("Recording finalization failed: {}", err));
    }

    let path_str = NATIVE_RECORDING_OUTPUT_PATH
        .lock()
        .unwrap()
        .take()
        .ok_or("Recording output path missing")?;

    let metadata = fs::metadata(&path_str)
        .map_err(|e| format!("Recording file missing after stop: {}", e))?;

    if metadata.len() == 0 {
        return Err("Recording file is empty after stop".to_string());
    }

    {
        let session = RecordingSession {
            screen_video_path: path_str.clone(),
            webcam_video_path: None,
            created_at: chrono::Utc::now().timestamp_millis(),
        };
        *state.current_recording_session.lock().unwrap() = Some(session);
        *state.current_project_path.lock().unwrap() = None;
    }

    state.approve_path(&path_str);

    // Emit event to frontend so it can react
    let _ = tauri::Emitter::emit(&app, "recording-stopped", serde_json::json!({
        "success": true,
        "path": path_str
    }));

    Ok(serde_json::json!({
        "success": true,
        "path": path_str
    }))
}

/// Get native recording status
#[tauri::command]
pub fn native_recording_status() -> Result<Value, String> {
    Ok(serde_json::json!({
        "recording": NATIVE_RECORDING_ACTIVE.load(Ordering::SeqCst)
    }))
}
