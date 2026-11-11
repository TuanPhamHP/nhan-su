<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import { splitMentionDraft } from '~/utils/recruitment-mention.utils';
	import { formatDateTime } from '~/utils/date';
	import type {
		RecruitmentApplicationBrief,
		RecruitmentComment,
		RecruitmentCommentKind,
		RecruitmentReason,
	} from '~/types/recruitment.types';

	/**
	 * Bình luận và đề xuất về một ứng viên.
	 *
	 * **Đề xuất (`SUGGEST_*`) chỉ vai trò MANAGER gửi được** — người khác, kể cả quản trị
	 * viên và nhân sự, nhận 403. Đó là lý do nút đề xuất chỉ hiện cho trưởng phòng. Hệ thống
	 * không tự áp dụng đề xuất: nhân sự đọc rồi tự bấm chuyển vòng, loại hay tạo offer.
	 */
	const props = defineProps<{
		candidateId: number;
		applications: RecruitmentApplicationBrief[];
		canWrite: boolean;
	}>();

	const toast = useToast();
	const service = useRecruitmentService();
	const { user } = useAuth();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const comments = ref<RecruitmentComment[]>([]);
	const loading = ref(true);
	const error = ref<string | null>(null);

	/**
	 * Nội dung thô của ô nhắc tên, còn giữ dấu `@[Tên](id)`.
	 *
	 * API tuyển dụng mang người được nhắc ở mảng `mentionIds` riêng chứ không dò dấu trong
	 * `body`, nên trước khi gửi phải tách hai thứ bằng `splitMentionDraft` — cùng một hàm mà
	 * trang hội đồng dùng, để hai nơi viết vào cùng một luồng bình luận ra cùng một dạng chữ.
	 */
	const draft = ref('');
	const kind = ref<RecruitmentCommentKind>('COMMENT');
	const applicationId = ref<number | undefined>(undefined);
	const toStageId = ref<number | undefined>(undefined);
	const reasonId = ref<number | undefined>(undefined);
	const reasons = ref<RecruitmentReason[]>([]);
	const submitting = ref(false);

	/** Chỉ trưởng phòng gửi được đề xuất, nên chỉ họ thấy ô chọn loại bình luận. */
	const canSuggest = computed(() => user.value?.role === 'MANAGER');

	async function load() {
		loading.value = true;
		error.value = null;
		try {
			comments.value = await service.candidateComments(props.candidateId);
		} catch (e) {
			comments.value = [];
			error.value = recruitErrorMessage(e, 'Không tải được bình luận');
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		await load();
		directoryStore.load().catch(() => {
			/* ô nhắc tên rỗng, bình luận vẫn gửi được */
		});
		if (canSuggest.value) {
			try {
				reasons.value = await service.findReasons({ kind: 'REJECTION', activeOnly: true });
			} catch {
				// Không có lý do thì chỉ mất đề xuất loại, phần còn lại vẫn dùng được.
			}
		}
	});

	watch(() => props.candidateId, load);

	const kindOptions = computed(() => [
		{ value: 'COMMENT', label: 'Bình luận' },
		...(canSuggest.value
			? [
					{ value: 'SUGGEST_MOVE', label: 'Đề xuất chuyển vòng' },
					{ value: 'SUGGEST_REJECT', label: 'Đề xuất loại' },
					{ value: 'SUGGEST_OFFER', label: 'Đề xuất tạo offer' },
				]
			: []),
	]);

	const applicationOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Không gắn hồ sơ nào' },
		...props.applications.map(a => ({
			value: a.id as number | undefined,
			label: `${a.job.title} — ${a.stage.name}`,
		})),
	]);

	const pickedApplication = computed(
		() => props.applications.find(a => a.id === applicationId.value) ?? null,
	);

	/**
	 * Vòng đích của đề xuất phải thuộc tin của hồ sơ. Danh sách hồ sơ chỉ mang vòng HIỆN TẠI
	 * chứ không mang đủ quy trình của tin, nên ở đây chỉ gợi ý được vòng đang đứng; muốn chọn
	 * vòng khác thì mở bảng hồ sơ của tin.
	 */
	const stageOptions = computed(() => {
		const app = pickedApplication.value;
		if (!app) return [{ value: undefined as number | undefined, label: 'Chọn hồ sơ trước' }];
		return [
			{ value: undefined as number | undefined, label: 'Chọn vòng...' },
			{ value: app.stage.id as number | undefined, label: `${app.stage.name} (vòng hiện tại)` },
		];
	});

	const reasonOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn lý do...' },
		...reasons.value.map(r => ({ value: r.id as number | undefined, label: r.name })),
	]);

	/** Nguồn tên để gõ `@`: danh bạ nhân viên của công ty. */
	const mentionEmployees = computed(() =>
		employees.value.map(e => ({ id: e.id, fullName: e.fullName, avatarUrl: e.avatarUrl ?? null })),
	);

	function mentionName(id: number): string {
		return employees.value.find(e => e.id === id)?.fullName ?? `#${id}`;
	}

	async function send() {
		const { body, mentionIds } = splitMentionDraft(draft.value);
		if (!body) {
			toast.error('Nhập nội dung bình luận');
			return;
		}
		if (kind.value !== 'COMMENT' && applicationId.value == null) {
			toast.error('Đề xuất phải gắn với một hồ sơ ứng tuyển');
			return;
		}
		submitting.value = true;
		try {
			await service.addCandidateComment(props.candidateId, {
				body,
				applicationId: applicationId.value,
				kind: kind.value,
				suggestion:
					kind.value === 'SUGGEST_MOVE'
						? { toStageId: toStageId.value }
						: kind.value === 'SUGGEST_REJECT'
							? { reasonId: reasonId.value }
							: undefined,
				mentionIds: mentionIds.length ? mentionIds : undefined,
			});
			draft.value = '';
			toStageId.value = undefined;
			reasonId.value = undefined;
			await load();
			toast.success('Đã gửi');
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Gửi bình luận thất bại'));
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<div class="space-y-4">
		<div v-if="canWrite" class="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
			<div v-if="canSuggest" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="space-y-1">
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Loại</label>
					<UiSelect v-model="kind" :options="kindOptions" />
				</div>
				<div v-if="kind !== 'COMMENT'" class="space-y-1">
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Hồ sơ ứng tuyển</label>
					<UiSelect v-model="applicationId" :options="applicationOptions" />
				</div>
				<div v-if="kind === 'SUGGEST_MOVE'" class="space-y-1">
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Đề xuất chuyển sang</label>
					<UiSelect v-model="toStageId" :options="stageOptions" />
				</div>
				<div v-if="kind === 'SUGGEST_REJECT'" class="space-y-1">
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Lý do loại</label>
					<UiSelect v-model="reasonId" :options="reasonOptions" />
				</div>
			</div>

			<CommonMentionInput
				v-model="draft"
				:employees="mentionEmployees"
				placeholder="Nhận xét về ứng viên, gõ @ để nhắc đồng nghiệp..."
			/>

			<div class="flex flex-wrap items-center gap-2">
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Người được nhắc nhận một thông báo trong ứng dụng.
				</p>
				<CommonAppButton class="ml-auto" variant="primary" size="sm" :loading="submitting" @click="send">
					Gửi
				</CommonAppButton>
			</div>

			<p v-if="canSuggest" class="text-xs text-gray-500 dark:text-gray-400">
				Đề xuất gửi thông báo cho nhân sự phụ trách tin, nhưng hệ thống không tự chuyển vòng hay loại
				hồ sơ: nhân sự xem rồi quyết.
			</p>
		</div>

		<div v-if="loading" class="space-y-2">
			<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<p v-else-if="error" class="text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>

		<p v-else-if="!comments.length" class="text-sm text-gray-500 dark:text-gray-400">
			Chưa có bình luận nào.
		</p>

		<ul v-else class="space-y-3">
			<li
				v-for="comment in comments"
				:key="comment.id"
				class="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
			>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="text-sm font-medium text-gray-900 dark:text-white">
						{{ comment.author.fullName }}
						<span
							v-if="comment.kind !== 'COMMENT'"
							class="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-normal text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
						>
							{{ comment.kindLabel }}
						</span>
					</p>
					<p class="text-xs text-gray-400">{{ formatDateTime(comment.createdAt) }}</p>
				</div>
				<p class="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{{ comment.body }}</p>
				<p v-if="comment.mentionIds.length" class="mt-1 text-xs text-gray-400">
					Đã nhắc {{ comment.mentionIds.map(mentionName).join(', ') }}
				</p>
			</li>
		</ul>
	</div>
</template>
