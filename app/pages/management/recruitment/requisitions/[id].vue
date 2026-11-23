<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitApprovalTimeline from '~/components/modules/recruitment/RecruitApprovalTimeline.vue';
	import RecruitRequisitionFormModal from '~/components/modules/recruitment/RecruitRequisitionFormModal.vue';
	import RecruitNotePromptModal from '~/components/modules/recruitment/RecruitNotePromptModal.vue';
	import RecruitJobFormModal from '~/components/modules/recruitment/RecruitJobFormModal.vue';
	import {
		formatRecruitMoney,
		openPresignedUrl,
		recruitErrorMessage,
		JOB_STATUS_CLASS,
		REQUISITION_STATUS_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { Availability, Requisition } from '~/types/recruitment.types';

	definePageMeta({ title: 'Chi tiết yêu cầu tuyển dụng' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const requisitionId = computed(() => Number(route.params.id));
	const item = ref<Requisition | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);

	const writable = computed(() => canWrite('RECRUIT'));
	const canManage = computed(() => writable.value && hasPermission('recruitment:manage'));
	const canEditOwn = computed(
		() => writable.value && hasPermission('recruitment:requisition:create'),
	);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			item.value = await service.findRequisition(requisitionId.value);
		} catch (e) {
			// Ngoài phạm vi (403) hay không tồn tại (404) đều vào đây: nói lý do, không trắng trang.
			item.value = null;
			loadError.value = recruitErrorMessage(e, 'Không mở được yêu cầu tuyển dụng này');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	// ─── Định biên (BR-01) ────────────────────────────────────────────────────────
	//
	// Định biên không còn chặn gửi hay duyệt: duyệt xong bước cuối thì BE tự tăng định biên phần
	// thiếu, chưa có dòng thì tự tạo. Trang chỉ báo trước điều đó. `item.available` đủ để tính
	// phần thiếu, còn `confirmed` (chỉ có ở `/requisitions/availability`) cho biết vị trí đã có
	// định biên chưa, nên gọi thêm một lần cho Nháp, Bị từ chối và Chờ duyệt.

	const availability = ref<Availability | null>(null);

	async function loadAvailability() {
		const r = item.value;
		availability.value = null;
		if (!r || !['DRAFT', 'REJECTED', 'PENDING'].includes(r.status)) return;
		try {
			availability.value = await service.availability({
				positionId: r.position.id,
				year: r.year,
				excludeId: r.id,
			});
		} catch {
			// Người duyệt ngoài phạm vi phòng ban nhận 403 ở đây. Vẫn còn `item.available` để
			// báo phần thiếu, chỉ không nói được là vị trí đã có định biên hay chưa.
		}
	}

	watch(item, loadAvailability);

	/** Vị trí chưa có định biên của năm: duyệt xong bước cuối BE sẽ tự tạo. */
	const headcountNotConfirmed = computed(() => availability.value?.confirmed === null);

	/** Phần dự kiến tăng thêm khi duyệt xong; con số thật tính lúc duyệt bước cuối. */
	const headcountShortfall = computed(() => {
		const r = item.value;
		if (!r || r.available == null) return 0;
		return Math.max(r.quantity - Math.max(r.available, 0), 0);
	});

	/** Câu thông tin về định biên, null khi đủ chỗ hay trạng thái không còn liên quan. */
	const headcountInfo = computed(() => {
		const r = item.value;
		if (!r || !['DRAFT', 'REJECTED', 'PENDING'].includes(r.status)) return null;
		const pending = r.status === 'PENDING';
		if (headcountNotConfirmed.value) {
			return {
				title: `Vị trí này chưa có định biên năm ${r.year}`,
				body: pending
					? 'Khi yêu cầu được duyệt xong, hệ thống sẽ tự tạo định biên.'
					: 'Bạn vẫn gửi duyệt được, khi yêu cầu được duyệt xong hệ thống sẽ tự tạo định biên.',
			};
		}
		if (headcountShortfall.value > 0) {
			const n = headcountShortfall.value;
			return {
				title: `Xin ${r.quantity}, định biên còn trống ${Math.max(r.available ?? 0, 0)}`,
				body: pending
					? `Duyệt xong bước cuối, định biên sẽ tự tăng thêm khoảng ${n} người.`
					: `Bạn vẫn gửi duyệt được, khi duyệt xong định biên sẽ tự tăng thêm khoảng ${n} người.`,
			};
		}
		return null;
	});

	const headcountLink = computed(
		() => `/management/recruitment/headcount?year=${item.value?.year ?? new Date().getFullYear()}`,
	);

	/** Sửa, tải JD, xoá chỉ mở khi Nháp hoặc Bị từ chối (người phụ trách tuyển dụng tải JD mọi lúc). */
	const editable = computed(
		() => !!item.value && ['DRAFT', 'REJECTED'].includes(item.value.status) && canEditOwn.value,
	);
	const canSubmit = computed(() => editable.value);
	const canCancel = computed(
		() => !!item.value && !['CANCELLED', 'FILLED'].includes(item.value.status) && canEditOwn.value,
	);
	const canDelete = computed(() => !!item.value && item.value.status === 'DRAFT' && canEditOwn.value);
	const canCreateJob = computed(
		() => !!item.value && ['APPROVED', 'RECRUITING'].includes(item.value.status) && canManage.value,
	);

	const showEdit = ref(false);
	const showJobForm = ref(false);
	const rejecting = ref(false);
	const cancelling = ref(false);
	const confirmDelete = ref(false);
	const acting = ref(false);
	/** File JD vừa chọn ở ô kéo thả; tải lên ngay rồi xoá khỏi ô. */
	const pickedJd = ref<File | null>(null);

	async function run(action: () => Promise<Requisition>, okMessage: string) {
		if (acting.value) return;
		acting.value = true;
		try {
			item.value = await action();
			toast.success(okMessage);
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Thao tác thất bại'));
			// Lỗi 409 thường nghĩa là bản ghi đã đổi ở nơi khác, nên tải lại cho khớp.
			await load();
		} finally {
			acting.value = false;
		}
	}

	const submit = () =>
		run(
			() => service.submitRequisition(requisitionId.value),
			'Đã gửi duyệt, người duyệt bước đầu nhận được thông báo',
		);

	const approve = () => run(() => service.approveRequisition(requisitionId.value), 'Đã duyệt');

	async function doReject(note: string) {
		item.value = await service.rejectRequisition(requisitionId.value, note);
	}

	async function doCancel(reason: string) {
		item.value = await service.cancelRequisition(requisitionId.value, reason);
	}

	async function removeRequisition() {
		if (acting.value) return;
		acting.value = true;
		try {
			await service.deleteRequisition(requisitionId.value);
			toast.success('Đã xoá bản nháp');
			router.push('/management/recruitment/requisitions');
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Xoá thất bại'));
		} finally {
			acting.value = false;
			confirmDelete.value = false;
		}
	}

	// ─── File JD ──────────────────────────────────────────────────────────────────

	const uploadingJd = ref(false);

	// Chọn xong là tải luôn; ô kéo thả đã chặn sẵn sai định dạng và quá 5 MB.
	watch(pickedJd, async file => {
		if (!file || uploadingJd.value) return;
		uploadingJd.value = true;
		try {
			item.value = await service.uploadRequisitionJd(requisitionId.value, file);
			toast.success('Đã tải file JD');
		} catch (err) {
			toast.error(recruitErrorMessage(err, 'Tải file JD thất bại'));
		} finally {
			uploadingJd.value = false;
			pickedJd.value = null;
		}
	});

	async function openJd() {
		try {
			await openPresignedUrl(() => service.requisitionJdUrl(requisitionId.value));
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Không mở được file JD'));
		}
	}

	function onJobCreated(jobId: number) {
		showJobForm.value = false;
		router.push(`/management/recruitment/jobs/${jobId}`);
	}

	const salaryText = computed(() => {
		const r = item.value;
		if (!r) return '—';
		if (!r.canViewSalary) return 'Bạn không được xem khung lương của yêu cầu này';
		if (r.salaryMin == null && r.salaryMax == null) return 'Chưa nhập khung lương';
		return `${formatRecruitMoney(r.salaryMin)} – ${formatRecruitMoney(r.salaryMax)}`;
	});
</script>

<template>
	<div class="space-y-5">
		<NuxtLink
			to="/management/recruitment/requisitions"
			class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Danh sách yêu cầu tuyển dụng
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
				to="/management/recruitment/requisitions"
				class="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
			>
				Quay lại danh sách
			</NuxtLink>
		</div>

		<template v-else-if="item">
			<!-- Đầu trang -->
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ item.position.name }}</h1>
						<RecruitChip :label="item.statusLabel" :tone="REQUISITION_STATUS_CLASS[item.status]" />
					</div>
					<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
						<span class="font-mono">{{ item.code }}</span>
						· {{ item.department.name }} · {{ item.quantity }} người · định biên năm {{ item.year }}
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<CommonAppButton v-if="editable" variant="outline" @click="showEdit = true">
						Sửa
					</CommonAppButton>
					<CommonAppButton
						v-if="canSubmit"
						variant="primary"
						:loading="acting"
						@click="submit"
					>
						Gửi duyệt
					</CommonAppButton>
					<CommonAppButton
						v-if="item.canApprove && writable"
						variant="danger_outline"
						@click="rejecting = true"
					>
						Từ chối
					</CommonAppButton>
					<CommonAppButton
						v-if="item.canApprove && writable"
						variant="primary"
						:loading="acting"
						@click="approve"
					>
						Duyệt
					</CommonAppButton>
					<CommonAppButton v-if="canCreateJob" variant="primary" @click="showJobForm = true">
						Tạo tin tuyển dụng
					</CommonAppButton>
					<CommonAppButton v-if="canCancel" variant="outline" @click="cancelling = true">
						Huỷ yêu cầu
					</CommonAppButton>
					<CommonAppButton v-if="canDelete" variant="danger_outline" @click="confirmDelete = true">
						Xoá nháp
					</CommonAppButton>
				</div>
			</div>

			<!--
				Thông tin định biên, không chặn gì: chưa có định biên hay xin quá phần còn trống thì
				khối xanh báo trước định biên sẽ tự tạo hoặc tự tăng; đủ chỗ thì chỉ một dòng còn trống.
			-->
			<div
				v-if="headcountInfo"
				class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-900/20"
			>
				<div class="flex items-start gap-3">
					<svg class="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div class="min-w-0">
						<p class="text-sm font-semibold text-sky-900 dark:text-sky-200">{{ headcountInfo.title }}</p>
						<p class="mt-1 text-sm text-sky-800 dark:text-sky-300">{{ headcountInfo.body }}</p>
						<NuxtLink
							:to="headcountLink"
							class="mt-2 inline-block text-sm font-medium text-sky-900 underline dark:text-sky-200"
						>
							Mở bảng định biên năm {{ item.year }}
						</NuxtLink>
					</div>
				</div>
			</div>

			<div
				v-else-if="item.status === 'DRAFT' || item.status === 'REJECTED'"
				class="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<p class="text-gray-700 dark:text-gray-300">
					<template v-if="item.available == null">
						Chưa đọc được phần còn trống của định biên cho yêu cầu này.
					</template>
					<template v-else>
						Định biên còn trống <strong>{{ Math.max(item.available, 0) }}</strong> người, chưa tính yêu cầu này.
					</template>
				</p>
			</div>

			<div
				v-if="item.rejectReason"
				class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800 dark:bg-rose-900/20"
			>
				<p class="text-sm font-medium text-rose-800 dark:text-rose-200">Lý do bị từ chối</p>
				<p class="mt-1 text-sm text-rose-700 dark:text-rose-300">{{ item.rejectReason }}</p>
			</div>

			<div
				v-if="item.cancelReason"
				class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60"
			>
				<p class="text-sm font-medium text-gray-800 dark:text-gray-200">Lý do huỷ</p>
				<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{{ item.cancelReason }}</p>
			</div>

			<div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
				<!-- Thông tin -->
				<div class="space-y-5 lg:col-span-2">
					<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thông tin yêu cầu</h2>
						<dl class="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Lý do tuyển</dt>
								<dd class="text-sm text-gray-900 dark:text-white">
									{{ item.reasonLabel }}
									<span v-if="item.replacedEmployee" class="text-gray-500 dark:text-gray-400">
										· thay {{ item.replacedEmployee.fullName }} ({{ item.replacedEmployee.employeeCode }})
									</span>
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Loại hình</dt>
								<dd class="text-sm text-gray-900 dark:text-white">{{ item.employmentTypeLabel }}</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Khung lương</dt>
								<dd class="text-sm text-gray-900 dark:text-white">{{ salaryText }}</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Ngày cần có người</dt>
								<dd class="text-sm text-gray-900 dark:text-white">
									{{ item.neededBy ? formatDate(item.neededBy) : '—' }}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Người tạo</dt>
								<dd class="text-sm text-gray-900 dark:text-white">
									{{ item.createdBy.fullName }} · {{ formatDateTime(item.createdAt) }}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Đã tuyển</dt>
								<dd class="text-sm text-gray-900 dark:text-white">
									{{ item.hiredCount }} / {{ item.quantity }}
								</dd>
							</div>
						</dl>

						<div v-if="item.jobDescription" class="mt-4">
							<p class="text-xs text-gray-500 dark:text-gray-400">Mô tả công việc</p>
							<p class="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">
								{{ item.jobDescription }}
							</p>
						</div>
						<div v-if="item.requirements" class="mt-4">
							<p class="text-xs text-gray-500 dark:text-gray-400">Yêu cầu</p>
							<p class="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">
								{{ item.requirements }}
							</p>
						</div>
						<div v-if="item.note" class="mt-4">
							<p class="text-xs text-gray-500 dark:text-gray-400">Ghi chú</p>
							<p class="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{{ item.note }}</p>
						</div>

						<!-- File JD -->
						<div class="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
							<p class="text-xs text-gray-500 dark:text-gray-400">File JD</p>
							<div class="mt-1 flex flex-wrap items-center gap-3">
								<button
									v-if="item.hasJdFile"
									type="button"
									class="text-sm text-brand-600 hover:underline dark:text-brand-400"
									@click="openJd"
								>
									{{ item.jdFileName ?? 'Mở file JD' }}
								</button>
								<span v-else class="text-sm text-gray-400 dark:text-gray-500">Chưa có file</span>
							</div>

							<div v-if="editable || canManage" class="mt-2">
								<UiFileDropzone
									v-model="pickedJd"
									accept=".pdf,.docx"
									:max-size-mb="5"
									:disabled="uploadingJd"
									:hint="
										uploadingJd
											? 'Đang tải lên...'
											: item.hasJdFile
												? 'Chọn file mới để thay file JD đang có · PDF hoặc DOCX · tối đa 5 MB'
												: 'PDF hoặc DOCX · tối đa 5 MB'
									"
								/>
							</div>
						</div>
					</div>

					<!-- Tin tuyển dụng của yêu cầu -->
					<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Tin tuyển dụng</h2>
						<p v-if="!item.jobs.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
							Yêu cầu này chưa có tin nào. Tin chỉ tạo được khi yêu cầu Đã duyệt hoặc Đang tuyển.
						</p>
						<ul v-else class="mt-3 space-y-2">
							<li
								v-for="job in item.jobs"
								:key="job.id"
								class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
							>
								<div class="min-w-0">
									<NuxtLink
										:to="`/management/recruitment/jobs/${job.id}`"
										class="text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
									>
										{{ job.title }}
									</NuxtLink>
									<p class="font-mono text-xs text-gray-400">{{ job.code }}</p>
								</div>
								<RecruitChip :label="job.statusLabel" :tone="JOB_STATUS_CLASS[job.status]" />
							</li>
						</ul>
					</div>
				</div>

				<!-- Luồng duyệt -->
				<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Luồng duyệt</h2>
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						Lần gửi duyệt thứ {{ item.round }}
					</p>
					<div class="mt-3">
						<RecruitApprovalTimeline :steps="item.approvalSteps" :current-round="item.round" />
					</div>
				</div>
			</div>

			<!-- Modal -->
			<RecruitRequisitionFormModal
				v-if="showEdit"
				:requisition="item"
				@saved="
					r => {
						item = r;
						showEdit = false;
						toast.success('Đã lưu yêu cầu tuyển dụng');
					}
				"
				@close="showEdit = false"
			/>

			<RecruitJobFormModal
				v-if="showJobForm"
				:requisition="item"
				@created="onJobCreated"
				@close="showJobForm = false"
			/>

			<RecruitNotePromptModal
				v-if="rejecting"
				title="Từ chối yêu cầu tuyển dụng"
				description="Người tạo nhận được lý do này kèm thông báo, và sửa rồi gửi lại thành một vòng duyệt mới."
				label="Lý do từ chối"
				confirm-label="Từ chối"
				variant="danger"
				:submit="doReject"
				@done="
					rejecting = false;
					toast.success('Đã từ chối yêu cầu');
				"
				@close="rejecting = false"
			/>

			<RecruitNotePromptModal
				v-if="cancelling"
				title="Huỷ yêu cầu tuyển dụng"
				description="Yêu cầu còn tin Đang mở thì phải đóng tin trước khi huỷ."
				label="Lý do huỷ"
				confirm-label="Huỷ yêu cầu"
				variant="danger"
				:submit="doCancel"
				@done="
					cancelling = false;
					toast.success('Đã huỷ yêu cầu');
				"
				@close="cancelling = false"
			/>

			<Teleport to="body">
				<div v-if="confirmDelete" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
					<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Xoá bản nháp</h2>
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
							Xoá <strong class="font-mono">{{ item.code }}</strong> khỏi danh sách. Mã này không được
							cấp lại cho yêu cầu khác. Chỉ bản Nháp xoá được, các trạng thái khác dùng nút Huỷ.
						</p>
						<div class="mt-5 flex justify-end gap-3">
							<CommonAppButton variant="secondary" @click="confirmDelete = false">Huỷ</CommonAppButton>
							<CommonAppButton variant="danger" :loading="acting" @click="removeRequisition">
								Xoá
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Teleport>
		</template>
	</div>
</template>
