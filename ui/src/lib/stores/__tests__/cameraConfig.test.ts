import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cameraConfigStore } from '../cameraConfig.svelte.js';
import { flushSync } from 'svelte';

describe('cameraConfigStore', () => {
	beforeEach(() => {
		flushSync(() => {
			// Reset state
			cameraConfigStore.groups = [];
			cameraConfigStore.overrides = {};
			cameraConfigStore.activeGroupId = null;
		});
	});

	describe('renaming', () => {
		it('returns original name when no override', () => {
			expect(cameraConfigStore.getDisplayName('cam1', 'Original')).toBe('Original');
		});

		it('returns overridden name', () => {
			flushSync(() => {
				cameraConfigStore.rename('cam1', 'My Camera');
			});
			expect(cameraConfigStore.getDisplayName('cam1', 'Original')).toBe('My Camera');
		});

		it('clears override when empty name', () => {
			flushSync(() => {
				cameraConfigStore.rename('cam1', 'Custom');
				cameraConfigStore.rename('cam1', '');
			});
			expect(cameraConfigStore.getDisplayName('cam1', 'Original')).toBe('Original');
		});

		it('trims whitespace', () => {
			flushSync(() => {
				cameraConfigStore.rename('cam1', '  Trimmed  ');
			});
			expect(cameraConfigStore.getDisplayName('cam1', 'Original')).toBe('Trimmed');
		});
	});

	describe('groups', () => {
		it('starts with no groups', () => {
			expect(cameraConfigStore.groups).toHaveLength(0);
		});

		it('adds a group and returns an ID', () => {
			let id: string = '';
			flushSync(() => {
				id = cameraConfigStore.addGroup('Front Yard');
			});
			expect(id).toBeTruthy();
			expect(cameraConfigStore.groups).toHaveLength(1);
			expect(cameraConfigStore.groups[0].name).toBe('Front Yard');
		});

		it('deletes a group', () => {
			let id: string = '';
			flushSync(() => {
				id = cameraConfigStore.addGroup('Interior');
				cameraConfigStore.deleteGroup(id);
			});
			expect(cameraConfigStore.groups).toHaveLength(0);
		});

		it('renames a group', () => {
			let id: string = '';
			flushSync(() => {
				id = cameraConfigStore.addGroup('Old Name');
				cameraConfigStore.renameGroup(id, 'New Name');
			});
			expect(cameraConfigStore.groups[0].name).toBe('New Name');
		});

		it('assigns camera to group', () => {
			let groupId: string = '';
			flushSync(() => {
				groupId = cameraConfigStore.addGroup('Outdoor');
				cameraConfigStore.assignGroup('cam1', groupId);
			});
			expect(cameraConfigStore.getGroupId('cam1')).toBe(groupId);
		});

		it('unassigns camera from group', () => {
			let groupId: string = '';
			flushSync(() => {
				groupId = cameraConfigStore.addGroup('Outdoor');
				cameraConfigStore.assignGroup('cam1', groupId);
				cameraConfigStore.assignGroup('cam1', null);
			});
			expect(cameraConfigStore.getGroupId('cam1')).toBeUndefined();
		});

		it('unassigns cameras when group is deleted', () => {
			let groupId: string = '';
			flushSync(() => {
				groupId = cameraConfigStore.addGroup('Outdoor');
				cameraConfigStore.assignGroup('cam1', groupId);
				cameraConfigStore.assignGroup('cam2', groupId);
				cameraConfigStore.deleteGroup(groupId);
			});
			expect(cameraConfigStore.getGroupId('cam1')).toBeUndefined();
			expect(cameraConfigStore.getGroupId('cam2')).toBeUndefined();
		});

		it('clears active filter when filtered group is deleted', () => {
			let groupId: string = '';
			flushSync(() => {
				groupId = cameraConfigStore.addGroup('ToDelete');
				cameraConfigStore.setFilter(groupId);
				cameraConfigStore.deleteGroup(groupId);
			});
			expect(cameraConfigStore.activeGroupId).toBeNull();
		});
	});

	describe('filtering', () => {
		it('starts with no active filter', () => {
			expect(cameraConfigStore.activeGroupId).toBeNull();
		});

		it('sets active group filter', () => {
			let groupId: string = '';
			flushSync(() => {
				groupId = cameraConfigStore.addGroup('Test');
				cameraConfigStore.setFilter(groupId);
			});
			expect(cameraConfigStore.activeGroupId).toBe(groupId);
		});

		it('clears filter', () => {
			flushSync(() => {
				cameraConfigStore.setFilter(null);
			});
			expect(cameraConfigStore.activeGroupId).toBeNull();
		});
	});
});
