<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitApprovalTimeline from '~/components/modules/recruitment/RecruitApprovalTimeline.vue';
	import RecruitOfferFormModal from '~/components/modules/recruitment/RecruitOfferFormModal.vue';
	import RecruitOfferSendModal from '~/components/modules/recruitment/RecruitOfferSendModal.vue';
	import RecruitOfferResponseModal from '~/components/modules/recruitment/RecruitOfferResponseModal.vue';
	import RecruitOfferHireModal from '~/components/modules/recruitment/RecruitOfferHireModal.vue';
	import RecruitNotePromptModal from '~/components/modules/recruitment/RecruitNotePromptModal.vue';
	import {
		formatRecruitMoney,
		openPresignedUrl,
		recruitErrorMessage,
		OFFER_STATUS_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { RecruitmentOffer } from '~/types/recruitment.types';

	definePageMeta({ title: 'Chi tiết offer' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const offerId = computed(() => Number(route.params.id));
	const item = ref<RecruitmentOffer | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const acting = ref(false);

	const writable = computed(() => canWrite('RECRUIT'));
	const canManage = computed(() => writable.value && hasPermission('recruitment:manage'));

	const showEdit = ref(false);
	const showSend = ref(false);
	const showResponse = ref(false);
	const showHire = ref(false);
	const rejecting = ref(false);
	const cancelling = ref(false);
	const markingNoShow = ref(false);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			item.value = await service.findOffer(offerId.value);
		} catch (e) {
			item.value = null;
			loadError.value = recruitErrorMessage(e, 'Không mở được offer này');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(offerId, load);

	const status = computed(() => item.value?.status ?? null);

	const canEdit = computed(() => canManage.value && status.value === 'DRAFT');
	const canSubmit = computed(() => canManage.value && status.value === 'DRAFT');
	const canSend = computed(() => canManage.value && status.value === 'APPROVED');
	const canRevise = computed(
		() =>
			canManage.value &&
			!!status.value &&
			['APPROVAL_REJECTED', 'APPROVED', 'SENT', 'DECLINED', 'EXPIRED'].includes(status.value),
	);
	const canRecordResponse = computed(() => canManage.value && status.value === 'SENT');
	const canCancel = computed(
		() =>
			canManage.value &&
			!!status.value &&
			['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'APPROVAL_REJECTED', 'SENT'].includes(status.value),
	);
	const canHire = computed(() => canManage.value && status.value === 'ACCEPTED' && !item.value?.employee);
	const canNoShow = computed(() => canManage.value && status.value === 'ACCEPTED');

	async function run(action: () => Promise<RecruitmentOffer>, okMessage: string) {
		if (acting.value) return;
		acting.value = true;
		try {
			item.value = await action();
			toast.success(okMessage);
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Thao tác thất bại'));
			await load();
		} finally {
			acting.value = false;
		}
	}

	const submit = () =>
		run(() => service.submitOffer(offerId.value), 'Đã gửi duyệt, người duyệt nhận được thông báo');
	const approve = () => run(() => service.approveOffer(offerId.value), 'Đã duyệt offer');

	async function doReject(note: string) {
		item.value = await service.rejectOffer(offerId.value, note);
	}

	async function doCancel(reason: string) {
		item.value = await service.cancelOffer(offerId.value, reason);
	}

	async function doNoShow(reason: string) {
		item.value = await service.markOfferNoShow(offerId.value, reason);
	}

	/** Phiên bản mới có id khác, nên phải chuyển trang chứ không chỉ tải lại. */
	async function revise() {
		if (acting.value) return;
		acting.value = true;
		try {
			const next = await service.reviseOffer(offerId.value);
			toast.success(`Đã tạo phiên bản ${next.version}, hãy sửa điều khoản rồi gửi duyệt lại`);
			router.push(`/management/recruitment/offers/${next.id}`);
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Tạo phiên bản mới thất bại'));
		} finally {
			acting.value = false;
		}
	}

	const previewing = ref(false);

	/** Bản PDF sinh tại chỗ từ dữ liệu hiện tại, không lưu lại. */
	async function previewPdf() {
		previewing.value = true;
		try {
			const blob = await service.offerPreviewPdf(offerId.value);
			const url = URL.createObjectURL(blob);
			window.open(url, '_blank');
			// Thu hồi sau một nhịp để tab mới kịp đọc.
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Không xem được bản thử thư mời'));
		} finally {
			previewing.value = false;
		}
	}

	async function openSentPdf() {
		try {
			await openPresignedUrl(() => service.offerPdfUrl(offerId.value));
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Không mở được thư đã gửi'));
		}
	}

	const salaryHidden = computed(() => !!item.value && !item.value.canViewSalary);

	/** Câu mô tả trạng thái link phản hồi, để nhân sự biết ứng viên đang thấy gì. */
	const responseStateText = computed(() => {
		switch (item.value?.responseState) {
			case 'ACTIVE':
				return 'Link phản hồi đang mở, ứng viên trả lời được.';
			case 'RESPONDED':
				return 'Ứng viên đã trả lời, link không nhận thêm thao tác nào.';
			case 'EXPIRED':
				return 'Link đã quá hạn phản hồi.';
			case 'SUPERSEDED':
				return 'Đã có phiên bản mới nên link này báo ứng viên xem email mới nhất.';
			case 'CANCELLED':
				return 'Offer bị huỷ nên link báo đã huỷ.';
			default:
				return 'Offer chưa gửi nên chưa có link phản hồi.';
		}
	});
</script>

<template>
	<div class="space-y-5">
		<NuxtLink
			to="/management/recruitment/offers"
			class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Danh sách offer
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
				to="/management/recruitment/offers"
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
						<h1 class="text-xl font-bold text-gray-900 dark:text-white">
							{{ item.candidate.fullName }}
						</h1>
						<RecruitChip :label="item.statusLabel" :tone="OFFER_STATUS_CLASS[item.status]" />
						<RecruitChip
							v-if="item.overBand"
							label="Vượt khung lương"
							tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
						/>
					</div>
					<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
						<span class="font-mono">{{ item.code }}</span>
						· phiên bản {{ item.version }} · {{ item.position.name }} · {{ item.department.name }}
					</p>
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						Tin
						<NuxtLink
							:to="`/management/recruitment/jobs/${item.job.id}`"
							class="text-brand-600 hover:underline dark:text-brand-400"
						>
							{{ item.job.title }}
						</NuxtLink>
						· yêu cầu <span class="font-mono">{{ item.requisition.code }}</span> · người tạo
						{{ item.createdBy.fullName }}
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<CommonAppButton variant="outline" size="sm" :loading="previewing" @click="previewPdf">
						Xem thử thư mời
					</CommonAppButton>
					<CommonAppButton v-if="item.hasSentPdf" variant="outline" size="sm" @click="openSentPdf">
						Tải thư đã gửi
					</CommonAppButton>
					<CommonAppButton v-if="canEdit" variant="outline" size="sm" @click="showEdit = true">
						Sửa
					</CommonAppButton>
					<CommonAppButton v-if="canSubmit" variant="primary" size="sm" :loading="acting" @click="submit">
						Gửi duyệt
					</CommonAppButton>
					<CommonAppButton
						v-if="item.canApprove && writable"
						variant="danger_outline"
						size="sm"
						@click="rejecting = true"
					>
						Từ chối duyệt
					</CommonAppButton>
					<CommonAppButton
						v-if="item.canApprove && writable"
						variant="primary"
						size="sm"
						:loading="acting"
						@click="approve"
					>
						Duyệt
					</CommonAppButton>
					<CommonAppButton v-if="canSend" variant="primary" size="sm" @click="showSend = true">
						Gửi cho ứng viên
					</CommonAppButton>
					<CommonAppButton v-if="canRecordResponse" variant="outline" size="sm" @click="showResponse = true">
						Ghi nhận phản hồi
					</CommonAppButton>
					<CommonAppButton v-if="canHire" variant="primary" size="sm" @click="showHire = true">
						Tạo hồ sơ nhân viên
					</CommonAppButton>
					<CommonAppButton v-if="canNoShow" variant="outline" size="sm" @click="markingNoShow = true">
						Không nhận việc
					</CommonAppButton>
					<CommonAppButton v-if="canRevise" variant="outline" size="sm" :loading="acting" @click="revise">
						Tạo phiên bản mới
					</CommonAppButton>
					<CommonAppButton v-if="canCancel" variant="danger_outline" size="sm" @click="cancelling = true">
						Huỷ offer
					</CommonAppButton>
				</div>
			</div>

			<div
				v-if="item.employee"
				class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20"
			>
				<p class="text-sm text-emerald-800 dark:text-emerald-200">
					Ứng viên đã thành nhân viên {{ item.employee.fullName }} ({{ item.employee.employeeCode }}).
				</p>
				<NuxtLink
					:to="`/management/employees/${item.employee.id}`"
					class="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"
				>
					Mở hồ sơ nhân viên
				</NuxtLink>
			</div>

			<div
				v-if="item.cancelReason"
				class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60"
			>
				<p class="text-sm font-medium text-gray-800 dark:text-gray-200">
					{{ item.status === 'NO_SHOW' ? 'Lý do không nhận việc' : 'Lý do huỷ' }}
				</p>
				<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{{ item.cancelReason }}</p>
			</div>

			<div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
				<div class="space-y-5 lg:col-span-2">
					<!-- Điều khoản -->
					<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Điều khoản</h2>

						<p
							v-if="salaryHidden"
							class="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300"
						>
							Bạn không có quyền xem các số tiền của offer này, nên phần lương hiện dấu gạch.
						</p>

						<dl class="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Lương chính thức</dt>
								<dd class="text-sm font-semibold text-gray-900 dark:text-white">
									{{ formatRecruitMoney(item.baseSalary) }}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Loại hình</dt>
								<dd class="text-sm text-gray-900 dark:text-white">
									{{ item.employmentTypeLabel }}
									<span v-if="item.level" class="text-gray-500 dark:text-gray-400"> · {{ item.level }}</span>
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Thử việc</dt>
								<dd class="text-sm text-gray-900 dark:text-white">{{ item.probationGroupLabel }}</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Số ngày thử việc</dt>
								<dd class="text-sm text-gray-900 dark:text-white">
									{{ item.probationDays != null ? `${item.probationDays} ngày` : '—' }}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Lương thử việc</dt>
								<dd class="text-sm text-gray-900 dark:text-white">
									{{ formatRecruitMoney(item.probationSalary) }}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Kết thúc thử việc</dt>
								<dd class="text-sm text-gray-900 dark:text-white">
									{{ item.probationEndDate ? formatDate(item.probationEndDate) : '—' }}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Ngày bắt đầu làm việc</dt>
								<dd class="text-sm text-gray-900 dark:text-white">{{ formatDate(item.startDate) }}</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Hạn phản hồi</dt>
								<dd class="text-sm text-gray-900 dark:text-white">
									{{ formatDate(item.responseDeadline) }}
								</dd>
							</div>
							<div v-if="item.allowances" class="sm:col-span-2">
								<dt class="text-xs text-gray-500 dark:text-gray-400">Phụ cấp</dt>
								<dd class="whitespace-pre-line text-sm text-gray-900 dark:text-white">
									{{ item.allowances }}
								</dd>
							</div>
						</dl>
					</div>

					<!-- Phản hồi của ứng viên -->
					<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Phản hồi của ứng viên</h2>
						<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">{{ responseStateText }}</p>

						<dl v-if="item.respondedAt" class="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Thời điểm</dt>
								<dd class="text-sm text-gray-900 dark:text-white">{{ formatDateTime(item.respondedAt) }}</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Qua kênh</dt>
								<dd class="text-sm text-gray-900 dark:text-white">{{ item.respondedViaLabel ?? '—' }}</dd>
							</div>
							<div v-if="item.declineReason">
								<dt class="text-xs text-gray-500 dark:text-gray-400">Lý do từ chối</dt>
								<dd class="text-sm text-gray-900 dark:text-white">{{ item.declineReason.name }}</dd>
							</div>
							<div v-if="item.responseNote" class="sm:col-span-2">
								<dt class="text-xs text-gray-500 dark:text-gray-400">Ghi chú</dt>
								<dd class="text-sm text-gray-900 dark:text-white">{{ item.responseNote }}</dd>
							</div>
						</dl>

						<p v-if="item.sentAt" class="mt-3 text-xs text-gray-400">
							Gửi lúc {{ formatDateTime(item.sentAt) }}
						</p>
					</div>

					<!-- Phiên bản -->
					<div
						v-if="item.versions.length > 1"
						class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
					>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Các phiên bản</h2>
						<ul class="mt-3 space-y-2">
							<li
								v-for="v in item.versions"
								:key="v.id"
								class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
							>
								<div class="flex items-center gap-2">
									<NuxtLink
										:to="`/management/recruitment/offers/${v.id}`"
										class="text-sm font-medium"
										:class="
											v.id === item.id
												? 'text-gray-900 dark:text-white'
												: 'text-brand-600 hover:underline dark:text-brand-400'
										"
									>
										Phiên bản {{ v.version }}
									</NuxtLink>
									<span v-if="v.id === item.id" class="text-xs text-gray-400">đang xem</span>
								</div>
								<div class="flex items-center gap-2">
									<span v-if="v.sentAt" class="text-xs text-gray-400">
										gửi {{ formatDate(v.sentAt) }}
									</span>
									<RecruitChip :label="v.statusLabel" :tone="OFFER_STATUS_CLASS[v.status]" />
								</div>
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
					<p v-if="item.overBand" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
						Offer vượt khung lương của yêu cầu nên có thêm một bước duyệt của Giám đốc.
					</p>
					<div class="mt-3">
						<RecruitApprovalTimeline :steps="item.approvalSteps" :current-round="item.round" />
					</div>
				</div>
			</div>

			<!-- Modal -->
			<RecruitOfferFormModal
				v-if="showEdit"
				:offer="item"
				:candidate-name="item.candidate.fullName"
				@saved="
					o => {
						item = o;
						showEdit = false;
						toast.success('Đã lưu offer');
					}
				"
				@close="showEdit = false"
			/>

			<RecruitOfferSendModal
				v-if="showSend"
				:offer="item"
				@sent="
					o => {
						item = o;
						showSend = false;
						toast.success('Đã gửi offer cho ứng viên');
					}
				"
				@close="showSend = false"
			/>

			<RecruitOfferResponseModal
				v-if="showResponse"
				:offer="item"
				@recorded="
					o => {
						item = o;
						showResponse = false;
						toast.success('Đã ghi nhận phản hồi');
					}
				"
				@close="showResponse = false"
			/>

			<RecruitOfferHireModal
				v-if="showHire"
				:offer="item"
				@hired="
					o => {
						item = o;
						showHire = false;
						toast.success('Đã tạo hồ sơ nhân viên');
					}
				"
				@close="showHire = false"
			/>

			<RecruitNotePromptModal
				v-if="rejecting"
				title="Từ chối duyệt offer"
				description="Người tạo offer nhận được lý do này. Offer bị từ chối không gửi duyệt lại trực tiếp được, phải tạo phiên bản mới."
				label="Lý do từ chối"
				confirm-label="Từ chối"
				variant="danger"
				:submit="doReject"
				@done="
					rejecting = false;
					toast.success('Đã từ chối duyệt');
				"
				@close="rejecting = false"
			/>

			<RecruitNotePromptModal
				v-if="cancelling"
				title="Huỷ offer"
				description="Link phản hồi của ứng viên sẽ báo đã huỷ. Hệ thống KHÔNG gửi email báo ứng viên và KHÔNG đóng hồ sơ ứng tuyển, nên hãy tự báo ứng viên và xử lý hồ sơ."
				label="Lý do huỷ"
				confirm-label="Huỷ offer"
				variant="danger"
				:submit="doCancel"
				@done="
					cancelling = false;
					toast.success('Đã huỷ offer');
				"
				@close="cancelling = false"
			/>

			<RecruitNotePromptModal
				v-if="markingNoShow"
				title="Ứng viên không nhận việc"
				description="Dùng khi ứng viên đã đồng ý nhưng không đến nhận việc. Chỉ tiêu của yêu cầu tuyển sẽ được mở lại. Hồ sơ nhân viên đã tạo thì không bị động tới."
				label="Lý do"
				confirm-label="Ghi nhận"
				variant="danger"
				:submit="doNoShow"
				@done="
					markingNoShow = false;
					toast.success('Đã ghi nhận không nhận việc');
				"
				@close="markingNoShow = false"
			/>
		</template>
	</div>
</template>
