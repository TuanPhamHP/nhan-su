<script setup lang="ts">
	import { sanitizeTaskComment } from '~/utils/task-html';
	import { useAuthStore } from '~/stores/auth';
	import { storeToRefs } from 'pinia';
	import RecruitConfirmModal from '~/components/modules/recruitment/RecruitConfirmModal.vue';
	import TaskCommentEditor from '~/components/modules/tasks/TaskCommentEditor.vue';
	import { useDirectoryStore } from '~/stores/directory';
	import { useTasksService } from '~/services/tasks.service';
	import type {
		MentionCandidate,
		TaskActivityItem,
		TaskActivityKind,
		TaskAttachment,
		TaskComment,
		TaskDetail,
		TaskEvent,
	} from '~/types/tasks.types';
	import { formatDateTime, formatTimeAgo } from '~/utils/date';
	import {
		TASK_FILE_ACCEPT,
		TASK_FILE_MAX_MB,
		isBlankHtml,
		mentionIdsFromHtml,
		shortDate,
		taskErrorInfo,
		taskFileSize,
		vnToday,
	} from '~/utils/tasks.utils';

	/**
	 * Hoạt động của việc: Tất cả, Bình luận, Lịch sử, mặc định Bình luận (mục 9.2). Ô bình luận dính
	 * đáy khung. Bản nháp giữ trong trình duyệt theo từng việc, lỡ đóng khung vẫn còn.
	 *
	 * Nhắc người không xem được việc: máy chủ vẫn nhận bình luận nhưng người đó không nhận thông báo
	 * (T-06), nên ngay dưới ô soạn hiện câu cảnh báo kèm nút "Thêm làm người theo dõi".
	 */
	const props = defineProps<{ task: TaskDetail; disabled?: boolean; /** Ô soạn dời xuống chân khung (dính đáy). */ composerTo?: string }>();
	const emit = defineEmits<{ taskChanged: [task: TaskDetail]; openFile: [attachment: TaskAttachment] }>();

	const service = useTasksService();
	const toast = useToast();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);
	const today = vnToday();

	/**
	 * Thẻ đang xem nằm trên đường dẫn (`?activity=comments|history`, bỏ khi là Tất cả), ở khung lẫn trang đầy
	 * đủ. Mặc định Tất cả: lý do trả lại, đổi hạn nằm ở lịch sử, mặc định Bình luận thì người làm không thấy.
	 */
	const route = useRoute();
	const router = useRouter();
	const kind = computed<TaskActivityKind>({
		get: () => {
			const v = String(route.query.activity ?? '');
			return v === 'comments' || v === 'history' ? v : 'all';
		},
		set: v => router.replace({ query: { ...route.query, activity: v === 'all' ? undefined : v } }),
	});
	const items = ref<TaskActivityItem[]>([]);
	const page = ref(1);
	const totalPages = ref(1);
	const loading = ref(false);
	const loadError = ref('');

	const TABS: Array<{ key: TaskActivityKind; label: string }> = [
		{ key: 'all', label: 'Tất cả' },
		{ key: 'comments', label: 'Bình luận' },
		{ key: 'history', label: 'Lịch sử' },
	];

	async function load(reset = true) {
		loading.value = true;
		loadError.value = '';
		try {
			const next = reset ? 1 : page.value + 1;
			const res = await service.activity(props.task.id, { kind: kind.value, page: next, limit: 30 });
			// Máy chủ trả mới trước; ô soạn ở đáy nên hiện theo thứ tự thời gian, cũ ở trên.
			const chunk = [...res.data].reverse();
			items.value = reset ? chunk : [...chunk, ...items.value];
			page.value = next;
			totalPages.value = res.meta.totalPages;
		} catch (err) {
			loadError.value = taskErrorInfo(err, 'Chưa tải được hoạt động.').message;
		} finally {
			loading.value = false;
		}
	}

	watch(kind, () => load(true));
	watch(
		() => props.task.id,
		() => {
			restoreDraft();
			load(true);
		},
	);
	onMounted(() => {
		restoreDraft();
		load(true);
	});

	defineExpose({ reload: () => load(true) });

	// ─── Bản nháp ───────────────────────────────────────────────────────────
	const draft = ref('');
	// Khoá theo công ty và người dùng: máy dùng chung thì người sau không thấy nháp của người trước.
	const auth = useAuthStore();
	const draftKey = computed(() => `task-comment-draft:${auth.company?.code ?? ''}:${auth.user?.id ?? 0}:${props.task.id}`);
	function restoreDraft() {
		try {
			draft.value = localStorage.getItem(draftKey.value) ?? '';
		} catch {
			draft.value = '';
		}
	}
	let draftTimer: ReturnType<typeof setTimeout> | null = null;
	watch(draft, v => {
		if (draftTimer) clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			try {
				if (isBlankHtml(v)) localStorage.removeItem(draftKey.value);
				else localStorage.setItem(draftKey.value, v);
			} catch {
				// Bộ nhớ bị chặn: vẫn gửi được, chỉ không giữ nháp.
			}
		}, 400);
	});

	// ─── Nhắc tên ───────────────────────────────────────────────────────────
	const known = ref<Record<number, MentionCandidate>>({});
	function onMentioned(c: MentionCandidate) {
		known.value = { ...known.value, [c.id]: c };
	}
	const watcherIds = computed(() => new Set(props.task.watchers.map(w => w.id)));
	const cannotView = computed(() =>
		mentionIdsFromHtml(draft.value)
			.map(id => known.value[id])
			.filter((c): c is MentionCandidate => !!c && !c.canView && !watcherIds.value.has(c.id)),
	);
	const addingWatcher = ref<number | null>(null);
	async function addAsWatcher(c: MentionCandidate) {
		addingWatcher.value = c.id;
		try {
			const updated = await service.addWatchers(props.task.id, [c.id]);
			known.value = { ...known.value, [c.id]: { ...c, canView: true } };
			toast.success(`Đã thêm ${c.fullName} làm người theo dõi`);
			emit('taskChanged', updated);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			addingWatcher.value = null;
		}
	}

	// ─── File đính kèm của bình luận ────────────────────────────────────────
	const pending = ref<TaskAttachment[]>([]);
	const uploading = ref(0);
	const showDropzone = ref(false);
	const dropFile = ref<File | File[] | null>(null);

	async function uploadFiles(files: File[]) {
		for (const file of files) {
			if (file.size > TASK_FILE_MAX_MB * 1024 * 1024) {
				toast.error(`File ${file.name} quá ${TASK_FILE_MAX_MB} MB, bạn chọn file nhỏ hơn.`);
				continue;
			}
			uploading.value += 1;
			try {
				pending.value.push(await service.uploadAttachment(props.task.id, file));
			} catch (err) {
				toast.error(taskErrorInfo(err).message);
			} finally {
				uploading.value -= 1;
			}
		}
	}

	watch(dropFile, v => {
		const files = Array.isArray(v) ? v : v ? [v] : [];
		if (!files.length) return;
		dropFile.value = null;
		showDropzone.value = false;
		uploadFiles(files);
	});

	// ─── Gửi, sửa, xoá ──────────────────────────────────────────────────────
	const sending = ref(false);
	const editorRef = ref<InstanceType<typeof TaskCommentEditor> | null>(null);

	async function send() {
		if (sending.value || uploading.value) return;
		if (isBlankHtml(draft.value) && !pending.value.length) {
			toast.warning('Bạn chưa viết gì để gửi.');
			return;
		}
		sending.value = true;
		try {
			const mentionIds = mentionIdsFromHtml(draft.value);
			await service.addComment(props.task.id, {
				body: isBlankHtml(draft.value) ? '' : draft.value,
				mentionIds: mentionIds.length ? mentionIds : undefined,
				attachmentIds: pending.value.length ? pending.value.map(a => a.id) : undefined,
			});
			draft.value = '';
			pending.value = [];
			try {
				localStorage.removeItem(draftKey.value);
			} catch {
				// bỏ qua
			}
			if (kind.value === 'history') kind.value = 'comments';
			else await load(true);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			sending.value = false;
		}
	}

	const editingId = ref<number | null>(null);
	const editBody = ref('');
	function startEdit(c: TaskComment) {
		menuFor.value = null;
		editingId.value = c.id;
		editBody.value = c.body ?? '';
	}
	async function saveEdit(c: TaskComment) {
		if (isBlankHtml(editBody.value)) {
			toast.warning('Bình luận không được để trống. Muốn bỏ thì bấm Xoá.');
			return;
		}
		try {
			const mentionIds = mentionIdsFromHtml(editBody.value);
			const updated = await service.updateComment(props.task.id, c.id, { body: editBody.value, mentionIds });
			replaceComment(updated);
			editingId.value = null;
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}
	const confirmDelete = ref<TaskComment | null>(null);
	function remove(c: TaskComment) {
		menuFor.value = null;
		confirmDelete.value = c;
	}
	async function doRemove() {
		const c = confirmDelete.value;
		confirmDelete.value = null;
		if (!c) return;
		try {
			await service.removeComment(props.task.id, c.id);
			replaceComment({ ...c, deleted: true, body: null, attachments: [] });
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}
	function replaceComment(updated: TaskComment) {
		const it = items.value.find(i => i.comment?.id === updated.id);
		if (it) it.comment = updated;
	}

	const menuFor = ref<number | null>(null);

	// ─── Hiển thị ───────────────────────────────────────────────────────────
	function safeHtml(html: string | null): string {
		if (!html) return '';
		// Bình luận cũ có thể là chữ thường không có thẻ: giữ xuống dòng.
		const value = /<[a-z][\s\S]*>/i.test(html) ? html : html.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!).replace(/\n/g, '<br>');
		return sanitizeTaskComment(value);
	}

	function personName(id: unknown): string {
		const n = Number(id);
		return employees.value.find(e => e.id === n)?.fullName ?? 'người khác';
	}

	const FIELD_LABELS: Record<string, string> = {
		title: 'tiêu đề',
		description: 'mô tả',
		priority: 'ưu tiên',
		points: 'điểm',
		startDate: 'ngày bắt đầu',
	};

	function eventDetail(e: TaskEvent): string {
		const p = (e.payload ?? {}) as Record<string, unknown>;
		const reason = typeof p.reason === 'string' ? p.reason : '';
		switch (e.type) {
			case 'RETURNED':
			case 'REOPENED':
			case 'CANCELLED':
				return [p.byParent ? 'huỷ theo việc cha' : '', reason ? `Lý do: ${reason}` : ''].filter(Boolean).join('. ');
			case 'ACCEPTED': {
				const parts: string[] = [];
				if (typeof p.qualityScore === 'number') parts.push(`chất lượng ${p.qualityScore} sao`);
				if (p.onBehalfOf) parts.push('nghiệm thu thay người nghiệm thu');
				return parts.join(', ');
			}
			case 'DUE_CHANGED':
				return `hạn từ ${shortDate(String(p.from ?? ''), today)} sang ${shortDate(String(p.to ?? ''), today)}${reason ? `. Lý do: ${reason}` : ''}`;
			case 'ASSIGNEE_CHANGED':
			case 'REVIEWER_CHANGED':
				return `từ ${personName(p.from)} sang ${personName(p.to)}`;
			case 'FIELD_CHANGED': {
				const changes = (p.changes ?? {}) as Record<string, unknown>;
				const names = Object.keys(changes).map(k => FIELD_LABELS[k] ?? k);
				return names.length ? `sửa ${names.join(', ')}` : '';
			}
			case 'ATTACHMENT_ADDED':
			case 'ATTACHMENT_REMOVED':
				return typeof p.fileName === 'string' ? p.fileName : '';
			default:
				if (e.fromStatusLabel && e.toStatusLabel) return `từ ${e.fromStatusLabel} sang ${e.toStatusLabel}`;
				return '';
		}
	}

	onMounted(() => {
		if (!employees.value.length) directoryStore.load().catch(() => {});
	});
</script>

<template>
	<section class="space-y-3" aria-label="Hoạt động">
		<div class="flex items-center justify-between gap-2">
			<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Hoạt động</h3>
			<div class="flex rounded-lg bg-gray-100 p-0.5 text-xs dark:bg-gray-800" role="tablist" aria-label="Lọc hoạt động">
				<button
					v-for="t in TABS"
					:key="t.key"
					type="button"
					role="tab"
					:aria-selected="kind === t.key"
					class="rounded-md px-2.5 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="kind === t.key ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
					@click="kind = t.key"
				>
					{{ t.label }}
				</button>
			</div>
		</div>

		<button
			v-if="page < totalPages"
			type="button"
			class="text-xs font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-brand-400"
			:disabled="loading"
			@click="load(false)"
		>
			Xem hoạt động cũ hơn
		</button>

		<div v-if="loading && !items.length" class="space-y-2">
			<div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>
		<div v-else-if="loadError" class="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
			{{ loadError }}
			<button type="button" class="font-medium underline" @click="load(true)">Thử lại</button>
		</div>
		<p v-else-if="!items.length" class="text-sm text-gray-500 dark:text-gray-400">
			{{ kind === 'history' ? 'Chưa có thay đổi nào.' : 'Chưa có bình luận. Bạn là người đầu tiên trao đổi về việc này.' }}
		</p>

		<ol class="space-y-3" data-testid="task-activity">
			<li v-for="it in items" :key="`${it.kind}-${it.comment?.id ?? it.event?.id}`">
				<!-- Bình luận -->
				<div v-if="it.comment" class="flex gap-2.5" :data-comment-id="it.comment.id">
					<CommonAppAvatar :src="it.comment.author.avatarUrl" :name="it.comment.author.fullName" size="sm" />
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ it.comment.author.fullName }}</span>
							<time class="text-xs text-gray-500 dark:text-gray-400" :title="formatDateTime(it.comment.createdAt)">{{ formatTimeAgo(it.comment.createdAt) }}</time>
							<span v-if="it.comment.editedAt && !it.comment.deleted" class="text-xs text-gray-400" :title="formatDateTime(it.comment.editedAt)">đã sửa</span>
							<div v-if="it.comment.canEdit && !it.comment.deleted && !disabled" class="relative ml-auto">
								<button
									type="button"
									class="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
									:aria-label="'Sửa hoặc xoá bình luận'"
									:aria-expanded="menuFor === it.comment.id"
									@click="menuFor = menuFor === it.comment.id ? null : it.comment.id"
								>
									<Icon name="heroicons:ellipsis-horizontal" class="h-5 w-5" />
								</button>
								<div
									v-if="menuFor === it.comment.id"
									class="absolute right-0 z-20 mt-1 w-32 rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
									role="menu"
								>
									<button type="button" role="menuitem" class="block w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800" @click="startEdit(it.comment)">Sửa</button>
									<button type="button" role="menuitem" class="block w-full px-3 py-1.5 text-left text-rose-600 hover:bg-gray-50 dark:hover:bg-gray-800" @click="remove(it.comment)">Xoá</button>
								</div>
							</div>
						</div>
						<p v-if="it.comment.deleted" class="mt-1 text-sm italic text-gray-400">Bình luận đã xoá</p>
						<div v-else-if="editingId === it.comment.id" class="mt-1 rounded-lg border border-gray-300 dark:border-gray-600">
							<TaskCommentEditor v-model="editBody" :task-id="task.id" autofocus @submit="saveEdit(it.comment)" />
							<div class="flex justify-end gap-2 border-t border-gray-100 px-2 py-1.5 dark:border-gray-800">
								<CommonAppButton size="sm" variant="secondary" @click="editingId = null">Huỷ</CommonAppButton>
								<CommonAppButton size="sm" @click="saveEdit(it.comment)">Lưu</CommonAppButton>
							</div>
						</div>
						<!-- eslint-disable-next-line vue/no-v-html -- đã lọc bằng sanitizeTaskComment -->
						<div
							v-else
							class="tt-prose mt-0.5 break-words text-sm text-gray-800 dark:text-gray-200 [&_.task-mention]:font-medium [&_.task-mention]:text-brand-700 dark:[&_.task-mention]:text-brand-300 [&_a]:text-brand-600 [&_a]:underline"
							v-html="safeHtml(it.comment.body)"
						/>
						<ul v-if="it.comment.attachments.length" class="mt-1 flex flex-wrap gap-1.5">
							<li v-for="a in it.comment.attachments" :key="a.id">
								<button
									type="button"
									class="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
									@click="emit('openFile', a)"
								>
									<Icon name="heroicons:paper-clip" class="h-3.5 w-3.5" />
									{{ a.fileName }}
								</button>
							</li>
						</ul>
					</div>
				</div>

				<!-- Sự kiện lịch sử -->
				<div v-else-if="it.event" class="flex gap-2.5 text-sm">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
					<p class="text-gray-600 dark:text-gray-300">
						<span class="font-medium text-gray-800 dark:text-gray-100">{{ it.event.actor?.fullName ?? 'Hệ thống' }}</span>
						{{ it.event.typeLabel.toLowerCase() }}<template v-if="eventDetail(it.event)">, {{ eventDetail(it.event) }}</template>
						<time class="ml-1 text-xs text-gray-400" :title="formatDateTime(it.event.createdAt)">{{ formatTimeAgo(it.event.createdAt) }}</time>
					</p>
				</div>
			</li>
		</ol>

		<!-- Ô bình luận dính đáy khung: dời sang chân khung chi tiết, ngoài vùng cuộn. -->
		<Teleport v-if="task.permissions.comment && !disabled" defer :to="composerTo || 'body'" :disabled="!composerTo">
		<div data-testid="task-comment-box">
			<div class="rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-brand-500 dark:border-gray-600 dark:bg-gray-800">
				<TaskCommentEditor
					ref="editorRef"
					v-model="draft"
					:task-id="task.id"
					@submit="send"
					@files="uploadFiles"
					@mentioned="onMentioned"
				>
					<template #toolbar>
						<button
							type="button"
							class="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-700"
							aria-label="Đính kèm file"
							:aria-expanded="showDropzone"
							@click="showDropzone = !showDropzone"
						>
							<Icon name="heroicons:paper-clip" class="h-4 w-4" />
						</button>
					</template>
				</TaskCommentEditor>
				<div v-if="showDropzone" class="border-t border-gray-100 p-2 dark:border-gray-700">
					<UiFileDropzone v-model="dropFile" :accept="TASK_FILE_ACCEPT" :max-size-mb="TASK_FILE_MAX_MB" multiple />
				</div>
				<ul v-if="pending.length || uploading" class="flex flex-wrap gap-1.5 border-t border-gray-100 px-2 py-1.5 dark:border-gray-700">
					<li v-for="a in pending" :key="a.id" class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
						<Icon name="heroicons:paper-clip" class="h-3.5 w-3.5" />
						{{ a.fileName }} · {{ taskFileSize(a.size) }}
					</li>
					<li v-if="uploading" class="text-xs text-gray-500">Đang tải {{ uploading }} file…</li>
				</ul>
				<div class="flex items-center justify-between gap-2 border-t border-gray-100 px-2 py-1.5 dark:border-gray-700">
					<span class="hidden text-xs text-gray-400 sm:inline">Ctrl+Enter để gửi</span>
					<CommonAppButton size="sm" :loading="sending" :disabled="!!uploading" class="ml-auto" data-testid="task-comment-send" @click="send">Gửi</CommonAppButton>
				</div>
			</div>
			<div
				v-for="c in cannotView"
				:key="c.id"
				data-testid="mention-warning"
				class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
			>
				<span class="flex-1">{{ c.fullName }} không xem được việc này nên sẽ không nhận thông báo.</span>
				<CommonAppButton
					v-if="task.permissions.manageWatchers"
					size="sm"
					variant="outline"
					:loading="addingWatcher === c.id"
					@click="addAsWatcher(c)"
				>
					Thêm {{ c.fullName }} làm người theo dõi
				</CommonAppButton>
			</div>
		</div>
		</Teleport>
		<RecruitConfirmModal
			v-if="confirmDelete"
			title="Xoá bình luận"
			description="Mọi người sẽ thấy dòng Bình luận đã xoá ở chỗ này."
			confirm-label="Xoá"
			@confirm="doRemove"
			@close="confirmDelete = null"
		/>
	</section>
</template>
