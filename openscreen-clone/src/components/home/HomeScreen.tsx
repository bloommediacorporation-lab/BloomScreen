import { FolderOpen, Monitor, Video, Mic, MicOff, Volume2, VolumeX, Camera, CameraOff, Settings, Play } from "lucide-react";
import { useState } from "react";

export function HomeScreen() {
	const [micEnabled, setMicEnabled] = useState(true);
	const [audioEnabled, setAudioEnabled] = useState(true);
	const [cameraEnabled, setCameraEnabled] = useState(false);

	const openVideoFile = async () => {
		const result = await window.electronAPI?.openVideoFilePicker?.();
		if (result?.success && result.path) {
			await window.electronAPI?.setCurrentVideoPath?.(result.path);
			await window.electronAPI?.switchToEditor?.();
		}
	};

	const openProjectFile = async () => {
		const result = await window.electronAPI?.loadProjectFile?.();
		if (result?.success) {
			await window.electronAPI?.switchToEditor?.();
		}
	};

	const startRecording = () => {
		// Will eventually trigger native screen recording
		console.log("Start recording...");
	};

	const selectSource = () => {
		window.electronAPI?.openSourceSelector?.();
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
					onClick={startRecording}
					className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-[#5D5FEF]/20 to-[#5D5FEF]/5 border border-[#5D5FEF]/20 hover:border-[#5D5FEF]/40 hover:from-[#5D5FEF]/30 hover:to-[#5D5FEF]/10 transition-all duration-200 cursor-pointer"
				>
					<div className="w-12 h-12 rounded-full bg-[#5D5FEF]/20 flex items-center justify-center group-hover:bg-[#5D5FEF]/30 transition-colors">
						<div className="w-5 h-5 rounded-full bg-red-500 group-hover:scale-110 transition-transform" />
					</div>
					<span className="text-white/80 text-sm font-medium">New Recording</span>
					<span className="text-white/25 text-xs">Record your screen</span>
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
				{/* Source selector */}
				<button
					onClick={selectSource}
					className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors text-white/50 hover:text-white/70"
				>
					<Monitor size={15} />
					<span className="text-xs font-medium">Screen</span>
				</button>

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

				{/* Big record button */}
				<button
					onClick={startRecording}
					className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#5D5FEF] hover:bg-[#5D5FEF]/90 text-white transition-colors"
				>
					<div className="w-2.5 h-2.5 rounded-full bg-white" />
					<span className="text-xs font-semibold">Record</span>
				</button>
			</div>
		</div>
	);
}
