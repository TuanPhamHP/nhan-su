<script setup lang="ts">
	import MentionInput from '~/components/common/MentionInput.vue';
	import { useRecruitmentMeService } from '~/services/recruitment-me.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import { splitMentionDraft } from '~/utils/recruitment-mention.utils';
	import { formatDateTime } from '~/utils/date';
	import type {
		RecruitmentComment,
		RecruitmentCommentKind,
		RecruitmentPerson,
	} from '~/types/recruitment-me.types';

	/**
	 * Bình luận và đề xuất trên một hồ sơ ứng tuyển, phía người ngồi hội đồng.
	 *
	 * Chỉ người có vai trò `MANAGER` gửi được bình luận loại `SUGGEST_*` (L15); người khác gửi
	 * sẽ nhận 403 `RECRUIT_SUGGESTION_FORBIDDEN`, nên ô chọn loại chỉ hiện cho trưởng phòng.
	 *
	 * Người nhắc được lấy từ `team` của tin (`GET /v1/me/recruitment/jobs`), KHÔNG phải từ
	 * `useDirectoryStore`: thành viên hội đồng có thể là `EMPLOYEE`, mà `EMPLOYEE` gọi
	 * `/v1/employees` sẽ nhận 403.
	 */
	const props = defineProps<{
		applicationId: number;
		/** Vòng của tin, để đề xuất chuyển vòng chọn được đích. */
		stages: { id: number; name: string }[];
		/** Thành viên hội đồng của tin — danh sách nhắc tên. */
		team: RecruitmentPerson[];
		canWrite: boolean;
		isManager: boolean;
	}>();

	const service = useRecruitmentMeService();
	const toast = useToast();

	const items = ref<RecruitmentComment[]>([]);
	const loading = ref(true);
	/** Nội dung thô của `MentionInput`: chữ thường kèm dấu `@[Tên](id)` ở chỗ nhắc tên. */
	const draft = ref('');
	const kind = ref<RecruitmentCommentKind>('COMMENT');
	const toStageId = ref<number | undefined>(undefined);
	const sending = ref(false);
	const inputRef = ref<InstanceType<typeof MentionInput> | null>(null);

	const KIND_OPTIONS: { value: RecruitmentCommentKind; label: string }[] = [
		{ value: 'COMMENT', label: 'Bình luận' },
		{ value: 'SUGGEST_MOVE', label: 'Đề xuất chuyển vòng' },
		{ value: 'SUGGEST_REJECT', label: 'Đề xuất loại' },
		{ value: 'SUGGEST_OFFER', label: 'Đề xuất offer' },
	];

	const mentionable = computed(() => props.team.map(p => ({ ...p, avatarUrl: null })));

	/** Tra tên người được nhắc để hiện lại dưới bình luận; id lạ thì bỏ qua. */
	const nameById = computed(() => new Map(props.team.map(p => [p.id, p.fullName])));

	function mentionNames(ids: number[]): string {
		return ids.map(id => nameById.value.get(id)).filter(Boolean).join(', ');
	}

	async function load() {
		loading.value = true;
		try {
			items.value = await service.comments(props.applicationId);
		} catch (e) {
			items.value = [];
			toast.error(recruitErrorMessage(e, 'Không tải được bình luận'));
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	async function send() {
		const { body, mentionIds } = splitMentionDraft(draft.value);
		if (!body) {
			toast.error('Bạn nhập nội dung trước đã');
			return;
		}
		if (kind.value === 'SUGGEST_MOVE' && !toStageId.value) {
			toast.error('Đề xuất chuyển vòng phải chọn vòng muốn chuyển tới');
			return;
		}

		sending.value = true;
		try {
			const created = await service.addComment(props.applicationId, {
				body,
				kind: kind.value,
				// `SUGGEST_REJECT` cần lý do loại, mà danh mục lý do không mở cho nhóm `/me`,
				// nên ở đây trưởng phòng viết lý do vào nội dung và HR chọn mã lúc bấm loại.
				suggestion: kind.value === 'SUGGEST_MOVE' ? { toStageId: toStageId.value } : undefined,
				mentionIds: mentionIds.length ? mentionIds : undefined,
			});
			items.value = [created, ...items.value];
			draft.value = '';
			inputRef.value?.reset();
			kind.value = 'COMMENT';
			toStageId.value = undefined;
			toast.success('Đã gửi');
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Không gửi được bình luận'));
		} finally {
			sending.value = false;
		}
	}
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
		<h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
			Bình luận của hội đồng
		</h3>

		<div v-if="canWrite" class="space-y-2.5 border-b border-gray-200 p-4 dark:border-gray-700">
			<div v-if="isManager" class="flex flex-wrap gap-2">
				<button
					v-for="opt in KIND_OPTIONS"
					:key="opt.value"
					type="button"
					class="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
					:class="kind === opt.value
						? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
						: 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'"
					@click="kind = opt.value"
				>
					{{ opt.label }}
				</button>
			</div>

			<UiSelect
				v-if="kind === 'SUGGEST_MOVE'"
				v-model="toStageId"
				:options="stages.map(s => ({ value: s.id, label: s.name }))"
				placeholder="Chọn vòng muốn chuyển tới"
			/>

			<MentionInput
				ref="inputRef"
				v-model="draft"
				:employees="mentionable"
				:placeholder="kind === 'COMMENT'
					? 'Nhận xét của bạn về ứng viên này… (gõ @ để nhắc đồng nghiệp)'
					: 'Lý do bạn đề xuất… (gõ @ để nhắc đồng nghiệp)'"
				class="w-full"
				@submit="send"
			/>
			<CommonAppButton size="sm" :loading="sending" @click="send">Gửi</CommonAppButton>
		</div>

		<div v-if="loading" class="space-y-3 p-4">
			<div v-for="i in 2" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<p v-else-if="!items.length" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
			Chưa có bình luận nào.
		</p>

		<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
			<li v-for="c in items" :key="c.id" class="px-4 py-3">
				<div class="flex flex-wrap items-center gap-2">
					<p class="text-sm font-medium text-gray-900 dark:text-white">{{ c.author.fullName }}</p>
					<span
						v-if="c.kind !== 'COMMENT'"
						class="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
					>
						{{ c.kindLabel }}
					</span>
					<span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDateTime(c.createdAt) }}</span>
				</div>
				<p class="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{{ c.body }}</p>
				<p v-if="mentionNames(c.mentionIds)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Đã nhắc {{ mentionNames(c.mentionIds) }}
				</p>
			</li>
		</ul>
	</section>
</template>
