<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitJobFormModal from '~/components/modules/recruitment/RecruitJobFormModal.vue';
	import RecruitJobStagesModal from '~/components/modules/recruitment/RecruitJobStagesModal.vue';
	import RecruitJobTeamModal from '~/components/modules/recruitment/RecruitJobTeamModal.vue';
	import RecruitRejectApplicationModal from '~/components/modules/recruitment/RecruitRejectApplicationModal.vue';
	import RecruitTestResultsModal from '~/components/modules/recruitment/RecruitTestResultsModal.vue';
	import RecruitApplicationPanel from '~/components/modules/recruitment/RecruitApplicationPanel.vue';
	import {
		downloadRecruitmentBlob,
		formatRecruitMoney,
		formatScore,
		recruitErrorMessage,
		APPLICATION_STATUS_CLASS,
		JOB_STATUS_CLASS,
		STAGE_KIND_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import type {
		RecruitmentApplicationCard,
		RecruitmentApplicationStatus,
		RecruitmentJob,
		RecruitmentJobStage,
	} from '~/types/recruitment.types';

	definePageMeta({ title: 'Chi tiết tin tuyển dụng' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const jobId = computed(() => Number(route.params.id));
	const job = ref<RecruitmentJob | null>(null);
	const applications = ref<RecruitmentApplicationCard[]>([]);
	const loading = ref(true);
	const loadingCards = ref(false);
	const loadError = ref<string | null>(null);

	const canManage = computed(() => canWrite('RECRUIT') && hasPermission('recruitment:manage'));

	const tab = ref<RecruitmentApplicationStatus>('ACTIVE');
	const selected = ref<number[]>([]);
	const openApplicationId = ref<number | null>(null);

	const showEdit = ref(false);
	const showStages = ref(false);
	const showTeam = ref(false);
	const showBulkReject = ref(false);
	const showTestResults = ref<RecruitmentJobStage | null>(null);
	const confirmDelete = ref(false);
	const acting = ref(false);
	const exporting = ref(false);

	async function loadJob() {
		loading.value = true;
		loadError.value = null;
		try {
			job.value = await service.findJob(jobId.value);
		} catch (e) {
			job.value = null;
			loadError.value = recruitErrorMessage(e, 'Không mở được tin tuyển dụng này');
		} finally {
			loading.value = false;
		}
	}

	async function loadCards() {
		if (!job.value) return;
		loadingCards.value = true;
		selected.value = [];
		try {
			applications.value = await service.findJobApplications(jobId.value, { status: tab.value });
		} catch (e) {
			applications.value = [];
			toast.error(recruitErrorMessage(e, 'Không tải được danh sách hồ sơ'));
		} finally {
			loadingCards.value = false;
		}
	}

	onMounted(async () => {
		await loadJob();
		await loadCards();
	});

	watch(tab, loadCards);

	/** Tải lại cả tin lẫn thẻ: số hồ sơ mỗi vòng nằm trên tin, nên hai thứ phải đi cùng nhau. */
	async function reloadAll() {
		await loadJob();
		await loadCards();
	}

	// ─── Kanban ───────────────────────────────────────────────────────────────────

	const stages = computed(() => job.value?.stages ?? []);

	function cardsOfStage(stageId: number): RecruitmentApplicationCard[] {
		return applications.value.filter(a => a.stage.id === stageId);
	}

	const draggingId = ref<number | null>(null);
	const dragOverStageId = ref<number | null>(null);

	/**
	 * Kéo thả viết tay bằng HTML5 drag-and-drop, không thêm thư viện.
	 *
	 * Cột Đã tuyển không nhận thả: hồ sơ chỉ vào vòng đó qua nút "Tạo hồ sơ nhân viên" ở
	 * offer, gọi route chuyển vòng thẳng vào đó thì BE trả lỗi.
	 */
	function onDragStart(applicationId: number) {
		draggingId.value = applicationId;
	}

	function onDragEnd() {
		draggingId.value = null;
		dragOverStageId.value = null;
	}

	function canDropOn(stage: RecruitmentJobStage): boolean {
		return canManage.value && tab.value === 'ACTIVE' && stage.kind !== 'HIRED';
	}

	function onDragOver(stage: RecruitmentJobStage, event: DragEvent) {
		if (!canDropOn(stage)) return;
		event.preventDefault();
		dragOverStageId.value = stage.id;
	}

	async function onDrop(stage: RecruitmentJobStage) {
		const id = draggingId.value;
		onDragEnd();
		if (id == null || !canDropOn(stage)) return;
		const card = applications.value.find(a => a.id === id);
		if (!card || card.stage.id === stage.id) return;
		await moveOne(id, stage.id);
	}

	async function moveOne(applicationId: number, stageId: number) {
		if (acting.value) return;
		acting.value = true;
		try {
			await service.moveApplication(applicationId, stageId);
			toast.success('Đã chuyển vòng');
			await reloadAll();
		} catch (e) {
			// Vòng đích gắn mẫu email đã ngừng dùng thì BE từ chối TRƯỚC khi ghi, hồ sơ giữ
			// nguyên vòng cũ — nên chỉ cần tải lại là bảng khớp thực tế.
			toast.error(recruitErrorMessage(e, 'Chuyển vòng thất bại'));
			await loadCards();
		} finally {
			acting.value = false;
		}
	}

	// ─── Chọn nhiều ───────────────────────────────────────────────────────────────

	function toggleCard(id: number) {
		selected.value = selected.value.includes(id)
			? selected.value.filter(x => x !== id)
			: [...selected.value, id];
	}

	async function bulkMove(stageId: number) {
		if (!selected.value.length || acting.value) return;
		acting.value = true;
		try {
			const results = await service.bulkMoveApplications(selected.value, stageId);
			const failed = results.filter(r => !r.ok);
			if (failed.length) {
				toast.warning(`${failed.length}/${results.length} hồ sơ không chuyển được: ${failed[0]?.message ?? ''}`);
			} else {
				toast.success(`Đã chuyển ${results.length} hồ sơ`);
			}
			await reloadAll();
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Chuyển vòng hàng loạt thất bại'));
		} finally {
			acting.value = false;
		}
	}

	const bulkMoveStageId = ref<number | undefined>(undefined);

	const bulkStageOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chuyển sang vòng...' },
		...stages.value
			.filter(s => s.kind !== 'HIRED')
			.map(s => ({ value: s.id as number | undefined, label: s.name })),
	]);

	watch(bulkMoveStageId, id => {
		if (id != null) {
			bulkMove(id);
			bulkMoveStageId.value = undefined;
		}
	});

	// ─── Thao tác trên tin ────────────────────────────────────────────────────────

	async function runJob(action: () => Promise<RecruitmentJob>, okMessage: string) {
		if (acting.value) return;
		acting.value = true;
		try {
			job.value = await action();
			toast.success(okMessage);
			await loadCards();
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Thao tác thất bại'));
			await loadJob();
		} finally {
			acting.value = false;
		}
	}

	const openJob = () => runJob(() => service.openJob(jobId.value), 'Đã mở tin');
	const pauseJob = () => runJob(() => service.pauseJob(jobId.value), 'Đã tạm dừng tin');
	const closeJob = () => runJob(() => service.closeJob(jobId.value), 'Đã đóng tin');

	async function removeJob() {
		if (acting.value) return;
		acting.value = true;
		try {
			await service.deleteJob(jobId.value);
			toast.success('Đã xoá tin nháp');
			router.push('/management/recruitment/jobs');
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Xoá tin thất bại'));
		} finally {
			acting.value = false;
			confirmDelete.value = false;
		}
	}

	async function handleExport() {
		exporting.value = true;
		try {
			const blob = await service.exportJobApplications(jobId.value, { status: tab.value });
			downloadRecruitmentBlob(blob, `ho-so-tin-${jobId.value}.xlsx`);
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Xuất Excel thất bại'));
		} finally {
			exporting.value = false;
		}
	}

	const publicUrl = computed(() =>
		job.value && import.meta.client ? `${window.location.origin}${job.value.publicPath}` : '',
	);

	async function copyPublicLink() {
		try {
			await navigator.clipboard.writeText(publicUrl.value);
			toast.success('Đã chép link công khai');
		} catch {
			toast.error('Trình duyệt không cho chép tự động, hãy chép tay ở ô bên dưới');
		}
	}

	const tabs: { id: RecruitmentApplicationStatus; label: string }[] = [
		{ id: 'ACTIVE', label: 'Đang xét' },
		{ id: 'REJECTED', label: 'Đã loại' },
		{ id: 'WITHDRAWN', label: 'Rút hồ sơ' },
		{ id: 'HIRED', label: 'Đã tuyển' },
	];

	/** Vòng Bài test còn hồ sơ thì mới có chỗ để nhập điểm hàng loạt. */
	const testStages = computed(() => stages.value.filter(s => s.kind === 'TEST'));

	function cardsForTest(stage: RecruitmentJobStage): RecruitmentApplicationCard[] {
		return applications.value.filter(a => a.stage.id === stage.id && a.status === 'ACTIVE');
	}
</script>

<template>
	<div class="space-y-5">
		<NuxtLink
			to="/management/recruitment/jobs"
			class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Danh sách tin tuyển dụng
		</NuxtLink>

		<CommonAppModuleNotice module="RECRUIT" />

		<div v-if="loading" class="space-y-4">
			<div class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<NuxtLink
				to="/management/recruitment/jobs"
				class="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
			>
				Quay lại danh sách
			</NuxtLink>
		</div>

		<template v-else-if="job">
			<!-- Đầu trang -->
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ job.title }}</h1>
						<RecruitChip :label="job.statusLabel" :tone="JOB_STATUS_CLASS[job.status]" />
						<RecruitChip
							v-if="job.visibility === 'INTERNAL'"
							:label="job.visibilityLabel"
							tone="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
						/>
					</div>
					<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
						<span class="font-mono">{{ job.code }}</span>
						· {{ job.requisition.department.name }} · {{ job.requisition.position.name }} · cần
						{{ job.requisition.quantity }} người
						<template v-if="job.deadline"> · hạn nộp {{ formatDate(job.deadline) }}</template>
					</p>
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						Phụ trách {{ job.owner.fullName }} · yêu cầu
						<NuxtLink
							:to="`/management/recruitment/requisitions/${job.requisition.id}`"
							class="font-mono text-brand-600 hover:underline dark:text-brand-400"
						>
							{{ job.requisition.code }}
						</NuxtLink>
						<template v-if="job.canViewSalary && job.requisition.salaryMax != null">
							· khung lương {{ formatRecruitMoney(job.requisition.salaryMin) }} –
							{{ formatRecruitMoney(job.requisition.salaryMax) }}
						</template>
					</p>
				</div>

				<div v-if="canManage" class="flex flex-wrap items-center gap-2">
					<CommonAppButton variant="outline" size="sm" :loading="exporting" @click="handleExport">
						Xuất Excel
					</CommonAppButton>
					<CommonAppButton
						v-if="job.status !== 'CLOSED'"
						variant="outline"
						size="sm"
						@click="showStages = true"
					>
						Quy trình
					</CommonAppButton>
					<CommonAppButton variant="outline" size="sm" @click="showTeam = true">
						Hội đồng ({{ job.team.length }})
					</CommonAppButton>
					<CommonAppButton
						v-if="job.status !== 'CLOSED'"
						variant="outline"
						size="sm"
						@click="showEdit = true"
					>
						Sửa tin
					</CommonAppButton>
					<CommonAppButton
						v-if="job.status === 'DRAFT' || job.status === 'PAUSED'"
						variant="primary"
						size="sm"
						:loading="acting"
						@click="openJob"
					>
						Mở tin
					</CommonAppButton>
					<CommonAppButton
						v-if="job.status === 'OPEN'"
						variant="outline"
						size="sm"
						:loading="acting"
						@click="pauseJob"
					>
						Tạm dừng
					</CommonAppButton>
					<CommonAppButton
						v-if="job.status !== 'CLOSED'"
						variant="danger_outline"
						size="sm"
						:loading="acting"
						@click="closeJob"
					>
						Đóng tin
					</CommonAppButton>
					<CommonAppButton
						v-if="job.status === 'DRAFT'"
						variant="danger_outline"
						size="sm"
						@click="confirmDelete = true"
					>
						Xoá nháp
					</CommonAppButton>
				</div>
			</div>

			<!-- Link công khai -->
			<div class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<p class="text-xs text-gray-500 dark:text-gray-400">Link công khai</p>
				<code class="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-gray-300">{{ publicUrl }}</code>
				<button
					type="button"
					class="text-xs text-brand-600 hover:underline dark:text-brand-400"
					@click="copyPublicLink"
				>
					Chép
				</button>
				<a
					:href="publicUrl"
					target="_blank"
					rel="noopener"
					class="text-xs text-brand-600 hover:underline dark:text-brand-400"
				>
					Mở
				</a>
			</div>

			<!-- Tab trạng thái hồ sơ -->
			<div class="border-b border-gray-200 dark:border-gray-700">
				<nav class="-mb-px flex flex-wrap gap-1">
					<button
						v-for="t in tabs"
						:key="t.id"
						type="button"
						class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
						:class="
							tab === t.id
								? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
								: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
						"
						@click="tab = t.id"
					>
						{{ t.label }}
					</button>
				</nav>
			</div>

			<!-- Thanh chọn nhiều -->
			<div
				v-if="selected.length && canManage"
				class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-900/20"
			>
				<p class="text-sm text-brand-800 dark:text-brand-200">Đang chọn {{ selected.length }} hồ sơ</p>
				<div class="flex flex-wrap items-center gap-2">
					<div v-if="tab === 'ACTIVE'" class="w-52">
						<UiSelect v-model="bulkMoveStageId" :options="bulkStageOptions" />
					</div>
					<CommonAppButton
						v-if="tab === 'ACTIVE'"
						variant="danger_outline"
						size="sm"
						@click="showBulkReject = true"
					>
						Loại {{ selected.length }} hồ sơ
					</CommonAppButton>
					<CommonAppButton variant="ghost" size="sm" @click="selected = []">Bỏ chọn</CommonAppButton>
				</div>
			</div>

			<!-- Nhập điểm thi -->
			<div
				v-if="canManage && tab === 'ACTIVE' && testStages.length"
				class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<p class="text-sm text-gray-600 dark:text-gray-300">Nhập điểm thi hàng loạt cho vòng:</p>
				<CommonAppButton
					v-for="stage in testStages"
					:key="stage.id"
					variant="outline"
					size="sm"
					:disabled="!cardsForTest(stage).length"
					@click="showTestResults = stage"
				>
					{{ stage.name }} ({{ cardsForTest(stage).length }})
				</CommonAppButton>
			</div>

			<!-- Bảng kanban -->
			<div v-if="loadingCards" class="flex gap-3 overflow-x-auto pb-2">
				<div v-for="i in 4" :key="i" class="h-64 w-72 flex-shrink-0 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div v-else class="flex gap-3 overflow-x-auto pb-2">
				<div
					v-for="stage in stages"
					:key="stage.id"
					class="flex w-72 flex-shrink-0 flex-col rounded-xl border border-t-4 bg-gray-50 dark:bg-gray-800/40"
					:class="[
						STAGE_KIND_CLASS[stage.kind],
						dragOverStageId === stage.id
							? 'border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/20'
							: 'border-gray-200 dark:border-gray-700',
					]"
					@dragover="onDragOver(stage, $event)"
					@dragleave="dragOverStageId = null"
					@drop="onDrop(stage)"
				>
					<div class="flex items-center justify-between gap-2 px-3 py-2.5">
						<p class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ stage.name }}</p>
						<span class="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-gray-600 dark:bg-gray-900 dark:text-gray-300">
							{{ cardsOfStage(stage.id).length }}
						</span>
					</div>

					<div class="flex-1 space-y-2 px-2 pb-3">
						<p
							v-if="!cardsOfStage(stage.id).length"
							class="px-1 py-6 text-center text-xs text-gray-400 dark:text-gray-500"
						>
							{{ stage.kind === 'HIRED' ? 'Hồ sơ vào đây khi tạo hồ sơ nhân viên từ offer' : 'Chưa có hồ sơ' }}
						</p>

						<article
							v-for="card in cardsOfStage(stage.id)"
							:key="card.id"
							class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
							:class="[
								draggingId === card.id ? 'opacity-50' : '',
								selected.includes(card.id) ? 'ring-2 ring-brand-400' : '',
							]"
							:draggable="canManage && tab === 'ACTIVE'"
							@dragstart="onDragStart(card.id)"
							@dragend="onDragEnd"
						>
							<div class="flex items-start gap-2">
								<input
									v-if="canManage"
									type="checkbox"
									:checked="selected.includes(card.id)"
									class="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									:aria-label="`Chọn ${card.candidate.fullName}`"
									@change="toggleCard(card.id)"
								/>
								<div class="min-w-0 flex-1">
									<button
										type="button"
										class="block truncate text-left text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
										@click="openApplicationId = card.id"
									>
										{{ card.candidate.fullName }}
									</button>
									<p class="truncate text-xs text-gray-400">
										{{ card.candidate.email ?? card.candidate.phone ?? 'Chưa có liên hệ' }}
									</p>
								</div>
							</div>

							<div class="mt-2 flex flex-wrap items-center gap-1.5">
								<RecruitChip
									v-if="card.candidate.isBlacklisted"
									label="Không tái tuyển"
									tone="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
								/>
								<RecruitChip
									v-if="tab !== 'ACTIVE'"
									:label="card.statusLabel"
									:tone="APPLICATION_STATUS_CLASS[card.status]"
								/>
								<span v-if="card.score != null" class="text-xs text-gray-600 dark:text-gray-300">
									Điểm {{ formatScore(card.score) }}
								</span>
								<span
									v-if="card.verdicts.PASS || card.verdicts.FAIL || card.verdicts.CONSIDER"
									class="text-xs text-gray-400"
								>
									{{ card.verdicts.PASS }}/{{ card.verdicts.CONSIDER }}/{{ card.verdicts.FAIL }}
								</span>
							</div>

							<p v-if="card.source" class="mt-1 truncate text-xs text-gray-400">
								Nguồn {{ card.source.name }} · {{ formatDate(card.appliedAt) }}
							</p>
							<p v-if="card.rejectReason" class="mt-1 truncate text-xs text-rose-500">
								{{ card.rejectReason.name }}
							</p>
						</article>
					</div>
				</div>
			</div>

			<p v-if="canManage && tab === 'ACTIVE'" class="text-xs text-gray-500 dark:text-gray-400">
				Kéo thẻ sang cột khác để chuyển vòng. Cột Đã tuyển không nhận thả, vì hồ sơ chỉ vào vòng đó khi
				bấm "Tạo hồ sơ nhân viên" ở offer.
			</p>

			<!-- Modal -->
			<RecruitJobFormModal
				v-if="showEdit"
				:job="job"
				@saved="
					j => {
						job = j;
						showEdit = false;
						toast.success('Đã lưu tin tuyển dụng');
					}
				"
				@close="showEdit = false"
			/>

			<RecruitJobStagesModal
				v-if="showStages"
				:job="job"
				@saved="
					j => {
						job = j;
						showStages = false;
						toast.success('Đã lưu quy trình của tin');
						loadCards();
					}
				"
				@close="showStages = false"
			/>

			<RecruitJobTeamModal
				v-if="showTeam"
				:job="job"
				@saved="
					j => {
						job = j;
						showTeam = false;
						toast.success('Đã lưu hội đồng');
					}
				"
				@close="showTeam = false"
			/>

			<RecruitRejectApplicationModal
				v-if="showBulkReject"
				:application-ids="selected"
				@done="
					showBulkReject = false;
					toast.success('Đã loại các hồ sơ đã chọn');
					reloadAll();
				"
				@close="showBulkReject = false"
			/>

			<RecruitTestResultsModal
				v-if="showTestResults"
				:stage-id="showTestResults.id"
				:stage-name="showTestResults.name"
				:applications="cardsForTest(showTestResults)"
				@done="
					showTestResults = null;
					toast.success('Đã lưu điểm thi');
					reloadAll();
				"
				@close="showTestResults = null"
			/>

			<RecruitApplicationPanel
				v-if="openApplicationId"
				:application-id="openApplicationId"
				:job="job"
				:can-manage="canManage"
				@changed="reloadAll"
				@close="openApplicationId = null"
			/>

			<Teleport to="body">
				<div v-if="confirmDelete" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
					<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Xoá tin nháp</h2>
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
							Xoá <strong class="font-mono">{{ job.code }}</strong> khỏi danh sách. Chỉ tin Nháp xoá
							được; tin đã từng mở thì dùng nút Đóng tin.
						</p>
						<div class="mt-5 flex justify-end gap-3">
							<CommonAppButton variant="secondary" @click="confirmDelete = false">Huỷ</CommonAppButton>
							<CommonAppButton variant="danger" :loading="acting" @click="removeJob">Xoá</CommonAppButton>
						</div>
					</div>
				</div>
			</Teleport>
		</template>
	</div>
</template>
