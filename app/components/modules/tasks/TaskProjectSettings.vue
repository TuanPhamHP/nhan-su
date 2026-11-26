<script setup lang="ts">
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskGroup, TaskProjectDetail, TaskWipLimits } from '~/types/tasks.types';
	import { STATUS_LABELS, TASK_HINTS, taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Cài đặt dự án lô 2, chỉ quản lý dự án và ADMIN: bật, tắt đợt; giới hạn số thẻ mỗi cột; nhóm việc
	 * (tạo, đổi tên, sắp xếp, cất). Không có xoá nhóm: nhóm đã dùng thì cất để giữ lịch sử.
	 */
	const props = withDefaults(defineProps<{ project: TaskProjectDetail; readOnly?: boolean }>(), { readOnly: false });
	const emit = defineEmits<{ saved: [project: TaskProjectDetail]; groupsChanged: [] }>();

	const service = useTasksService();
	const toast = useToast();

	// ─── Đợt ─────────────────────────────────────────────────────────────────
	const savingSprints = ref(false);
	async function toggleSprints() {
		savingSprints.value = true;
		const next = !props.project.useSprints;
		try {
			const p = await service.updateProject(props.project.id, { useSprints: next });
			toast.success(next ? 'Đã bật đợt cho dự án' : 'Đã tắt đợt');
			emit('saved', p);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			savingSprints.value = false;
		}
	}

	// ─── Giới hạn số thẻ mỗi cột ─────────────────────────────────────────────
	const WIP_COLS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] as const;
	const wip = reactive<Record<(typeof WIP_COLS)[number], string>>({ TODO: '', IN_PROGRESS: '', IN_REVIEW: '' });
	watch(
		() => props.project.wipLimits,
		v => {
			for (const k of WIP_COLS) wip[k] = v?.[k] != null ? String(v[k]) : '';
		},
		{ immediate: true },
	);
	const wipError = computed(() => {
		for (const k of WIP_COLS) {
			const raw = wip[k].trim();
			if (!raw) continue;
			const n = Number(raw);
			if (!Number.isInteger(n) || n < 1 || n > 999) return `Giới hạn cột ${STATUS_LABELS[k]} là số từ 1 đến 999, để trống nếu không giới hạn`;
		}
		return '';
	});
	const savingWip = ref(false);
	async function saveWip() {
		if (wipError.value) return;
		const limits: TaskWipLimits = {};
		for (const k of WIP_COLS) if (wip[k].trim()) limits[k] = Number(wip[k]);
		savingWip.value = true;
		try {
			const p = await service.updateProject(props.project.id, { wipLimits: Object.keys(limits).length ? limits : null });
			toast.success('Đã lưu giới hạn số thẻ');
			emit('saved', p);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			savingWip.value = false;
		}
	}

	// ─── Nhóm việc ───────────────────────────────────────────────────────────
	const groups = ref<TaskGroup[]>([]);
	const loadingGroups = ref(true);
	async function loadGroups() {
		loadingGroups.value = true;
		try {
			groups.value = await service.listGroups(props.project.id);
		} catch (err) {
			toast.error(taskErrorInfo(err, 'Chưa tải được nhóm việc.').message);
		} finally {
			loadingGroups.value = false;
		}
	}
	onMounted(loadGroups);

	const activeGroups = computed(() => groups.value.filter(g => !g.archived).sort((a, b) => a.sortOrder - b.sortOrder));
	const archivedGroups = computed(() => groups.value.filter(g => g.archived));

	const newName = ref('');
	const adding = ref(false);
	async function addGroup() {
		const name = newName.value.trim();
		if (!name) return;
		adding.value = true;
		try {
			const maxOrder = Math.max(0, ...groups.value.map(g => g.sortOrder));
			await service.createGroup(props.project.id, { name, sortOrder: maxOrder + 1 });
			newName.value = '';
			toast.success(`Đã tạo nhóm ${name}`);
			await loadGroups();
			emit('groupsChanged');
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			adding.value = false;
		}
	}

	const renaming = ref<number | null>(null);
	const renameDraft = ref('');
	function startRename(g: TaskGroup) {
		renaming.value = g.id;
		renameDraft.value = g.name;
	}
	async function saveRename(g: TaskGroup) {
		const name = renameDraft.value.trim();
		renaming.value = null;
		if (!name || name === g.name) return;
		await patchGroup(g, { name }, 'Đã đổi tên nhóm');
	}

	async function patchGroup(g: TaskGroup, body: { name?: string; sortOrder?: number; archived?: boolean }, ok?: string) {
		try {
			await service.updateGroup(props.project.id, g.id, body);
			if (ok) toast.success(ok);
			await loadGroups();
			emit('groupsChanged');
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}

	/** Đổi chỗ với nhóm kề trên hay dưới: gửi lại `sortOrder` của cả hai. */
	async function moveGroup(index: number, dir: -1 | 1) {
		const list = activeGroups.value;
		const a = list[index];
		const b = list[index + dir];
		if (!a || !b) return;
		try {
			await Promise.all([
				service.updateGroup(props.project.id, a.id, { sortOrder: b.sortOrder }),
				service.updateGroup(props.project.id, b.id, { sortOrder: a.sortOrder === b.sortOrder ? a.sortOrder + dir : a.sortOrder }),
			]);
			await loadGroups();
			emit('groupsChanged');
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}

	const INPUT =
		'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const CARD = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900';
</script>

<template>
	<div class="space-y-4" data-testid="project-settings">
		<!-- Người thử nghiệm hay lẫn nhóm và đợt: một câu đặt trên cả hai phần. -->
		<p class="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-900/20 dark:text-sky-200" data-testid="settings-group-sprint-note">
			Nhóm là phần việc (Chứng từ, Tờ khai). Đợt là khoảng thời gian (tuần này, tuần sau).
		</p>
		<!-- Đợt -->
		<section :class="CARD" aria-label="Đợt">
			<div class="flex items-start gap-3">
				<div class="min-w-0 flex-1">
					<h3 class="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
						Chia việc theo đợt
						<span class="cursor-help text-xs font-normal text-gray-400" :title="TASK_HINTS.sprint" aria-label="Đợt là gì">ⓘ</span>
					</h3>
					<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
						Bật thì dự án có thêm thẻ Việc chờ xếp và Đợt. Đang có đợt chạy thì phải đóng đợt trước khi tắt.
					</p>
				</div>
				<button
					type="button"
					role="switch"
					:aria-checked="project.useSprints"
					aria-label="Chia việc theo đợt"
					:disabled="readOnly || savingSprints"
					class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
					:class="project.useSprints ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'"
					data-testid="settings-use-sprints"
					@click="toggleSprints"
				>
					<span class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform" :class="project.useSprints ? 'translate-x-5' : 'translate-x-0.5'" />
				</button>
			</div>
		</section>

		<!-- Giới hạn số thẻ -->
		<section :class="CARD" aria-label="Giới hạn số thẻ mỗi cột">
			<h3 class="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
				Giới hạn số thẻ mỗi cột
				<span class="cursor-help text-xs font-normal text-gray-400" :title="TASK_HINTS.wip" aria-label="Giới hạn số thẻ là gì">ⓘ</span>
			</h3>
			<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-300">Chỉ để nhắc trên Bảng việc, vẫn kéo thẻ vào được. Để trống là không giới hạn.</p>
			<div class="mt-3 grid gap-3 sm:grid-cols-3">
				<label v-for="k in WIP_COLS" :key="k" class="text-sm text-gray-700 dark:text-gray-300">
					{{ STATUS_LABELS[k] }}
					<input
						v-model="wip[k]"
						type="text"
						inputmode="numeric"
						maxlength="3"
						:disabled="readOnly"
						placeholder="Không giới hạn"
						:class="[INPUT, 'mt-1 w-full']"
						:data-testid="`settings-wip-${k}`"
					/>
				</label>
			</div>
			<p v-if="wipError" class="mt-2 text-xs text-rose-600">{{ wipError }}</p>
			<div class="mt-3 flex justify-end">
				<CommonAppButton size="sm" :loading="savingWip" :disabled="readOnly || !!wipError" data-testid="settings-wip-save" @click="saveWip">Lưu giới hạn</CommonAppButton>
			</div>
		</section>

		<!-- Nhóm việc -->
		<section :class="CARD" aria-label="Nhóm việc">
			<h3 class="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
				Nhóm việc
				<span class="cursor-help text-xs font-normal text-gray-400" :title="TASK_HINTS.group" aria-label="Nhóm việc là gì">ⓘ</span>
			</h3>
			<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-300">Nhóm đã cất vẫn giữ trên việc cũ nhưng không chọn được cho việc mới.</p>

			<form v-if="!readOnly" class="mt-3 flex gap-2" @submit.prevent="addGroup">
				<input v-model="newName" type="text" maxlength="100" placeholder="Tên nhóm mới, ví dụ Chứng từ" aria-label="Tên nhóm mới" :class="[INPUT, 'flex-1']" data-testid="settings-group-name" />
				<CommonAppButton type="submit" size="sm" :loading="adding" :disabled="!newName.trim()" data-testid="settings-group-add">Thêm nhóm</CommonAppButton>
			</form>

			<div v-if="loadingGroups" class="mt-3 space-y-2" aria-busy="true">
				<div v-for="i in 2" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>
			<p v-else-if="!groups.length" class="mt-3 text-sm text-gray-500">Chưa có nhóm nào.</p>
			<ul v-else class="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700" data-testid="settings-groups">
				<li v-for="(g, i) in activeGroups" :key="g.id" class="flex items-center gap-2 px-3 py-2 text-sm">
					<input
						v-if="renaming === g.id"
						v-model="renameDraft"
						type="text"
						maxlength="100"
						:aria-label="`Tên mới cho nhóm ${g.name}`"
						:class="[INPUT, 'flex-1']"
						@keydown.enter.prevent="saveRename(g)"
						@keydown.esc.stop="renaming = null"
						@blur="saveRename(g)"
					/>
					<span v-else class="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">{{ g.name }}</span>
					<span class="hidden text-xs text-gray-500 sm:inline">{{ g.doneCount }}/{{ g.taskCount }} xong · {{ g.points }} điểm</span>
					<template v-if="!readOnly">
						<button type="button" class="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" :disabled="i === 0" :aria-label="`Đưa ${g.name} lên`" @click="moveGroup(i, -1)">
							<Icon name="heroicons:arrow-up" class="h-4 w-4" />
						</button>
						<button
							type="button"
							class="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
							:disabled="i === activeGroups.length - 1"
							:aria-label="`Đưa ${g.name} xuống`"
							@click="moveGroup(i, 1)"
						>
							<Icon name="heroicons:arrow-down" class="h-4 w-4" />
						</button>
						<button type="button" class="text-xs text-brand-600 hover:underline dark:text-brand-400" @click="startRename(g)">Đổi tên</button>
						<button
							type="button"
							class="text-xs text-gray-600 hover:underline dark:text-gray-300"
							:data-testid="`settings-group-archive-${g.id}`"
							@click="patchGroup(g, { archived: true }, `Đã cất nhóm ${g.name}`)"
						>
							Cất
						</button>
					</template>
				</li>
				<li v-for="g in archivedGroups" :key="g.id" class="flex items-center gap-2 bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/40">
					<span class="min-w-0 flex-1 truncate text-gray-500">{{ g.name }} <span class="text-xs">(đã cất)</span></span>
					<span class="hidden text-xs text-gray-500 sm:inline">{{ g.doneCount }}/{{ g.taskCount }} xong</span>
					<button v-if="!readOnly" type="button" class="text-xs text-brand-600 hover:underline dark:text-brand-400" @click="patchGroup(g, { archived: false }, `Đã lấy lại nhóm ${g.name}`)">
						Lấy lại
					</button>
				</li>
			</ul>
		</section>
	</div>
</template>
