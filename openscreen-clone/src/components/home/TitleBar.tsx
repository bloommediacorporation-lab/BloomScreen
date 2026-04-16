import { Minus, Square, X } from "lucide-react";

export function TitleBar() {
	const minimize = () => {
		window.electronAPI?.windowMinimize?.();
	};
	const maximize = () => {
		window.electronAPI?.windowMaximize?.();
	};
	const close = () => {
		window.electronAPI?.windowClose?.();
	};

	return (
		<div
			className="h-12 flex-shrink-0 flex items-center justify-between px-4 bg-[#0a0a0f] border-b border-white/5 select-none"
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
		>
			{/* Left — App name */}
			<div className="flex items-center gap-2.5">
				<div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#5D5FEF] to-[#8B5CF6] flex items-center justify-center">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<polygon points="23 7 16 12 23 17 23 7" />
						<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
					</svg>
				</div>
				<span className="text-[13px] font-semibold text-white/90 tracking-tight">BloomScreen</span>
			</div>

			{/* Right — Window controls */}
			<div
				className="flex items-center gap-0.5"
				style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
			>
				<button
					onClick={minimize}
					className="w-8 h-8 flex items-center justify-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
				>
					<Minus size={14} />
				</button>
				<button
					onClick={maximize}
					className="w-8 h-8 flex items-center justify-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
				>
					<Square size={11} />
				</button>
				<button
					onClick={close}
					className="w-8 h-8 flex items-center justify-center rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
				>
					<X size={14} />
				</button>
			</div>
		</div>
	);
}
