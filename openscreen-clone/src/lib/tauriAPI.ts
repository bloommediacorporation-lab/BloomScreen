// Tauri API bridge — replaces window.electronAPI with Tauri invoke calls
// When running in Tauri, uses @tauri-apps/api
// When running in browser (dev), falls back to mock implementations

type InvokeResult = Record<string, unknown>;

async function invoke(cmd: string, args?: Record<string, unknown>): Promise<InvokeResult> {
  if (window.__TAURI__) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke(cmd, args);
  }
  // Web fallback mock
  console.log(`[Tauri Mock] ${cmd}`, args);
  return { success: true } as InvokeResult;
}

// Helper: convert ArrayBuffer to base64 for Tauri commands that need it
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const tauriAPI = {
  // File system
  storeRecordedVideo: async (videoData: ArrayBuffer, fileName: string) => {
    return invoke("store_recorded_video", {
      videoData: arrayBufferToBase64(videoData),
      fileName,
    });
  },

  storeRecordedSession: async (payload: {
    screen: { videoData: ArrayBuffer; fileName: string };
    webcam?: { videoData: ArrayBuffer; fileName: string };
    createdAt?: number;
  }) => {
    return invoke("store_recorded_session", {
      payload: {
        screen: {
          videoData: arrayBufferToBase64(payload.screen.videoData),
          fileName: payload.screen.fileName,
        },
        webcam: payload.webcam
          ? {
              videoData: arrayBufferToBase64(payload.webcam.videoData),
              fileName: payload.webcam.fileName,
            }
          : undefined,
        createdAt: payload.createdAt,
      },
    });
  },

  readBinaryFile: async (filePath: string) => {
    const result = await invoke("read_binary_file", { filePath });
    // Convert base64 back to ArrayBuffer for compatibility
    if (result.data && typeof result.data === "string") {
      const binary = atob(result.data as string);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return { ...result, data: bytes.buffer };
    }
    return result;
  },

  saveExportedVideo: async (videoData: ArrayBuffer, fileName: string) => {
    return invoke("save_exported_video", {
      videoData: arrayBufferToBase64(videoData),
      fileName,
    });
  },

  saveProjectFile: async (
    projectData: unknown,
    suggestedName?: string,
    existingProjectPath?: string
  ) => {
    return invoke("save_project_file", {
      projectData,
      suggestedName,
      existingProjectPath,
    });
  },

  loadProjectFile: async () => {
    return invoke("load_project_file");
  },

  loadCurrentProjectFile: async () => {
    return invoke("load_current_project_file");
  },

  // Dialogs
  openVideoFilePicker: async () => {
    return invoke("open_video_file_picker");
  },

  revealInFolder: async (filePath: string) => {
    return invoke("reveal_in_folder", { filePath });
  },

  // State
  setCurrentVideoPath: async (path: string) => {
    return invoke("set_current_video_path", { path });
  },

  getCurrentVideoPath: async () => {
    return invoke("get_current_video_path");
  },

  setCurrentRecordingSession: async (session: unknown) => {
    return invoke("set_current_recording_session", { session });
  },

  getCurrentRecordingSession: async () => {
    return invoke("get_current_recording_session");
  },

  clearCurrentVideoPath: async () => {
    return invoke("clear_current_video_path");
  },

  getPlatform: async () => {
    return invoke("get_platform");
  },

  getShortcuts: async () => {
    return invoke("get_shortcuts");
  },

  saveShortcuts: async (shortcuts: unknown) => {
    return invoke("save_shortcuts", { shortcuts });
  },

  getAssetBasePath: async () => {
    return invoke("get_asset_base_path");
  },

  openExternalUrl: async (url: string) => {
    return invoke("open_external_url", { url });
  },

  // Recording
  setRecordingState: async (recording: boolean) => {
    return invoke("set_recording_state", { recording });
  },

  getCursorTelemetry: async (videoPath?: string) => {
    return invoke("get_cursor_telemetry", { videoPath });
  },

  // Screen capture
  getSources: async () => {
    return invoke("get_sources");
  },

  selectSource: async (source: unknown) => {
    return invoke("select_source", { source });
  },

  getSelectedSource: async () => {
    return invoke("get_selected_source");
  },

  requestCameraAccess: async () => {
    return invoke("request_camera_access");
  },

  // Window management
  switchToEditor: async () => {
    return invoke("switch_to_editor");
  },

  switchToHud: async () => {
    return invoke("switch_to_hud");
  },

  startNewRecording: async () => {
    return invoke("start_new_recording_window");
  },

  openSourceSelector: async () => {
    return invoke("open_source_selector_window");
  },

  hudOverlayHide: async () => {
    return invoke("hud_overlay_hide");
  },

  hudOverlayClose: async () => {
    return invoke("hud_overlay_close");
  },

  // Event listeners (Tauri uses different event system)
  onStopRecordingFromTray: (_callback: () => void) => {
    return () => {};
  },

  onMenuLoadProject: (_callback: () => void) => {
    return () => {};
  },

  onMenuSaveProject: (_callback: () => void) => {
    return () => {};
  },

  onMenuSaveProjectAs: (_callback: () => void) => {
    return () => {};
  },

  setMicrophoneExpanded: (_expanded: boolean) => {
    // Tauri-specific implementation
  },

  setHasUnsavedChanges: (_hasChanges: boolean) => {
    // Tauri-specific implementation
  },

  onRequestSaveBeforeClose: (_callback: () => Promise<boolean> | boolean) => {
    return () => {};
  },

  setLocale: async (_locale: string) => {
    // Tauri-specific implementation
  },
};
