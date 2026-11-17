<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitScorecardsPanel from '~/components/modules/recruitment/RecruitScorecardsPanel.vue';
	import RecruitRejectApplicationModal from '~/components/modules/recruitment/RecruitRejectApplicationModal.vue';
	import RecruitInterviewFormModal from '~/components/modules/recruitment/RecruitInterviewFormModal.vue';
	import RecruitOfferFormModal from '~/components/modules/recruitment/RecruitOfferFormModal.vue';
	import RecruitNotePromptModal from '~/components/modules/recruitment/RecruitNotePromptModal.vue';
	import {
		formatFileSizeVn,
		formatRecruitMoney,
		openPresignedUrl,
		recruitErrorMessage,
		APPLICATION_STATUS_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type {
		RecruitmentApplicationView,
		RecruitmentJob,
	} from '~/types/recruitment.types';

	/**
	 * Ngăn chi tiết của một hồ sơ ứng tuyển, mở từ bảng kanban.
	 *
	 * Mỗi lần mở gọi `GET /applications/:id`, và BE GHI NHẬT KÝ XEM cho mỗi lần gọi (ngoại
	 * lệ có chủ ý của quy tắc "không log GET"), nên panel chỉ tải một lần khi mở và tải lại
	 * sau thao tác ghi, không tải lại mỗi lần đổi tab.
	 */
	const props = defineProps<{
		applicationId: number;
		job: RecruitmentJob;
		canManage: boolean;
	}>();

	const emit = defineEmits<{ changed: []; close: [] }>();

	const toast = useToast();
	const service = useRecruitmentService();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const item = ref<RecruitmentApplicationView | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const activeTab = ref<'info' | 'scorecards'>('info');
	const acting = ref(false);

	const showReject = ref(false);
	const showInterview = ref(false);
	const showOffer = ref(false);
	const withdrawing = ref(false);
	const showRequestScorecard = ref(false);
	const requestEvaluatorId = ref<number | undefined>(undefined);
	const moveStageId = ref<number | undefined>(undefined);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			item.value = await service.findApplication(props.applicationId);
			moveStageId.value = item.value.stage.id;
		} catch (e) {
			item.value = null;
			loadError.value = recruitErrorMessage(e, 'Không mở được hồ sơ này');
		} finally {
			loading.value = false;
		}
	}

	onMounted(() => {
		load();
		directoryStore.load().catch(() => {
			/* ô chọn người đánh giá rỗng, phần còn lại vẫn chạy */
		});
	});

	watch(() => props.applicationId, load);

	const isActive = computed(() => item.value?.status === 'ACTIVE');
	const stageKind = computed(() => item.value?.stage.kind ?? null);

	const canSchedule = computed(
		() => props.canManage && isActive.value && (stageKind.value === 'INTERVIEW' || stageKind.value === 'TEST'),
	);
	const canCreateOffer = computed(
		() => props.canManage && isActive.value && stageKind.value === 'OFFER',
	);
	const canReopen = computed(
		() => props.canManage && !!item.value && ['REJECTED', 'WITHDRAWN'].includes(item.value.status),
	);

	/**
	 * Vòng chuyển tới được: mọi vòng của tin TRỪ vòng Đã tuyển — hồ sơ chỉ vào vòng đó qua
	 * nút "Tạo hồ sơ nhân viên" ở offer, gọi thẳng thì BE trả lỗi.
	 */
	const stageOptions = computed(() =>
		props.job.stages
			.filter(s => s.kind !== 'HIRED')
			.map(s => ({ value: s.id as number | undefined, label: `${s.name} (${s.kindLabel})` })),
	);

	const evaluatorOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn người đánh giá...' },
		...employees.value.map(e => ({
			value: e.id as number | undefined,
			label: `${e.fullName} (${e.employeeCode})`,
		})),
	]);

	async function run(action: () => Promise<unknown>, okMessage: string) {
		if (acting.value) return;
		acting.value = true;
		try {
			await action();
			toast.success(okMessage);
			await load();
			emit('changed');
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Thao tác thất bại'));
		} finally {
			acting.value = false;
		}
	}

	async function moveStage() {
		if (moveStageId.value == null || moveStageId.value === item.value?.stage.id) return;
		await run(
			() => service.moveApplication(props.applicationId, moveStageId.value as number),
			'Đã chuyển vòng',
		);
	}

	async function doWithdraw(note: string) {
		await service.withdrawApplication(props.applicationId, note || undefined);
	}

	const reopen = () =>
		run(() => service.reopenApplication(props.applicationId), 'Đã mở lại hồ sơ, thư từ chối đang hẹn đã bị huỷ');

	async function requestScorecard() {
		if (requestEvaluatorId.value == null || !item.value) return;
		await run(
			() =>
				service.requestScorecard({
					applicationId: props.applicationId,
					stageId: item.value?.stage.id as number,
					evaluatorId: requestEvaluatorId.value as number,
				}),
			'Đã gửi yêu cầu đánh giá',
		);
		showRequestScorecard.value = false;
		requestEvaluatorId.value = undefined;
	}

	async function openFile(fileId: number) {
		try {
			await openPresignedUrl(() => service.candidateFileUrl(fileId));
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Không mở được file'));
		}
	}

	async function afterChange() {
		showReject.value = false;
		showInterview.value = false;
		showOffer.value = false;
		withdrawing.value = false;
		await load();
		emit('changed');
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[55] flex justify-end bg-black/40" @click.self="emit('close')">
			<aside class="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<div class="min-w-0">
						<h2 class="truncate text-base font-semibold text-gray-900 dark:text-white">
							{{ item?.candidate.fullName ?? 'Hồ sơ ứng tuyển' }}
						</h2>
						<p v-if="item" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ item.job.title }} · vòng {{ item.stage.name }}
						</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div v-if="loading" class="space-y-3 p-5">
					<div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
				</div>

				<p v-else-if="loadError" class="p-5 text-sm text-rose-600 dark:text-rose-400">{{ loadError }}</p>

				<template v-else-if="item">
					<div class="border-b border-gray-200 px-5 dark:border-gray-700">
						<nav class="-mb-px flex gap-1">
							<button
								v-for="tab in [
									{ id: 'info', label: 'Thông tin' },
									{ id: 'scorecards', label: 'Đánh giá' },
								]"
								:key="tab.id"
								type="button"
								class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
								:class="
									activeTab === tab.id
										? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
										: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
								"
								@click="activeTab = tab.id as 'info' | 'scorecards'"
							>
								{{ tab.label }}
							</button>
						</nav>
					</div>

					<div class="flex-1 overflow-y-auto p-5">
						<template v-if="activeTab === 'info'">
							<div class="flex flex-wrap items-center gap-2">
								<RecruitChip :label="item.statusLabel" :tone="APPLICATION_STATUS_CLASS[item.status]" />
								<RecruitChip
									v-if="item.candidate.isBlacklisted"
									label="Không tái tuyển"
									tone="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
								/>
								<RecruitChip
									v-if="item.candidate.anonymizedAt"
									label="Đã ẩn danh"
									tone="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
								/>
								<NuxtLink
									:to="`/management/recruitment/candidates/${item.candidateId}`"
									class="ml-auto text-sm text-brand-600 hover:underline dark:text-brand-400"
								>
									Mở hồ sơ ứng viên
								</NuxtLink>
							</div>

							<dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Email</dt>
									<dd class="truncate text-sm text-gray-900 dark:text-white">
										{{ item.candidate.email ?? '—' }}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Điện thoại</dt>
									<dd class="text-sm text-gray-900 dark:text-white">{{ item.candidate.phone ?? '—' }}</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Lương mong muốn</dt>
									<dd class="text-sm text-gray-900 dark:text-white">
										<template v-if="item.canViewSalary">
											{{ formatRecruitMoney(item.candidate.expectedSalary) }}
										</template>
										<template v-else>
											<span class="text-gray-400">Bạn không được xem</span>
										</template>
									</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Nguồn</dt>
									<dd class="text-sm text-gray-900 dark:text-white">{{ item.source?.name ?? '—' }}</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Ngày ứng tuyển</dt>
									<dd class="text-sm text-gray-900 dark:text-white">{{ formatDate(item.appliedAt) }}</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Vào vòng hiện tại</dt>
									<dd class="text-sm text-gray-900 dark:text-white">
										{{ formatDateTime(item.stageEnteredAt) }}
									</dd>
								</div>
							</dl>

							<div
								v-if="item.rejectReason || item.closedNote"
								class="mt-4 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60"
							>
								<p v-if="item.rejectReason" class="text-sm text-gray-700 dark:text-gray-300">
									Lý do đóng hồ sơ: {{ item.rejectReason.name }}
								</p>
								<p v-if="item.closedNote" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
									{{ item.closedNote }}
								</p>
							</div>

							<!-- File -->
							<div class="mt-5">
								<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Hồ sơ và tài liệu</h3>
								<p v-if="!item.files.length" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Ứng viên chưa có file nào.
								</p>
								<ul v-else class="mt-2 space-y-1.5">
									<li
										v-for="file in item.files"
										:key="file.id"
										class="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
									>
										<div class="min-w-0">
											<button
												type="button"
												class="truncate text-sm text-brand-600 hover:underline dark:text-brand-400"
												@click="openFile(file.id)"
											>
												{{ file.fileName }}
											</button>
											<p class="text-xs text-gray-400">
												{{ file.kindLabel }} · {{ formatFileSizeVn(file.sizeBytes) }}
												<template v-if="item.cvFileId === file.id"> · CV của lần ứng tuyển này</template>
											</p>
										</div>
									</li>
								</ul>
							</div>

							<!-- Thao tác -->
							<div v-if="canManage" class="mt-5 space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
								<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Thao tác</h3>

								<div v-if="isActive" class="space-y-1">
									<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
										Chuyển vòng
									</label>
									<div class="flex flex-wrap items-center gap-2">
										<div class="min-w-[14rem] flex-1">
											<UiSelect v-model="moveStageId" :options="stageOptions" />
										</div>
										<CommonAppButton
											variant="outline"
											size="sm"
											:disabled="moveStageId === item.stage.id || acting"
											@click="moveStage"
										>
											Chuyển
										</CommonAppButton>
									</div>
									<p class="text-xs text-gray-500 dark:text-gray-400">
										Vòng Đã tuyển không có ở đây: hồ sơ vào vòng đó khi bấm "Tạo hồ sơ nhân viên" ở
										offer.
									</p>
								</div>

								<div class="flex flex-wrap gap-2">
									<CommonAppButton v-if="canSchedule" variant="outline" size="sm" @click="showInterview = true">
										Đặt lịch phỏng vấn
									</CommonAppButton>
									<CommonAppButton
										v-if="isActive"
										variant="outline"
										size="sm"
										@click="showRequestScorecard = !showRequestScorecard"
									>
										Nhờ đánh giá
									</CommonAppButton>
									<CommonAppButton v-if="canCreateOffer" variant="primary" size="sm" @click="showOffer = true">
										Tạo offer
									</CommonAppButton>
									<CommonAppButton v-if="isActive" variant="outline" size="sm" @click="withdrawing = true">
										Ứng viên rút hồ sơ
									</CommonAppButton>
									<CommonAppButton v-if="isActive" variant="danger_outline" size="sm" @click="showReject = true">
										Loại hồ sơ
									</CommonAppButton>
									<CommonAppButton v-if="canReopen" variant="primary" size="sm" :loading="acting" @click="reopen">
										Mở lại hồ sơ
									</CommonAppButton>
								</div>

								<div v-if="showRequestScorecard" class="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
									<p class="text-xs text-gray-600 dark:text-gray-400">
										Người được nhờ sẽ vào hội đồng của tin và nhận một phiếu chờ chấm cho vòng
										{{ item.stage.name }}.
									</p>
									<UiSelect v-model="requestEvaluatorId" :options="evaluatorOptions" />
									<div class="flex justify-end gap-2">
										<CommonAppButton variant="ghost" size="sm" @click="showRequestScorecard = false">
											Thôi
										</CommonAppButton>
										<CommonAppButton
											variant="primary"
											size="sm"
											:disabled="requestEvaluatorId == null || acting"
											@click="requestScorecard"
										>
											Gửi yêu cầu
										</CommonAppButton>
									</div>
								</div>
							</div>
						</template>

						<RecruitScorecardsPanel v-else :application-id="applicationId" />
					</div>
				</template>
			</aside>
		</div>
	</Teleport>

	<RecruitRejectApplicationModal
		v-if="showReject && item"
		:application-ids="[applicationId]"
		:candidate-name="item.candidate.fullName"
		@done="afterChange"
		@close="showReject = false"
	/>

	<RecruitInterviewFormModal
		v-if="showInterview && item"
		:application-id="applicationId"
		:candidate-name="item.candidate.fullName"
		:stage-kind="item.stage.kind"
		@saved="afterChange"
		@close="showInterview = false"
	/>

	<RecruitOfferFormModal
		v-if="showOffer && item"
		:application-id="applicationId"
		:candidate-name="item.candidate.fullName"
		:salary-max="job.requisition.salaryMax"
		@saved="afterChange"
		@close="showOffer = false"
	/>

	<RecruitNotePromptModal
		v-if="withdrawing"
		title="Ứng viên rút hồ sơ"
		description="Hồ sơ chuyển sang Rút hồ sơ và bắt đầu tính thời hạn lưu dữ liệu. Hệ thống không gửi email nào cho ứng viên."
		label="Ghi chú"
		placeholder="Ứng viên báo đã nhận việc nơi khác..."
		:required="false"
		confirm-label="Ghi nhận"
		:submit="doWithdraw"
		@done="afterChange"
		@close="withdrawing = false"
	/>
</template>
