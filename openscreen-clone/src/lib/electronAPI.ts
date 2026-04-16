import type { RecordingSession, StoreRecordedSessionInput } from "./recordingSession";
import { tauriAPI } from "./tauriAPI";

// Shim: bridge window.electronAPI → tauriAPI for the Tauri runtime
// This lets existing hooks (useScreenRecorder, etc.) work without rewriting them all.
if (!window.electronAPI) {
	window.electronAPI = {
		getSources: async () => {
			const result = await tauriAPI.getSources();
			return (result as unknown as Array<never>) ?? [];
		},

		switchToEditor: async () => {
			await tauriAPI.switchToEditor();
		},

		switchToHud: async () => {
			await tauriAPI.switchToHud();
		},

		startNewRecording: async () => {
			const result = await tauriAPI.startNewRecording();
			return result as { success: boolean; error?: string };
		},

		openSourceSelector: async () => {
			await tauriAPI.openSourceSelector();
		},

		selectSource: async (source) => {
			const result = await tauriAPI.selectSource(source);
			return result as ProcessedDesktopSource | null;
		},

		getSelectedSource: async () => {
			const result = await tauriAPI.getSelectedSource();
			return (result ?? null) as ProcessedDesktopSource | null;
		},

		requestCameraAccess: async () => {
			const result = await tauriAPI.requestCameraAccess();
			return result as { success: boolean; granted: boolean; status: string; error?: string };
		},

		storeRecordedVideo: async (videoData, fileName) => {
			const result = await tauriAPI.storeRecordedVideo(videoData, fileName);
			return result as {
				success: boolean;
				path?: string;
				session?: RecordingSession;
				message?: string;
				error?: string;
			};
		},

		storeRecordedSession: async (payload: StoreRecordedSessionInput) => {
			const result = await tauriAPI.storeRecordedSession(payload);
			return result as {
				success: boolean;
				path?: string;
				session?: RecordingSession;
				message?: string;
				error?: string;
			};
		},

		getRecordedVideoPath: async () => {
			const result = await tauriAPI.getCurrentVideoPath();
			return result as { success: boolean; path?: string; message?: string; error?: string };
		},

		getAssetBasePath: async () => {
			const result = await tauriAPI.getAssetBasePath();
			return (result as unknown as string) ?? null;
		},

		setRecordingState: async (recording) => {
			await tauriAPI.setRecordingState(recording);
		},

		getCursorTelemetry: async (videoPath) => {
			const result = await tauriAPI.getCursorTelemetry(videoPath);
			return result as { success: boolean; samples: CursorTelemetryPoint[]; message?: string; error?: string };
		},

		onStopRecordingFromTray: (callback) => {
			return tauriAPI.onStopRecordingFromTray(callback);
		},

		openExternalUrl: async (url) => {
			const result = await tauriAPI.openExternalUrl(url);
			return result as { success: boolean; error?: string };
		},

		saveExportedVideo: async (videoData, fileName) => {
			const result = await tauriAPI.saveExportedVideo(videoData, fileName);
			return result as { success: boolean; path?: string; message?: string; canceled?: boolean };
		},

		readBinaryFile: async (filePath) => {
			const result = await tauriAPI.readBinaryFile(filePath);
			return result as {
				success: boolean;
				data?: ArrayBuffer;
				path?: string;
				message?: string;
				error?: string;
			};
		},

		openVideoFilePicker: async () => {
			const result = await tauriAPI.openVideoFilePicker();
			return result as { success: boolean; path?: string; canceled?: boolean };
		},

		setCurrentVideoPath: async (path) => {
			const result = await tauriAPI.setCurrentVideoPath(path);
			return result as { success: boolean };
		},

		setCurrentRecordingSession: async (session) => {
			const result = await tauriAPI.setCurrentRecordingSession(session);
			return result as { success: boolean; session?: RecordingSession };
		},

		getCurrentVideoPath: async () => {
			const result = await tauriAPI.getCurrentVideoPath();
			return result as { success: boolean; path?: string };
		},

		getCurrentRecordingSession: async () => {
			const result = await tauriAPI.getCurrentRecordingSession();
			return result as { success: boolean; session?: RecordingSession };
		},

		clearCurrentVideoPath: async () => {
			const result = await tauriAPI.clearCurrentVideoPath();
			return result as { success: boolean };
		},

		saveProjectFile: async (projectData, suggestedName, existingProjectPath) => {
			const result = await tauriAPI.saveProjectFile(projectData, suggestedName, existingProjectPath);
			return result as { success: boolean; path?: string; message?: string; canceled?: boolean; error?: string };
		},

		loadProjectFile: async () => {
			const result = await tauriAPI.loadProjectFile();
			return result as { success: boolean; path?: string; project?: unknown; message?: string; canceled?: boolean; error?: string };
		},

		loadCurrentProjectFile: async () => {
			const result = await tauriAPI.loadCurrentProjectFile();
			return result as { success: boolean; path?: string; project?: unknown; message?: string; canceled?: boolean; error?: string };
		},

		onMenuLoadProject: (callback) => {
			return tauriAPI.onMenuLoadProject(callback);
		},
		onMenuSaveProject: (callback) => {
			return tauriAPI.onMenuSaveProject(callback);
		},
		onMenuSaveProjectAs: (callback) => {
			return tauriAPI.onMenuSaveProjectAs(callback);
		},

		setMicrophoneExpanded: (expanded) => {
			tauriAPI.setMicrophoneExpanded(expanded);
		},
		setHasUnsavedChanges: (hasChanges) => {
			tauriAPI.setHasUnsavedChanges(hasChanges);
		},
		onRequestSaveBeforeClose: (callback) => {
			return tauriAPI.onRequestSaveBeforeClose(callback);
		},
		setLocale: async (locale) => {
			await tauriAPI.setLocale(locale);
		},
		hudOverlayHide: async () => {
			const result = await tauriAPI.hudOverlayHide();
			return result as { success: boolean };
		},
		hudOverlayClose: async () => {
			const result = await tauriAPI.hudOverlayClose();
			return result as { success: boolean };
		},
		windowMinimize: async () => {
			// TODO: add to tauriAPI
			return { success: true };
		},
		windowMaximize: async () => {
			return { success: true };
		},
		windowClose: async () => {
			return { success: true };
		},
	};
}

export {};
