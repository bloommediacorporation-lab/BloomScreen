import React, { useEffect, useState, useRef } from "react";
import { CursorTelemetryPoint } from "./types";
import { interpolateCursorAt, smoothCursorFocus } from "./videoPlayback/cursorFollowUtils";

interface CursorOverlayProps {
	cursorTelemetry: CursorTelemetryPoint[];
	currentTime: number;
	containerWidth: number;
	containerHeight: number;
	cursorSize?: number;
	cursorType?: "mac" | "win";
	cursorEnabled?: boolean;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({
	cursorTelemetry,
	currentTime,
	containerWidth,
	containerHeight,
	cursorSize = 1,
	cursorType = "mac",
	cursorEnabled = true,
}) => {
	const [position, setPosition] = useState({ cx: 0.5, cy: 0.5 });
	const prevRawRef = useRef({ cx: 0.5, cy: 0.5 });
	const smoothPosRef = useRef({ cx: 0.5, cy: 0.5 });
    
    // We update position every time currentTime or cursorTelemetry changes.
    // In a real high-perf app, this might be driven by requestAnimationFrame if currentTime updates smoothly,
    // but since we pass currentTime down (which is updated by VideoPlayback RAF loop), we can compute it here.
	useEffect(() => {
		if (!cursorTelemetry || cursorTelemetry.length === 0) return;

		// Convert standard video time to ms
		const timeMs = currentTime * 1000;
		const rawFocus = interpolateCursorAt(cursorTelemetry, timeMs);

		if (!rawFocus) return;

		// We can apply basic smoothing over time here
        const smoothFactor = 0.5; // Fixed factor for preview drawing
        const smoothed = smoothCursorFocus(rawFocus, smoothPosRef.current, smoothFactor);
        
        smoothPosRef.current = smoothed;
        prevRawRef.current = rawFocus;

        setPosition(smoothed);
	}, [currentTime, cursorTelemetry]);

	if (!cursorEnabled || !cursorTelemetry.length) return null;

	const x = position.cx * containerWidth;
	const y = position.cy * containerHeight;

	// Scale cursor base size
	const baseSize = 24 * cursorSize;

	return (
		<div
			className="absolute pointer-events-none drop-shadow-md z-[100]"
			style={{
				left: x,
				top: y,
				transform: `translate(${cursorType === "mac" ? "-10%" : "0%"}, ${cursorType === "mac" ? "-10%" : "0%"})`,
				willChange: "transform, left, top",
			}}
		>
			{cursorType === "mac" ? (
				// Basic Mac OS style cursor SVG
				<svg
					width={baseSize}
					height={baseSize}
					viewBox="0 0 32 32"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M8.5 29L1 1L26 12L15 15L23.5 25L19 28L11 18L8.5 29Z"
						fill="black"
						stroke="white"
						strokeWidth="2"
						strokeLinejoin="round"
					/>
				</svg>
			) : (
				// Basic Windows style cursor SVG
				<svg
					width={baseSize}
					height={baseSize}
					viewBox="0 0 32 32"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M2 1L24 23H15L10 30L2 1Z"
						fill="black"
						stroke="white"
						strokeWidth="2"
					/>
				</svg>
			)}
		</div>
	);
};
