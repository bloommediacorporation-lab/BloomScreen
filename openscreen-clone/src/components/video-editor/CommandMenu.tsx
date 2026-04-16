import { useCallback, useEffect, useRef, useState } from "react";

export interface CommandMenuItem {
	id: string;
	label: string;
	shortcut?: string;
	icon?: string;
	action: () => void;
	category?: string;
}

interface CommandMenuProps {
	open: boolean;
	onClose: () => void;
	items: CommandMenuItem[];
}

function fuzzyMatch(query: string, text: string): boolean {
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	if (t.includes(q)) return true;

	let qi = 0;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) qi++;
	}
	return qi === q.length;
}

function highlightMatch(text: string, query: string): React.ReactNode {
	if (!query) return text;
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	const idx = t.indexOf(q);
	if (idx === -1) return text;

	return (
		<>
			{text.slice(0, idx)}
			<span style={{ color: "#818cf8", fontWeight: 700 }}>{text.slice(idx, idx + query.length)}</span>
			{text.slice(idx + query.length)}
		</>
	);
}

export function CommandMenu({ open, onClose, items }: CommandMenuProps) {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const filtered = items.filter((item) => !query || fuzzyMatch(query, item.label));

	useEffect(() => {
		if (open) {
			setQuery("");
			setSelectedIndex(0);
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	const executeSelected = useCallback(() => {
		if (filtered[selectedIndex]) {
			filtered[selectedIndex].action();
			onClose();
		}
	}, [filtered, selectedIndex, onClose]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((i) => (i + 1) % filtered.length);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
					break;
				case "Enter":
					e.preventDefault();
					executeSelected();
					break;
				case "Escape":
					e.preventDefault();
					onClose();
					break;
			}
		},
		[filtered.length, executeSelected, onClose],
	);

	useEffect(() => {
		if (listRef.current) {
			const selected = listRef.current.children[selectedIndex] as HTMLElement;
			selected?.scrollIntoView({ block: "nearest" });
		}
	}, [selectedIndex]);

	if (!open) return null;

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: 9999,
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "center",
				paddingTop: "20vh",
				background: "rgba(0, 0, 0, 0.5)",
				backdropFilter: "blur(4px)",
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				style={{
					width: 560,
					maxHeight: 420,
					background: "#1e1e2e",
					borderRadius: 12,
					boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
					overflow: "hidden",
					display: "flex",
					flexDirection: "column",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						padding: "12px 16px",
						borderBottom: "1px solid rgba(255,255,255,0.06)",
						gap: 10,
					}}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						style={{ color: "#6b7280", flexShrink: 0 }}
					>
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.3-4.3" />
					</svg>
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a command..."
						style={{
							flex: 1,
							background: "transparent",
							border: "none",
							outline: "none",
							color: "#e2e8f0",
							fontSize: 15,
							fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif",
						}}
					/>
					<kbd
						style={{
							fontSize: 11,
							color: "#6b7280",
							background: "rgba(255,255,255,0.06)",
							padding: "2px 6px",
							borderRadius: 4,
							fontFamily: "inherit",
						}}
					>
						ESC
					</kbd>
				</div>

				<div
					ref={listRef}
					style={{
						overflowY: "auto",
						padding: "8px",
						maxHeight: 340,
					}}
				>
					{filtered.length === 0 && (
						<div
							style={{
								padding: "24px",
								textAlign: "center",
								color: "#6b7280",
								fontSize: 14,
							}}
						>
							No results found
						</div>
					)}
					{filtered.map((item, idx) => (
						<div
							key={item.id}
							onClick={() => {
								item.action();
								onClose();
							}}
							style={{
								display: "flex",
								alignItems: "center",
								borderRadius: 8,
								cursor: "pointer",
								background: idx === selectedIndex ? "rgba(129, 140, 248, 0.15)" : "transparent",
								color: idx === selectedIndex ? "#c7d2fe" : "#cbd5e1",
								fontSize: 14,
								fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif",
								transition: "background 0.08s ease",
								gap: 10,
								padding: "8px 12px",
							}}
							onMouseEnter={() => setSelectedIndex(idx)}
						>
							{item.icon && (
								<span style={{ width: 20, textAlign: "center", fontSize: 15 }}>{item.icon}</span>
							)}
							<span style={{ flex: 1 }}>{highlightMatch(item.label, query)}</span>
							{item.shortcut && (
								<kbd
									style={{
										fontSize: 11,
										color: "#6b7280",
										background: "rgba(255,255,255,0.06)",
										padding: "2px 6px",
										borderRadius: 4,
										fontFamily: "inherit",
									}}
								>
									{item.shortcut}
								</kbd>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
