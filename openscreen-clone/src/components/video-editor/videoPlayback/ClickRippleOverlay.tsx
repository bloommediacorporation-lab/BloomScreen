import { useEffect, useRef, useState } from "react";

export interface ClickEvent {
	timeMs: number;
	cx: number; // normalized 0-1
	cy: number; // normalized 0-1
}

interface ClickRippleOverlayProps {
	clicks: ClickEvent[];
	currentTimeMs: number;
	isPlaying: boolean;
	visible: boolean;
}

/** Ripple animation duration in ms */
const RIPPLE_DURATION = 800;
/** Max ripples visible at once */
const MAX_RIPPLES = 8;

interface RippleData {
	id: number;
	cx: number;
	cy: number;
	progress: number; // 0..1
}

export function ClickRippleOverlay({
	clicks,
	currentTimeMs,
	isPlaying,
	visible,
}: ClickRippleOverlayProps) {
	const [ripples, setRipples] = useState<RippleData[]>([]);
	const nextId = useRef(0);
	const lastTimeRef = useRef(currentTimeMs);
	const clicksRef = useRef(clicks);
	clicksRef.current = clicks;
	const shownIndexRef = useRef(0);
	const animFrameRef = useRef<number | null>(null);
	const lastFrameTimeRef = useRef(performance.now());

	// Animation loop for smooth ripple rendering
	useEffect(() => {
		if (!visible || !isPlaying || ripples.length === 0) {
			if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
			return;
		}

		const animate = () => {
			const now = performance.now();
			const dt = now - lastFrameTimeRef.current;
			lastFrameTimeRef.current = now;

			setRipples((prev) =>
				prev
					.map((r) => ({
						...r,
						progress: Math.min(1, r.progress + dt / RIPPLE_DURATION),
					}))
					.filter((r) => r.progress < 1),
			);

			animFrameRef.current = requestAnimationFrame(animate);
		};

		lastFrameTimeRef.current = performance.now();
		animFrameRef.current = requestAnimationFrame(animate);

		return () => {
			if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
		};
	}, [visible, isPlaying, ripples.length > 0]);

	useEffect(() => {
		if (!visible) {
			setRipples([]);
			shownIndexRef.current = 0;
			return;
		}

		if (!isPlaying) return;

		const dt = Math.abs(currentTimeMs - lastTimeRef.current);
		if (dt < 1) return;
		lastTimeRef.current = currentTimeMs;

		const currentClicks = clicksRef.current;
		const newRipples: RippleData[] = [];

		while (
			shownIndexRef.current < currentClicks.length &&
			currentClicks[shownIndexRef.current].timeMs <= currentTimeMs
		) {
			const click = currentClicks[shownIndexRef.current];
			newRipples.push({
				id: nextId.current++,
				cx: click.cx,
				cy: click.cy,
				progress: 0,
			});
			shownIndexRef.current++;
		}

		if (newRipples.length > 0) {
			setRipples((prev) => [...prev.slice(-(MAX_RIPPLES - newRipples.length)), ...newRipples]);
		}
	}, [currentTimeMs, isPlaying, visible]);

	if (!visible || ripples.length === 0) return null;

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				pointerEvents: "none",
				zIndex: 50,
				overflow: "hidden",
			}}
		>
			{ripples.map((ripple) => {
				const { progress, cx, cy } = ripple;
				// Ease-out cubic
				const eased = 1 - Math.pow(1 - progress, 3);

				const maxRadius = 40;
				const radius = maxRadius * eased;
				const opacity = 0.6 * (1 - eased);

				return (
					<div
						key={ripple.id}
						style={{
							position: "absolute",
							left: `${cx * 100}%`,
							top: `${cy * 100}%`,
							transform: "translate(-50%, -50%)",
							width: radius * 2,
							height: radius * 2,
							borderRadius: "50%",
							border: `2px solid rgba(129, 140, 248, ${opacity})`,
							background: `radial-gradient(circle, rgba(129, 140, 248, ${opacity * 0.3}) 0%, transparent 70%)`,
							boxShadow: `0 0 ${radius * 0.5}px rgba(129, 140, 248, ${opacity * 0.2})`,
						}}
					/>
				);
			})}
		</div>
	);
}
