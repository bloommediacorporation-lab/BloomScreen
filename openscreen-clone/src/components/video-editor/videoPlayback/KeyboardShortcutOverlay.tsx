import { useEffect, useRef, useState } from "react";

export interface KeyboardShortcutEvent {
	timeMs: number;
	keys: string[]; // e.g. ["Meta", "c"] or ["Shift", "Tab"]
}

interface KeyboardShortcutOverlayProps {
	shortcuts: KeyboardShortcutEvent[];
	currentTimeMs: number;
	isPlaying: boolean;
	visible: boolean;
}

/** Duration (ms) a shortcut pill stays visible */
const SHORTCUT_DISPLAY_DURATION = 1500;
/** Stagger between pills if multiple fire close together */
const SHORTCUT_STAGGER = 200;

function formatKey(key: string): string {
	const map: Record<string, string> = {
		Meta: "⌘",
		Control: "Ctrl",
		Alt: "⌥",
		Shift: "⇧",
		Enter: "↵",
		Backspace: "⌫",
		Delete: "⌦",
		Tab: "⇥",
		Escape: "⎋",
		ArrowUp: "↑",
		ArrowDown: "↓",
		ArrowLeft: "←",
		ArrowRight: "→",
		CapsLock: "⇪",
		Space: "Space",
	};
	return map[key] ?? key.toUpperCase();
}

function formatCombo(keys: string[]): string {
	return keys.map(formatKey).join(" + ");
}

interface PillData {
	id: number;
	label: string;
	age: number; // 0..1 where 1 = expired
}

export function KeyboardShortcutOverlay({
	shortcuts,
	currentTimeMs,
	isPlaying,
	visible,
}: KeyboardShortcutOverlayProps) {
	const [pills, setPills] = useState<PillData[]>([]);
	const nextId = useRef(0);
	const lastTimeRef = useRef(currentTimeMs);
	const shortcutsRef = useRef(shortcuts);
	shortcutsRef.current = shortcuts;

	// Track which shortcuts we've already shown (by timeMs index)
	const shownIndexRef = useRef(0);

	useEffect(() => {
		if (!visible) {
			setPills([]);
			shownIndexRef.current = 0;
			return;
		}

		if (!isPlaying) {
			// When paused, reset tracking
			return;
		}

		// Detect new shortcuts that fall within the current time window
		const dt = Math.abs(currentTimeMs - lastTimeRef.current);
		if (dt < 1) return; // no progress
		lastTimeRef.current = currentTimeMs;

		const newPills: PillData[] = [];
		const currentShortcuts = shortcutsRef.current;

		// Find shortcuts in the time range we just passed through
		while (
			shownIndexRef.current < currentShortcuts.length &&
			currentShortcuts[shownIndexRef.current].timeMs <= currentTimeMs
		) {
			const shortcut = currentShortcuts[shownIndexRef.current];
			const age = currentTimeMs - shortcut.timeMs;
			if (age < SHORTCUT_DISPLAY_DURATION) {
				newPills.push({
					id: nextId.current++,
					label: formatCombo(shortcut.keys),
					age: age / SHORTCUT_DISPLAY_DURATION,
				});
			}
			shownIndexRef.current++;
		}

		// Update existing pills' age, remove expired ones
		setPills((prev) => {
			const updated = prev
				.map((p) => ({
					...p,
					age: Math.min(1, p.age + dt / SHORTCUT_DISPLAY_DURATION),
				}))
				.filter((p) => p.age < 1);

			return [...updated, ...newPills].slice(-5); // Max 5 pills visible
		});
	}, [currentTimeMs, isPlaying, visible]);

	if (!visible || pills.length === 0) return null;

	return (
		<div
			style={{
				position: "absolute",
				bottom: 16,
				left: "50%",
				transform: "translateX(-50%)",
				display: "flex",
				gap: 8,
				flexDirection: "column",
				alignItems: "center",
				pointerEvents: "none",
				zIndex: 100,
			}}
		>
			{pills.map((pill) => {
				const opacity = pill.age > 0.7 ? 1 - (pill.age - 0.7) / 0.3 : 1;
				const scale = pill.age < 0.1 ? 0.8 + pill.age * 2 : 1;
				return (
					<div
						key={pill.id}
						style={{
							background: "rgba(0, 0, 0, 0.75)",
							backdropFilter: "blur(8px)",
							borderRadius: 8,
							padding: "6px 14px",
							color: "#fff",
							fontSize: 14,
							fontWeight: 600,
							fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif",
							letterSpacing: 0.5,
							opacity,
							transform: `scale(${scale})`,
							transition: "opacity 0.1s ease, transform 0.1s ease",
							whiteSpace: "nowrap",
						}}
					>
						{pill.label}
					</div>
				);
			})}
		</div>
	);
}
