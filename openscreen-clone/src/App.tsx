import { useEffect, useState } from "react";
import { TitleBar } from "./components/home/TitleBar";
import { HomeScreen } from "./components/home/HomeScreen";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { ShortcutsConfigDialog } from "./components/video-editor/ShortcutsConfigDialog";
import VideoEditor from "./components/video-editor/VideoEditor";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { loadAllCustomFonts } from "./lib/customFonts";

export default function App() {
	const [windowType, setWindowType] = useState("");

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const type = params.get("windowType") || "";
		setWindowType(type);

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
			{content}
			<Toaster theme="dark" className="pointer-events-auto" />
		</TooltipProvider>
	);
}
