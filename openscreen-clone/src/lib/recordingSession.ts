export interface ProjectMedia {
	screenVideoPath: string;
	webcamVideoPath?: string;
}

export interface RecordingSession extends ProjectMedia {
	createdAt: number;
}

export interface RecordedVideoAssetInput {
	fileName: string;
	videoData: ArrayBuffer;
}

export interface StoreRecordedSessionInput {
	screen: RecordedVideoAssetInput;
	webcam?: RecordedVideoAssetInput;
	createdAt?: number;
}

function normalizePath(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

export function normalizeProjectMedia(candidate: unknown): ProjectMedia | null {
	if (!candidate || typeof candidate !== "object") {
		return null;
	}

	const raw = candidate as Record<string, unknown>;
	const screenVideoPath = normalizePath(raw.screenVideoPath ?? raw.screen_video_path);

	if (!screenVideoPath) {
		return null;
	}

	const webcamVideoPath = normalizePath(raw.webcamVideoPath ?? raw.webcam_video_path);

	return webcamVideoPath
		? { screenVideoPath, webcamVideoPath }
		: {
				screenVideoPath,
			};
}

export function normalizeRecordingSession(candidate: unknown): RecordingSession | null {
	if (!candidate || typeof candidate !== "object") {
		return null;
	}

	const raw = candidate as Record<string, unknown>;
	const media = normalizeProjectMedia(raw);
	if (!media) {
		return null;
	}

	const createdAt = raw.createdAt ?? raw.created_at;

	return {
		...media,
		createdAt:
			typeof createdAt === "number" && Number.isFinite(createdAt)
				? createdAt
				: Date.now(),
	};
}
