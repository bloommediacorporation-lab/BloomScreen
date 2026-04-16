import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "@/contexts/I18nContext";
import "./index.css";

// MOCK electronAPI for web usage!
if (typeof window !== 'undefined') {
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
    hudOverlayHide: async () => {},
    hudOverlayClose: async () => {},
    revealInFolder: async () => ({ success: true }),
    getShortcuts: async () => ({}),
    saveShortcuts: async () => {},
    readBinaryFile: async () => ({ success: true, data: new Uint8Array() }),
    getPlatform: async () => 'darwin',
    getCursorTelemetry: async () => {
      // Generate some mock cursor telemetry with dwells so the Smart Auto Zoom wand can be tested
      const samples: any[] = [];
      const durationMs = 120000; // Generate 2 minutes of data
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
            // Pick a new target
            cx = 0.1 + Math.random() * 0.8;
            cy = 0.1 + Math.random() * 0.8;
          }
        }
        
        if (isDwell) {
          // Add some tiny jitter
          const jitterX = (Math.random() - 0.5) * 0.005;
          const jitterY = (Math.random() - 0.5) * 0.005;
          samples.push({ timeMs, cx: cx + jitterX, cy: cy + jitterY });
        } else {
          // Moving
          const currentSample: any = samples.length > 0 ? samples[samples.length - 1] : { cx: 0.5, cy: 0.5 };
          const dt = 30;
          const moveSpeed = 0.002;
          const newCx: number = currentSample.cx + (cx - currentSample.cx) * moveSpeed * dt;
          const newCy: number = currentSample.cy + (cy - currentSample.cy) * moveSpeed * dt;
          samples.push({ timeMs, cx: newCx, cy: newCy });
        }
      }
      return { success: true, samples };
    },
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
    setLocale: async () => {} 
  } as any;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<I18nProvider>
			<App />
		</I18nProvider>
	</React.StrictMode>,
);
