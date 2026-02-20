/** Client-side camera configuration (names, groups). Persisted to localStorage. */

export interface CameraGroup {
	id: string;
	name: string;
}

export interface CameraOverrides {
	/** User-assigned display name (overrides server-provided name) */
	displayName?: string;
	/** Group ID this camera belongs to */
	groupId?: string;
}

const STORAGE_KEY = 'kodama-camera-config';

class CameraConfigStore {
	groups = $state<CameraGroup[]>([]);
	overrides = $state<Record<string, CameraOverrides>>({});
	/** Currently active group filter (null = show all) */
	activeGroupId = $state<string | null>(null);

	constructor() {
		if (typeof window !== 'undefined') {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw) {
					const data = JSON.parse(raw);
					if (data.groups) this.groups = data.groups;
					if (data.overrides) this.overrides = data.overrides;
				}
			} catch {}
		}
	}

	private persist() {
		if (typeof window === 'undefined') return;
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ groups: this.groups, overrides: this.overrides })
		);
	}

	/** Get display name for a camera (override or fallback to original) */
	getDisplayName(cameraId: string, originalName: string): string {
		return this.overrides[cameraId]?.displayName || originalName;
	}

	/** Rename a camera */
	rename(cameraId: string, name: string) {
		const trimmed = name.trim();
		const current = this.overrides[cameraId] ?? {};
		if (!trimmed) {
			// Clear override if empty
			delete current.displayName;
		} else {
			current.displayName = trimmed;
		}
		this.overrides = { ...this.overrides, [cameraId]: current };
		this.persist();
	}

	/** Assign a camera to a group (null to unassign) */
	assignGroup(cameraId: string, groupId: string | null) {
		const current = this.overrides[cameraId] ?? {};
		if (groupId) {
			current.groupId = groupId;
		} else {
			delete current.groupId;
		}
		this.overrides = { ...this.overrides, [cameraId]: current };
		this.persist();
	}

	/** Get group ID for a camera */
	getGroupId(cameraId: string): string | undefined {
		return this.overrides[cameraId]?.groupId;
	}

	/** Create a new group */
	addGroup(name: string): string {
		const id = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
		this.groups = [...this.groups, { id, name: name.trim() }];
		this.persist();
		return id;
	}

	/** Rename a group */
	renameGroup(groupId: string, name: string) {
		this.groups = this.groups.map((g) => (g.id === groupId ? { ...g, name: name.trim() } : g));
		this.persist();
	}

	/** Delete a group and unassign all cameras from it */
	deleteGroup(groupId: string) {
		this.groups = this.groups.filter((g) => g.id !== groupId);
		const next = { ...this.overrides };
		for (const [camId, ov] of Object.entries(next)) {
			if (ov.groupId === groupId) {
				delete ov.groupId;
				next[camId] = { ...ov };
			}
		}
		this.overrides = next;
		if (this.activeGroupId === groupId) this.activeGroupId = null;
		this.persist();
	}

	/** Set active group filter */
	setFilter(groupId: string | null) {
		this.activeGroupId = groupId;
	}
}

export const cameraConfigStore = new CameraConfigStore();
