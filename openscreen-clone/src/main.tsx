import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "./contexts/I18nContext";
import "./index.css";

// Mock cursor telemetry generator (used in web dev mode)
function generateMockCursorTelemetry() {
  const samples = [];
  const durationMs = 120000;
  let cx = 0.5;
  let cy = 0.5;
  let isDwell = false;
  let phaseTime = 0;
  let phaseDuration = 2000;

  for (let timeMs = 0; timeMs < durationMs; timeMs += 30) {
    phaseTime += 30;
    if (phaseTime >= phaseDuration) {
      isDwell = !isDwell;
      phaseTime = 0;
      phaseDuration = isDwell ? (1000 + Math.random() * 2000) : (500 + Math.random() * 1000);
      if (!isDwell) {
        cx = 0.1 + Math.random() * 0.8;
        cy = 0.1 + Math.random() * 0.8;
      }
    }
    if (isDwell) {
      const jitterX = (Math.random() - 0.5) * 0.005;
      const jitterY = (Math.random() - 0.5) * 0.005;
      samples.push({ timeMs, cx: cx + jitterX, cy: cy + jitterY });
    } else {
      const currentSample = samples.length > 0 ? samples[samples.length - 1] : { cx: 0.5, cy: 0.5 };
      const dt = 30;
      const moveSpeed = 0.002;
      samples.push({
        timeMs,
        cx: currentSample.cx + (cx - currentSample.cx) * moveSpeed * dt,
        cy: currentSample.cy + (cy - currentSample.cy) * moveSpeed * dt,
      });
    }
  }
  return { success: true, samples };
}

// Tauri invoke helper
async function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<any> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd, args);
}

// Set up electronAPI bridge
if (typeof window !== 'undefined') {
  if ((window as any).__TAURI__) {
    // Running inside Tauri — bridge to Rust commands
    window.electronAPI = {
      getSources: async () => tauriInvoke("get_sources"),
      switchToEditor: async () => tauriInvoke("switch_to_editor"),
      switchToHud: async () => tauriInvoke("switch_to_hud"),
      startNewRecording: async () => tauriInvoke("start_new_recording_window"),
      openSourceSelector: async () => tauriInvoke("open_source_selector_window"),
      selectSource: async (source: any) => tauriInvoke("select_source", { source }),
      getSelectedSource: async () => tauriInvoke("get_selected_source"),
      requestCameraAccess: async () => tauriInvoke("request_camera_access"),
      storeRecordedVideo: async (videoData: ArrayBuffer, fileName: string) => {
        const bytes = new Uint8Array(videoData);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return tauriInvoke("store_recorded_video", { videoData: btoa(binary), fileName });
      },
      storeRecordedSession: async (payload: any) => {
        return tauriInvoke("store_recorded_session", { payload });
      },
      getRecordedVideoPath: async () => tauriInvoke("get_current_video_path"),
      getAssetBasePath: async () => tauriInvoke("get_asset_base_path"),
      setRecordingState: async (recording: boolean) => tauriInvoke("set_recording_state", { recording }),
      getCursorTelemetry: async (videoPath?: string) => tauriInvoke("get_cursor_telemetry", { videoPath }),
      onStopRecordingFromTray: (cb: () => void) => { return () => {}; },
      openExternalUrl: async (url: string) => tauriInvoke("open_external_url", { url }),
      saveExportedVideo: async (videoData: ArrayBuffer, fileName: string) => {
        const bytes = new Uint8Array(videoData);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return tauriInvoke("save_exported_video", { videoData: btoa(binary), fileName });
      },
      openVideoFilePicker: async () => tauriInvoke("open_video_file_picker"),
      setCurrentVideoPath: async (path: string) => tauriInvoke("set_current_video_path", { path }),
      setCurrentRecordingSession: async (session: any) => tauriInvoke("set_current_recording_session", { session }),
      getCurrentVideoPath: async () => tauriInvoke("get_current_video_path"),
      getCurrentRecordingSession: async () => tauriInvoke("get_current_recording_session"),
      clearCurrentVideoPath: async () => tauriInvoke("clear_current_video_path"),
      saveProjectFile: async (projectData: any, suggestedName?: string, existingProjectPath?: string) =>
        tauriInvoke("save_project_file", { projectData, suggestedName, existingProjectPath }),
      loadProjectFile: async () => tauriInvoke("load_project_file"),
      loadCurrentProjectFile: async () => tauriInvoke("load_current_project_file"),
      onMenuLoadProject: () => () => {},
      onMenuSaveProject: () => () => {},
      onMenuSaveProjectAs: () => () => {},
      setMicrophoneExpanded: () => {},
      setHasUnsavedChanges: () => {},
      onRequestSaveBeforeClose: () => () => {},
      setLocale: async () => {},
      hudOverlayHide: async () => tauriInvoke("hud_overlay_hide"),
      hudOverlayClose: async () => tauriInvoke("hud_overlay_close"),
    } as any;
  } else {
    // Running in browser — use mocks
    window.electronAPI = {
      getSources: async () => [],
      switchToEditor: async () => {},
      switchToHud: async () => {},
      startNewRecording: async () => ({ success: true }),
      openSourceSelector: async () => {},
      selectSource: async (source: any) => source,
      getSelectedSource: async () => null,
      requestCameraAccess: async () => ({ success: true, granted: true, status: 'granted' }),
      storeRecordedVideo: async () => ({ success: true }),
      storeRecordedSession: async () => ({ success: true }),
      getRecordedVideoPath: async () => ({ success: false, error: 'Web mock' }),
      getAssetBasePath: async () => '',
      setRecordingState: async () => {},
      getCursorTelemetry: async () => generateMockCursorTelemetry(),
      onStopRecordingFromTray: () => () => {},
      openExternalUrl: async () => ({ success: true }),
      saveExportedVideo: async () => ({ success: true }),
      openVideoFilePicker: async () => {
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'video/*,.webm,.mp4';
          input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) {
              const path = URL.createObjectURL(file);
              resolve({ success: true, path });
            } else {
              resolve({ success: false, canceled: true });
            }
          };
          input.click();
        });
      },
      setCurrentVideoPath: async () => ({ success: true }),
      setCurrentRecordingSession: async () => ({ success: true }),
      getCurrentVideoPath: async () => ({ success: false }),
      getCurrentRecordingSession: async () => ({ success: false }),
      clearCurrentVideoPath: async () => ({ success: true }),
      saveProjectFile: async () => ({ success: true }),
      loadProjectFile: async () => ({ success: false }),
      loadCurrentProjectFile: async () => ({ success: false }),
      onMenuLoadProject: () => () => {},
      onMenuSaveProject: () => () => {},
      onMenuSaveProjectAs: () => () => {},
      setMicrophoneExpanded: () => {},
      setHasUnsavedChanges: () => {},
      onRequestSaveBeforeClose: () => () => {},
      setLocale: async () => {},
    } as any;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<I18nProvider>
			<App />
		</I18nProvider>
	</React.StrictMode>,
);
