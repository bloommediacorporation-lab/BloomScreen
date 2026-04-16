import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { TitleBar } from "./components/home/TitleBar";
import { HomeScreen } from "./components/home/HomeScreen";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { ShortcutsConfigDialog } from "./components/video-editor/ShortcutsConfigDialog";
import VideoEditor from "./components/video-editor/VideoEditor";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { loadAllCustomFonts } from "./lib/customFonts";

function getInitialWindowType() {
	if (typeof window === "undefined") return "";
	const params = new URLSearchParams(window.location.search);
	return params.get("windowType") || "";
}

class AppErrorBoundary extends Component<
	{ children: ReactNode },
	{ error: Error | null }
> {
	state = { error: null as Error | null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("App render error:", error, errorInfo);
	}

	render() {
		if (this.state.error) {
			return (
				<div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6">
					<div className="max-w-2xl w-full rounded-xl border border-red-500/30 bg-red-500/10 p-4">
						<div className="text-red-300 font-semibold mb-2">Editor crash</div>
						<div className="text-sm text-red-100 break-words whitespace-pre-wrap">
							{this.state.error.message}
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default function App() {
	const [windowType] = useState(getInitialWindowType);

	useEffect(() => {
		// Load custom fonts on app initialization
		loadAllCustomFonts().catch((error) => {
			console.error("Failed to load custom fonts:", error);
		});
	}, []);

	const content = (() => {
		switch (windowType) {
			case "hud-overlay":
				// Legacy HUD — redirect to home behavior
				return (
					<div className="flex flex-col h-screen bg-[#0a0a0f] text-white">
						<TitleBar />
						<HomeScreen />
					</div>
				);
			case "source-selector":
				return <div className="w-full h-full bg-[#0a0a0f] text-white p-4">Source selector coming soon...</div>;
			case "editor":
				return (
					<ShortcutsProvider>
						<VideoEditor />
						<ShortcutsConfigDialog />
					</ShortcutsProvider>
				);
			default:
				// Main window — Home screen with custom title bar
				return (
					<div className="flex flex-col h-screen bg-[#0a0a0f] text-white">
						<TitleBar />
						<HomeScreen />
					</div>
				);
		}
	})();

	return (
		<TooltipProvider>
			<AppErrorBoundary>
				{content}
			</AppErrorBoundary>
			<Toaster theme="dark" className="pointer-events-auto" />
		</TooltipProvider>
	);
}
