<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import RequestStatusBadge from '~/components/modules/general-request/RequestStatusBadge.vue';
	import ApproverChain from '~/components/modules/general-request/ApproverChain.vue';
	import RequestTimeline from '~/components/modules/general-request/RequestTimeline.vue';
	import RequestComments from '~/components/modules/general-request/RequestComments.vue';
	import RequestAttachments from '~/components/modules/general-request/RequestAttachments.vue';
	import RequestWatchers from '~/components/modules/general-request/RequestWatchers.vue';
	import RequestActionModal, {
		type RequestActionKind,
	} from '~/components/modules/general-request/RequestActionModal.vue';
	// `app/services/` không được Nuxt auto-import.
	import { useGeneralRequestService } from '~/services/general-request.service';
	import { useGeneralRequestStore } from '~/stores/generalRequest';
	import { allFieldKeys, dateFieldKeys, numberFieldKeys, printDocumentHtml, PRINT_EXTRA_CSS } from '~/utils/print-template';
	import { dueText, mentionableFrom, requestCodeText } from '~/utils/general-request.utils';
	import { apiErrorCode } from '~/utils/asset.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import { formatNumberValue } from '~/utils/number-input';
	import {
		REQUEST_CATEGORY_CLASS,
		REQUEST_CATEGORY_LABELS,
		type DocumentTemplateDetail,
		type GeneralRequestDetail,
	} from '~/types/general-request.types';

	/**
	 * Chi tiết một phiếu đề xuất (UI-03, lô 4a).
	 *
	 * Nút trên trang hiện theo mười lăm cờ `can*` của phiếu, không tự suy từ vai trò: từ lô 4a
	 * chỉ người ĐANG GIỮ LƯỢT ở bước hiện tại mới duyệt được, còn quản trị viên muốn quyết định
	 * thay thì đi đường riêng là "duyệt thay" và phải ghi lý do.
	 *
	 * Mọi thao tác trả về chi tiết phiếu mới nhất nên trang thay thẳng dữ liệu nhận được. Khi hai
	 * người bấm cùng lúc, người sau nhận 409 và trang tải lại phiếu để không hiện trạng thái cũ.
	 *
	 * Không xem được phiếu thì máy chủ trả 404 giống như phiếu không tồn tại — đúng theo thiết
	 * kế, vì nói "bạn không có quyền" cũng là tiết lộ phiếu đó tồn tại. Trang hiện một câu giải
	 * thích chứ không để trắng.
	 */
	definePageMeta({ title: 'Chi tiết phiếu đề xuất' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const { user } = useAuth();
	const service = useGeneralRequestService();
	const { printRequest, previewRequest } = usePrint();
	const generalRequestStore = useGeneralRequestStore();
	const approvalStore = useApprovalStore();
	const directoryStore = useDirectoryStore();
	const { employees: directoryEmployees } = storeToRefs(directoryStore);

	const requestId = Number(route.params.id);
	const request = ref<GeneralRequestDetail | null>(null);
	const template = ref<DocumentTemplateDetail | null>(null);
	const loading = ref(true);
	/** Phiếu không tồn tại, hoặc người đang xem không được phép xem. */
	const notFound = ref(false);
	/**
	 * Lỗi khác 404, thường là mạng.
	 *
	 * Phải tách khỏi `notFound`: nói "phiếu không tồn tại" khi thật ra chỉ mất mạng là nói sai,
	 * và người dùng cần một nút thử lại ngay trong trang chứ không phải tải lại cả trang.
	 */
	const loadError = ref<string | null>(null);

	// Danh bạ chỉ dùng cho ô chọn người ở các hộp thoại chuyển lượt, đổi người duyệt, thêm người
	// theo dõi. Tải không được thì những hộp thoại đó không có ai để chọn, nhưng trang vẫn đọc được.

	const commentsRef = ref<{ reload: () => void } | null>(null);
	const actionKind = ref<RequestActionKind | null>(null);
	const confirmKind = ref<'cancel' | 'delete' | null>(null);
	const confirmLoading = ref(false);
	const printing = ref(false);

	async function loadRequest() {
		loading.value = true;
		loadError.value = null;
		try {
			const detail = await service.findOne(requestId);
			request.value = detail;
			notFound.value = false;
			if (!template.value || template.value.id !== detail.template.id) {
				try {
					template.value = await service.findTemplate(detail.template.id);
				} catch {
					// Không có mẫu in thì trang vẫn hiện được từng giá trị biểu mẫu.
					template.value = null;
				}
			}
		} catch (e) {
			if (apiErrorCode(e) === 'GENERAL_REQUEST_NOT_FOUND') {
				notFound.value = true;
			} else {
				loadError.value = e instanceof Error ? e.message : 'Chưa tải được phiếu.';
				// Lần đầu vào trang thì khối lỗi trong trang đã nói đủ; chỉ cần toast khi người
				// dùng đang xem phiếu và một lần tải lại giữa phiên bị hỏng.
				if (request.value) toast.error(loadError.value);
			}
		} finally {
			loading.value = false;
		}
	}

	onMounted(() => {
		loadRequest();
		directoryStore.load().catch(() => {});
	});

	// Thông báo đẩy về chính phiếu này thì tải lại.
	watch(
		() => generalRequestStore.refreshSignal,
		() => {
			const id = generalRequestStore.lastRefreshId;
			if (id === null || id === requestId) loadRequest();
		},
	);

	function onUpdated(updated: GeneralRequestDetail) {
		request.value = updated;
		actionKind.value = null;
		approvalStore.fetchCounts();
		commentsRef.value?.reload();
	}

	function onConflict() {
		actionKind.value = null;
		loadRequest();
	}

	// ─── Bản in và nội dung ───────────────────────────────────────────────────────
	/**
	 * Cách định dạng bản in: ngày viết 16/11/2026, số viết 108.000.000, trường tuỳ chọn để trống
	 * thì in ra rỗng chứ không in tên khoá.
	 */
	const printFormat = computed(() => ({
		dateKeys: dateFieldKeys(template.value?.fields),
		numberKeys: numberFieldKeys(template.value?.fields),
		knownKeys: allFieldKeys(template.value?.fields),
	}));

	const renderedHtml = computed(() => {
		const tmpl = template.value?.printTemplate ?? request.value?.printTemplate;
		if (!tmpl || !request.value) return '';
		return printDocumentHtml(tmpl, request.value.fieldValues, printFormat.value);
	});

	const iframeSrcdoc = computed(() => {
		if (!renderedHtml.value) return '';
		return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:16px 24px;font-family:'Times New Roman',serif;font-size:14px;line-height:1.6;color:#111;}*{box-sizing:border-box;}${PRINT_EXTRA_CSS}</style></head><body>${renderedHtml.value}</body></html>`;
	});

	const iframeRef = ref<HTMLIFrameElement | null>(null);
	function onIframeLoad() {
		const el = iframeRef.value;
		if (!el?.contentDocument?.body) return;
		el.style.height = `${el.contentDocument.body.scrollHeight + 32}px`;
	}

	/** Nhãn của từng trường để hiện giá trị khi mẫu không có HTML in. */
	const fieldRows = computed(() => {
		const values = request.value?.fieldValues ?? {};
		const fields = template.value?.fields ?? [];
		if (fields.length) {
			return fields.map(f => ({ key: f.key, label: f.label, value: values[f.key] }));
		}
		return Object.entries(values).map(([key, value]) => ({ key, label: key, value }));
	});

	function displayValue(value: unknown, key?: string): string {
		if (value === null || value === undefined || value === '') return 'Chưa có';
		if (typeof value === 'boolean') return value ? 'Có' : 'Không';
		if (key && printFormat.value.dateKeys.includes(key) && typeof value === 'string') return formatDate(value);
		if (key && printFormat.value.numberKeys.includes(key)) {
			const n = typeof value === 'number' ? value : Number(value);
			if (Number.isFinite(n)) return formatNumberValue(n, 2);
		}
		return String(value);
	}

	// ─── Thao tác ─────────────────────────────────────────────────────────────────
	async function handlePrint() {
		printing.value = true;
		try {
			await printRequest(requestId, printFormat.value);
			await loadRequest();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa in được phiếu.');
		} finally {
			printing.value = false;
		}
	}

	async function confirmAction() {
		if (!confirmKind.value || !request.value) return;
		confirmLoading.value = true;
		try {
			if (confirmKind.value === 'cancel') {
				request.value = await service.cancel(requestId);
				toast.success('Đã thu hồi phiếu.');
				confirmKind.value = null;
				approvalStore.fetchCounts();
			} else {
				await service.remove(requestId);
				toast.success('Đã xoá phiếu nháp.');
				router.push('/general-requests');
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa thực hiện được, bạn tải lại trang rồi thử lại.');
			const code = apiErrorCode(e);
			if (code === 'REQUEST_ALREADY_IN_PROGRESS' || code === 'REQUEST_IMMUTABLE' || code === 'REQUEST_NOT_DRAFT') {
				confirmKind.value = null;
				loadRequest();
			}
		} finally {
			confirmLoading.value = false;
		}
	}

	const mentionable = computed(() => (request.value ? mentionableFrom(request.value) : []));

	const people = computed(() =>
		directoryEmployees.value.map(e => ({
			id: e.id,
			fullName: e.fullName,
			hint: e.department?.name ?? e.employeeCode,
		})),
	);

	const currentDue = computed(() =>
		request.value?.currentStep ? dueText(request.value.currentStep.dueAt, request.value.currentStep.overdue) : null,
	);

	/**
	 * Người gửi mở phiếu đang chờ mà không thu hồi được: nói rõ vì sao và phải làm gì.
	 *
	 * Thu hồi chỉ được khi chưa ai đồng ý ở vòng này, nên sau cú đồng ý đầu tiên nút biến mất.
	 * Ẩn nút mà không giải thích thì người gửi tưởng mình mất quyền, trong khi việc cần làm là
	 * nhờ người duyệt trả lại phiếu để sửa.
	 */
	const cancelBlockedNote = computed(() => {
		const current = request.value;
		if (!current || current.status !== 'PENDING' || current.canCancel) return null;
		if (current.employee.id !== user.value?.id) return null;
		return 'Phiếu đã có người đồng ý ở vòng này nên không thu hồi được nữa. Bạn nhờ người đang giữ lượt trả lại phiếu để bổ sung, rồi nộp lại.';
	});
</script>

<template>
	<!-- Chừa lề đáy trên điện thoại vì nút trợ lý nổi ở góc dưới phải che mất nội dung cuối trang. -->
	<div class="space-y-5 pb-24 sm:pb-0">
		<!-- Đầu trang -->
		<div class="flex flex-wrap items-start gap-3">
			<NuxtLink
				to="/general-requests"
				class="mt-0.5 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-xl font-semibold text-gray-900 dark:text-white">
						{{ request?.title ?? 'Chi tiết phiếu đề xuất' }}
					</h1>
					<RequestStatusBadge v-if="request" :status="request.status" :status-label="request.statusLabel" />
				</div>
				<p v-if="request" class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Số hiệu {{ requestCodeText(request.code) }}, vòng {{ request.round }}, loại phiếu
					{{ request.template.name }}
				</p>
			</div>
		</div>

		<!-- Đang tải -->
		<div v-if="loading" class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
			<div class="h-80 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="space-y-4">
				<div class="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
				<div class="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>
		</div>

		<!-- Không xem được -->
		<div
			v-else-if="notFound"
			class="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<p class="text-base font-medium text-gray-900 dark:text-white">Phiếu này không tồn tại hoặc bạn không có quyền xem</p>
			<p class="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
				Phiếu đề xuất chỉ mở cho người gửi, người duyệt, người theo dõi và phòng nhân sự. Bạn kiểm tra lại đường dẫn,
				hoặc nhờ người gửi thêm bạn vào danh sách theo dõi.
			</p>
			<NuxtLink to="/general-requests" class="mt-5 inline-block">
				<CommonAppButton>Về danh sách phiếu</CommonAppButton>
			</NuxtLink>
		</div>

		<!-- Tải hỏng, thường là mất mạng: nói đúng là lỗi tải và cho thử lại ngay trong trang -->
		<div
			v-else-if="loadError && !request"
			class="rounded-xl border border-rose-200 bg-rose-50 px-6 py-12 text-center dark:border-rose-900/40 dark:bg-rose-900/10"
		>
			<p class="text-base font-medium text-rose-900 dark:text-rose-200">Chưa tải được phiếu này</p>
			<p class="mx-auto mt-2 max-w-md text-sm text-rose-800 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton class="mt-5" @click="loadRequest">Thử lại</CommonAppButton>
		</div>

		<template v-else-if="request">
			<!-- Thanh thao tác -->
			<div
				class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
			>
				<CommonAppButton v-if="request.canApprove" size="sm" @click="actionKind = 'approve'">Đồng ý</CommonAppButton>
				<CommonAppButton v-if="request.canReject" size="sm" variant="danger" @click="actionKind = 'reject'">
					Từ chối
				</CommonAppButton>
				<CommonAppButton v-if="request.canReturn" size="sm" variant="secondary" @click="actionKind = 'return'">
					Trả lại để bổ sung
				</CommonAppButton>
				<CommonAppButton v-if="request.canTransfer" size="sm" variant="secondary" @click="actionKind = 'transfer'">
					Chuyển lượt duyệt
				</CommonAppButton>
				<CommonAppButton v-if="request.canOverride" size="sm" variant="secondary" @click="actionKind = 'override'">
					Quyết định thay
				</CommonAppButton>
				<CommonAppButton v-if="request.canReassign" size="sm" variant="secondary" @click="actionKind = 'reassign'">
					Đổi người duyệt
				</CommonAppButton>
				<NuxtLink v-if="request.canEdit" :to="`/general-requests/create?id=${request.id}`">
					<CommonAppButton size="sm" variant="secondary">
						{{ request.status === 'RETURNED' ? 'Sửa và nộp lại' : 'Sửa phiếu' }}
					</CommonAppButton>
				</NuxtLink>
				<CommonAppButton v-if="request.canCancel" size="sm" variant="secondary" @click="confirmKind = 'cancel'">
					Thu hồi
				</CommonAppButton>
				<CommonAppButton v-if="request.canDelete" size="sm" variant="secondary" @click="confirmKind = 'delete'">
					Xoá nháp
				</CommonAppButton>
				<CommonAppButton
					v-if="request.canPrint"
					size="sm"
					variant="secondary"
					:loading="printing"
					:title="request.printCount > 0 ? `Phiếu này đã in ${request.printCount} lần` : undefined"
					@click="handlePrint"
				>
					In phiếu
					<span v-if="request.printCount > 0" class="text-xs opacity-60">({{ request.printCount }})</span>
				</CommonAppButton>
				<button
					v-if="iframeSrcdoc"
					type="button"
					class="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
					@click="previewRequest(request, template?.printTemplate, printFormat)"
				>
					Xem thử bản in
				</button>
			</div>

			<p
				v-if="cancelBlockedNote"
				class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200"
			>
				{{ cancelBlockedNote }}
			</p>

			<div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_340px]">
				<!-- Cột nội dung -->
				<div class="space-y-5">
					<section
						class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
					>
						<h2
							class="border-b border-gray-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400"
						>
							Nội dung phiếu
						</h2>
						<!--
							Bản phiếu dựng theo khổ A4 nên trên điện thoại nó rộng hơn màn hình và chữ bị cắt.
							Vì vậy điện thoại đọc danh sách giá trị, còn khung bản phiếu chỉ hiện từ khổ máy
							tính tính lên; muốn xem đúng bản in thì bấm "Xem bản in", cửa sổ in tự co giãn.

							srcdoc chạy cùng origin với app. sandbox không có allow-scripts nên mọi script
							trong nội dung đều không chạy; allow-same-origin để onIframeLoad đọc chiều cao.
						-->
						<iframe
							v-if="iframeSrcdoc"
							ref="iframeRef"
							:srcdoc="iframeSrcdoc"
							sandbox="allow-same-origin"
							class="hidden w-full border-0 sm:block"
							style="min-height: 320px"
							@load="onIframeLoad"
						/>
						<dl class="space-y-3 p-5" :class="iframeSrcdoc ? 'sm:hidden' : ''">
							<div v-for="row in fieldRows" :key="row.key" class="grid grid-cols-3 gap-2">
								<dt class="text-sm text-gray-500 dark:text-gray-400">{{ row.label }}</dt>
								<dd class="col-span-2 text-sm text-gray-800 dark:text-gray-200">
									{{ displayValue(row.value, row.key) }}
								</dd>
							</div>
						</dl>
					</section>

					<section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
						<h2 class="text-sm font-semibold text-gray-900 dark:text-white">Nhật ký duyệt</h2>
						<div class="mt-4">
							<RequestTimeline :timeline="request.timeline" :round="request.round" />
						</div>
					</section>

					<RequestComments
						ref="commentsRef"
						:request-id="request.id"
						:can-comment="request.canComment"
						:mentionable="mentionable"
					/>
				</div>

				<!-- Cột bên phải -->
				<div class="space-y-5">
					<section class="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
						<!-- Tên loại phiếu đã nằm ở đầu trang, nên ở đây chỉ cần nhóm của loại phiếu. -->
						<div class="flex items-center gap-2">
							<span
								class="rounded px-1.5 py-0.5 text-xs font-medium"
								:class="REQUEST_CATEGORY_CLASS[request.template.category] ?? REQUEST_CATEGORY_CLASS.OTHER"
							>
								Nhóm {{ REQUEST_CATEGORY_LABELS[request.template.category] ?? request.template.category }}
							</span>
						</div>

						<dl class="space-y-2.5">
							<div class="flex items-baseline justify-between gap-2">
								<dt class="text-xs text-gray-400">Người gửi</dt>
								<dd class="text-right">
									<p class="text-sm font-medium text-gray-900 dark:text-white">{{ request.employee.fullName }}</p>
									<p class="text-xs text-gray-400">{{ request.employee.employeeCode }}</p>
								</dd>
							</div>
							<div v-if="request.submittedAt" class="flex items-baseline justify-between gap-2">
								<dt class="text-xs text-gray-400">Ngày gửi</dt>
								<dd class="text-sm text-gray-600 dark:text-gray-300">{{ formatDateTime(request.submittedAt) }}</dd>
							</div>
							<div v-if="request.returnedAt" class="flex items-baseline justify-between gap-2">
								<dt class="text-xs text-gray-400">Bị trả lại</dt>
								<dd class="text-sm text-amber-700 dark:text-amber-300">{{ formatDateTime(request.returnedAt) }}</dd>
							</div>
							<div v-if="request.completedAt" class="flex items-baseline justify-between gap-2">
								<dt class="text-xs text-gray-400">Hoàn thành</dt>
								<dd class="text-sm text-green-600 dark:text-green-400">{{ formatDateTime(request.completedAt) }}</dd>
							</div>
							<div v-if="request.cancelledAt" class="flex items-baseline justify-between gap-2">
								<dt class="text-xs text-gray-400">Thu hồi lúc</dt>
								<dd class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(request.cancelledAt) }}</dd>
							</div>
						</dl>

						<div
							v-if="request.currentStep"
							class="rounded-lg border px-3 py-2"
							:class="
								request.currentStep.overdue
									? 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-900/10'
									: 'border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
							"
						>
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Đang ở bước</p>
							<p class="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
								{{ request.currentStep.order }}. {{ request.currentStep.name }}
							</p>
							<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
								{{ request.currentStep.approvers.map(a => a.fullName).join(', ') || 'Chưa có người giữ lượt' }}
							</p>
							<p
								v-if="currentDue"
								class="mt-0.5 text-xs"
								:class="request.currentStep.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'"
							>
								{{ currentDue }}
							</p>
						</div>
					</section>

					<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
						<h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Các bước của vòng {{ request.round }}
						</h2>
						<div class="mt-3">
							<ApproverChain
								:steps="request.steps"
								:creator-name="request.employee.fullName"
								:current-step-order="request.currentStep?.order ?? null"
							/>
						</div>
					</section>

					<RequestWatchers
						:request-id="request.id"
						:watchers="request.watchers"
						:can-add-watcher="request.canAddWatcher"
						:can-consult="request.canConsult"
						:people="people"
						@changed="onUpdated"
					/>

					<RequestAttachments
						:request-id="request.id"
						:attachments="request.attachments"
						:can-attach="request.canAttach"
						@changed="loadRequest"
					/>
				</div>
			</div>

			<!-- Hộp thoại quyết định -->
			<Teleport to="body">
				<RequestActionModal
					v-if="actionKind"
					:kind="actionKind"
					:request="request"
					:people="people"
					@updated="onUpdated"
					@conflict="onConflict"
					@close="actionKind = null"
				/>

				<div
					v-if="confirmKind"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					@click.self="confirmKind = null"
				>
					<div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ confirmKind === 'cancel' ? 'Thu hồi phiếu' : 'Xoá phiếu nháp' }}
						</h3>
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
							<template v-if="confirmKind === 'cancel'">
								Phiếu dừng lại và người đang giữ lượt duyệt nhận thông báo. Sau khi thu hồi, bạn gửi lại phiếu mới nếu
								vẫn cần.
							</template>
							<template v-else>
								Phiếu nháp này sẽ bị xoá hẳn và không lấy lại được.
							</template>
						</p>
						<div class="mt-6 flex justify-end gap-2">
							<CommonAppButton variant="secondary" @click="confirmKind = null">
								{{ confirmKind === 'cancel' ? 'Không thu hồi' : 'Giữ nháp' }}
							</CommonAppButton>
							<CommonAppButton variant="danger" :loading="confirmLoading" @click="confirmAction">
								{{ confirmKind === 'cancel' ? 'Thu hồi phiếu' : 'Xoá nháp' }}
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Teleport>
		</template>
	</div>
</template>
