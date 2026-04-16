use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::path::PathBuf;
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSession {
    pub screen_video_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webcam_video_path: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreRecordedSessionInput {
    pub screen: VideoInput,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webcam: Option<VideoInput>,
    pub created_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInput {
    pub video_data: String, // base64 encoded
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopSource {
    pub id: String,
    pub name: String,
    #[serde(rename = "display_id")]
    pub display_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorTelemetryPoint {
    pub time_ms: i64,
    pub cx: f64,
    pub cy: f64,
}

pub struct AppState {
    pub selected_source: Mutex<Option<DesktopSource>>,
    pub current_recording_session: Mutex<Option<RecordingSession>>,
    pub current_project_path: Mutex<Option<String>>,
    pub approved_paths: Mutex<HashSet<String>>,
    pub recording_active: Mutex<bool>,
    pub cursor_samples: Mutex<Vec<CursorTelemetryPoint>>,
    #[allow(dead_code)]
    pub has_unsaved_changes: Mutex<bool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            selected_source: Mutex::new(None),
            current_recording_session: Mutex::new(None),
            current_project_path: Mutex::new(None),
            approved_paths: Mutex::new(HashSet::new()),
            recording_active: Mutex::new(false),
            cursor_samples: Mutex::new(Vec::new()),
            has_unsaved_changes: Mutex::new(false),
        }
    }
}

impl AppState {
    pub fn recordings_dir() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("bloomscreen")
            .join("recordings")
    }

    pub fn shortcuts_file() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("bloomscreen")
            .join("shortcuts.json")
    }

    pub fn approve_path(&self, path: &str) {
        let canonical = PathBuf::from(path);
        if let Ok(resolved) = std::fs::canonicalize(&canonical) {
            self.approved_paths.lock().unwrap().insert(resolved.to_string_lossy().to_string());
        } else {
            self.approved_paths.lock().unwrap().insert(path.to_string());
        }
    }

    pub fn is_path_allowed(&self, path: &str) -> bool {
        let recordings = Self::recordings_dir();
        if let Ok(resolved) = std::fs::canonicalize(path) {
            if resolved.starts_with(&recordings) {
                return true;
            }
            if self.approved_paths.lock().unwrap().contains(&resolved.to_string_lossy().to_string()) {
                return true;
            }
        }
        false
    }
}
