import { FolderOpen, Video, Mic, MicOff, Volume2, VolumeX, Camera, CameraOff, Square } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

export function HomeScreen() {
	const [micEnabled, setMicEnabled] = useState(true);
	const [audioEnabled, setAudioEnabled] = useState(true);
	const [cameraEnabled, setCameraEnabled] = useState(false);
	const [recording, setRecording] = useState(false);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);

	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const startTimeRef = useRef<number>(0);
	const openingEditorRef = useRef(false);

	const openEditorForPath = useCallback(async (path: string) => {
		if (!path || openingEditorRef.current) return;
		openingEditorRef.current = true;
		try {
			await window.electronAPI?.setCurrentVideoPath?.(path);
			await window.electronAPI?.switchToEditor?.();
		} finally {
			window.setTimeout(() => {
				openingEditorRef.current = false;
			}, 250);
		}
	}, []);

	const stopTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const startTimer = useCallback(() => {
		startTimeRef.current = Date.now();
		setElapsedSeconds(0);
		timerRef.current = setInterval(() => {
			const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
			setElapsedSeconds(elapsed);
		}, 250);
	}, []);

	// Listen for recording-stopped event from Rust backend
	useEffect(() => {
		const unlisten = (window as any).__TAURI_INTERNALS__?.event?.listen?.(
			"recording-stopped",
			async (event: any) => {
				const { path } = event.payload || {};
				if (path) {
					await openEditorForPath(path);
				}
			}
		);
		return () => {
			unlisten?.then?.((fn: () => void) => fn());
		};
	}, [openEditorForPath]);

	const invoke = async (cmd: string, args?: Record<string, unknown>) => {
		if ((window as any).__TAURI_INTERNALS__) {
			return (window as any).__TAURI_INTERNALS__.invoke(cmd, args);
		}
		throw new Error("Not running in Tauri");
	};

	const startRecording = async () => {
		try {
			const result = await invoke("native_start_recording");
			if (result.success) {
				setRecording(true);
				startTimer();
			}
		} catch (err: any) {
			console.error("Recording failed:", err);
			toast.error(`Eroare la înregistrare: ${err?.message || err}`);
		}
	};

	const stopRecording = useCallback(async () => {
		try {
			const result = await invoke("native_stop_recording");
			if (result.success && result.path) {
				await openEditorForPath(result.path);
			} else if (!result.success) {
				toast.error(result.message || "Nu s-a găsit fișierul de înregistrare");
			}
		} catch (err: any) {
			console.error("Stop recording failed:", err);
			toast.error(`Eroare la oprire: ${err?.message || err}`);
		} finally {
			stopTimer();
			setRecording(false);
			setElapsedSeconds(0);
		}
	}, [openEditorForPath, stopTimer]);

	const openVideoFile = async () => {
		const result = await window.electronAPI?.openVideoFilePicker?.();
		if (result?.success && result.path) {
			await openEditorForPath(result.path);
		}
	};

	const openProjectFile = async () => {
		const result = await window.electronAPI?.loadProjectFile?.();
		if (result?.success) {
			await window.electronAPI?.switchToEditor?.();
		}
	};

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60).toString().padStart(2, "0");
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	return (
		<div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0f] p-8">
			{/* Hero section */}
			<div className="flex flex-col items-center max-w-lg text-center mb-12">
				<div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#5D5FEF] to-[#8B5CF6] flex items-center justify-center mb-6 shadow-lg shadow-[#5D5FEF]/20">
					<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<polygon points="23 7 16 12 23 17 23 7" />
						<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
					</svg>
				</div>
				<h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
					BloomScreen
				</h1>
				<p className="text-white/40 text-sm leading-relaxed">
					Record your screen, edit with Smart Auto Zoom, and export beautiful videos.
				</p>
			</div>

			{/* Action cards */}
			<div className="grid grid-cols-3 gap-4 w-full max-w-2xl mb-10">
				{/* Record */}
				<button
					onClick={recording ? stopRecording : startRecording}
					className={`group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-200 cursor-pointer ${
						recording
							? "bg-gradient-to-br from-red-500/30 to-red-500/10 border border-red-500/40 hover:border-red-500/60"
							: "bg-gradient-to-br from-[#5D5FEF]/20 to-[#5D5FEF]/5 border border-[#5D5FEF]/20 hover:border-[#5D5FEF]/40 hover:from-[#5D5FEF]/30 hover:to-[#5D5FEF]/10"
					}`}
				>
					<div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
						recording ? "bg-red-500/30" : "bg-[#5D5FEF]/20 group-hover:bg-[#5D5FEF]/30"
					}`}>
						{recording ? (
							<Square size={18} className="text-red-400 fill-red-400" />
						) : (
							<div className="w-5 h-5 rounded-full bg-red-500 group-hover:scale-110 transition-transform" />
						)}
					</div>
					<span className="text-white/80 text-sm font-medium">
						{recording ? `Recording ${formatTime(elapsedSeconds)}` : "New Recording"}
					</span>
					<span className="text-white/25 text-xs">
						{recording ? "Click to stop" : "Record your screen"}
					</span>
				</button>

				{/* Open Video */}
				<button
					onClick={openVideoFile}
					className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all duration-200 cursor-pointer"
				>
					<div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
						<Video size={20} className="text-white/50 group-hover:text-white/70" />
					</div>
					<span className="text-white/80 text-sm font-medium">Open Video</span>
					<span className="text-white/25 text-xs">Import a video file</span>
				</button>

				{/* Open Project */}
				<button
					onClick={openProjectFile}
					className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all duration-200 cursor-pointer"
				>
					<div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
						<FolderOpen size={20} className="text-white/50 group-hover:text-white/70" />
					</div>
					<span className="text-white/80 text-sm font-medium">Open Project</span>
					<span className="text-white/25 text-xs">Continue editing</span>
				</button>
			</div>

			{/* Quick settings bar */}
			<div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
				{/* Source indicator */}
				<div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-white/50">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
						<line x1="8" y1="21" x2="16" y2="21" />
						<line x1="12" y1="17" x2="12" y2="21" />
					</svg>
					<span className="text-xs font-medium">Screen</span>
				</div>

				<div className="w-px h-4 bg-white/10" />

				{/* Mic toggle */}
				<button
					onClick={() => setMicEnabled(!micEnabled)}
					className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
						micEnabled ? "text-green-400 hover:bg-green-500/10" : "text-white/30 hover:bg-white/5"
					}`}
				>
					{micEnabled ? <Mic size={15} /> : <MicOff size={15} />}
				</button>

				{/* System audio toggle */}
				<button
					onClick={() => setAudioEnabled(!audioEnabled)}
					className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
						audioEnabled ? "text-green-400 hover:bg-green-500/10" : "text-white/30 hover:bg-white/5"
					}`}
				>
					{audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
				</button>

				{/* Camera toggle */}
				<button
					onClick={() => setCameraEnabled(!cameraEnabled)}
					className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
						cameraEnabled ? "text-green-400 hover:bg-green-500/10" : "text-white/30 hover:bg-white/5"
					}`}
				>
					{cameraEnabled ? <Camera size={15} /> : <CameraOff size={15} />}
				</button>

				<div className="w-px h-4 bg-white/10" />

				{/* Record / Stop button */}
				<button
					onClick={recording ? stopRecording : startRecording}
					className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-colors ${
						recording
							? "bg-red-500 hover:bg-red-600 text-white"
							: "bg-[#5D5FEF] hover:bg-[#5D5FEF]/90 text-white"
					}`}
				>
					{recording ? (
						<>
							<Square size={10} className="fill-white" />
							<span className="text-xs font-semibold">Stop</span>
							<span className="text-xs opacity-70">{formatTime(elapsedSeconds)}</span>
						</>
					) : (
						<>
							<div className="w-2.5 h-2.5 rounded-full bg-white" />
							<span className="text-xs font-semibold">Record</span>
						</>
					)}
				</button>
			</div>
		</div>
	);
}
