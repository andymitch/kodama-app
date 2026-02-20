/** Per-source video statistics for quality indicators */

export interface VideoStats {
	width: number;
	height: number;
	codec: string;
	segmentsAppended: number;
	droppedSegments: number;
	bufferHealth: number; // seconds of buffered data ahead of current time
	/** Estimated bitrate in kbps (based on recent segment sizes) */
	bitrateKbps: number;
}

class VideoStatsStore {
	private stats = $state<Map<string, VideoStats>>(new Map());

	get(sourceId: string): VideoStats | undefined {
		return this.stats.get(sourceId);
	}

	update(sourceId: string, stats: VideoStats) {
		const next = new Map(this.stats);
		next.set(sourceId, stats);
		this.stats = next;
	}

	remove(sourceId: string) {
		const next = new Map(this.stats);
		next.delete(sourceId);
		this.stats = next;
	}
}

export const videoStatsStore = new VideoStatsStore();
