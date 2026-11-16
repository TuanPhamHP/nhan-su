<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import DisposalFormModal from '~/components/modules/asset/DisposalFormModal.vue';
	import DocumentUploadModal from '~/components/modules/asset/DocumentUploadModal.vue';
	import {
		ASSET_STATUS_CLASS,
		DISPOSAL_STATUS_CLASS,
		apiErrorCode,
		disposalItemErrors,
		disposalNumber,
		disposalChangesText,
		disposalResubmitText,
		disposalStopDateText,
		disposalCountText,
		hiddenItemsText,
		formatAssetMoney,
		formatFileSize,
	} from '~/utils/asset.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { AssetDisposal, AssetDisposalDocument, AssetDisposalItem } from '~/types/asset.types';

	definePageMeta({ title: 'Phiếu thanh lý' });

	const route = useRoute();
	const toast = useToast();
	const service = useAssetService();
	const approvalStore = useApprovalStore();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const disposalId = computed(() => Number(route.params.id));
	const disposal = ref<AssetDisposal | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);

	/**
	 * Tải giấy tờ là thao tác ghi: cần module dùng đầy đủ và quyền quản lý tài sản, như BE. Phiếu đã
	 * huỷ thì không còn biên bản nào để lưu nên ẩn nút.
	 */
	const canUpload = computed(
		() => canWrite('ASSET') && hasPermission('asset:manage') && disposal.value?.status !== 'CANCELLED',
	);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			disposal.value = await service.findDisposal(disposalId.value);
		} catch (e) {
			disposal.value = null;
			loadError.value = e instanceof Error ? e.message : 'Chưa mở được phiếu thanh lý này. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	// Bấm thông báo của phiếu khác khi đang đứng ở trang này: chỉ tham số đổi, trang không tạo lại.
	watch(disposalId, load);

	/** Lý do BE không cho duyệt từng thiết bị (409 `ASSET_DISPOSAL_NOT_ALLOWED` lúc duyệt). */
	const itemErrors = ref<Record<number, string>>({});

	// ─── Giá trị còn lại ─────────────────────────────────────────────────────────
	//
	// Phiếu đã duyệt hiện con số đã chốt (`bookValueAtDisposal`). Phiếu chưa duyệt hiện con số tạm
	// tính tới ngày thanh lý (`estimatedBookValue`), đúng số sẽ chốt nếu duyệt, để người duyệt so
	// với giá thu về.

	const isApproved = computed(() => disposal.value?.status === 'APPROVED');

	function itemBookValue(item: AssetDisposalItem): number | null {
		return isApproved.value ? item.bookValueAtDisposal : item.estimatedBookValue;
	}

	const bookValueHeader = computed(() => (isApproved.value ? 'Còn lại khi thanh lý (đã chốt)' : 'Còn lại tạm tính'));

	const bookValueNote = computed(() => {
		const d = disposal.value;
		if (!d || !d.canViewValue || d.status === 'APPROVED') return '';
		return d.status === 'PENDING'
			? 'Giá trị còn lại tạm tính đến ngày thanh lý, chốt khi duyệt.'
			: 'Giá trị còn lại tạm tính đến ngày thanh lý.';
	});

	/** Thiết bị đã Mất thì vị trí cũ trên sổ không còn ý nghĩa. */
	function itemLocation(item: AssetDisposalItem): string {
		if (item.status === 'LOST') return 'Đã mất';
		return item.location ?? '—';
	}

	// ─── Hộp quyết định: duyệt, từ chối, huỷ ─────────────────────────────────────

	type Decision = 'approve' | 'reject' | 'cancel';
	const decision = ref<Decision | null>(null);

	const decisionSchema = toTypedSchema(
		z.object({ note: z.string().max(2000, 'Ghi chú tối đa 2000 ký tự').optional() }).superRefine((v, ctx) => {
			if (decision.value === 'reject' && !v.note?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['note'],
					message: 'Bạn ghi lý do từ chối để người lập phiếu biết cần sửa gì trước khi gửi lại.',
				});
			}
		}),
	);

	const {
		handleSubmit: handleDecision,
		defineField: defineDecisionField,
		errors: decisionErrors,
		isSubmitting: deciding,
		resetForm: resetDecision,
	} = useForm({ validationSchema: decisionSchema, initialValues: { note: '' } });
	const [decisionNote, decisionNoteAttrs] = defineDecisionField('note');

	function openDecision(kind: Decision) {
		resetDecision({ values: { note: '' } });
		decision.value = kind;
	}

	const decisionTitle = computed(() => {
		switch (decision.value) {
			case 'approve':
				return 'Duyệt phiếu thanh lý';
			case 'reject':
				return 'Từ chối phiếu thanh lý';
			case 'cancel':
				return 'Huỷ phiếu thanh lý';
			default:
				return '';
		}
	});

	/** "Máy in laser Canon LBP 2900 (cũ)" khi phiếu có một máy, "3 thiết bị" khi nhiều máy. */
	function itemsSubject(d: AssetDisposal): string {
		return d.items.length === 1 ? d.items[0]!.name : `${d.items.length} thiết bị`;
	}

	/** Nói trước điều sẽ xảy ra với thiết bị, để người bấm không phải đoán. */
	const decisionHint = computed(() => {
		const d = disposal.value;
		if (!d) return '';
		switch (decision.value) {
			case 'approve': {
				// Ngày dừng khấu hao lấy từ từng thiết bị (vòng 3): thiết bị Mất giữ ngày ghi nhận mất.
				const total =
					d.canViewValue && d.totalBookValue != null
						? ` Giá trị còn lại được chốt là ${formatAssetMoney(d.totalBookValue)}.`
						: '';
				return `${itemsSubject(d)} chuyển sang Đã thanh lý và ${disposalStopDateText(d)}.${total} ${d.createdBy.name} sẽ nhận được thông báo.`;
			}
			case 'reject':
				return `Các thiết bị giữ nguyên trạng thái. ${d.createdBy.name} nhận được thông báo kèm lý do, sửa phiếu rồi gửi lại.`;
			case 'cancel':
				return 'Phiếu chuyển sang Đã huỷ. Các thiết bị trong phiếu lại cấp phát, sửa chữa và bảo dưỡng được như bình thường. Thao tác này không hoàn tác được.';
			default:
				return '';
		}
	});

	const submitDecision = handleDecision(async values => {
		const d = disposal.value;
		if (!d || !decision.value) return;
		const note = values.note?.trim() || undefined;
		try {
			let saved: AssetDisposal;
			if (decision.value === 'approve') {
				saved = await service.approveDisposal(d.id, { round: d.round, note });
				toast.success(
					`Đã duyệt phiếu thanh lý ${disposalNumber(d.id)}. ${itemsSubject(saved)} đã chuyển sang Đã thanh lý, ${d.createdBy.name} sẽ nhận được thông báo.`,
				);
			} else if (decision.value === 'reject') {
				saved = await service.rejectDisposal(d.id, { round: d.round, note });
				toast.success(
					`Đã từ chối phiếu thanh lý ${disposalNumber(d.id)}. ${d.createdBy.name} sẽ nhận được thông báo kèm lý do để sửa rồi gửi lại.`,
				);
			} else {
				saved = await service.cancelDisposal(d.id, note);
				toast.success(`Đã huỷ phiếu thanh lý ${disposalNumber(d.id)}. Các thiết bị trong phiếu không còn chờ thanh lý.`);
			}
			disposal.value = saved;
			itemErrors.value = {};
			decision.value = null;
			approvalStore.fetchCounts();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa thực hiện được thao tác này. Bạn thử lại sau ít phút.');
			const code = apiErrorCode(e);
			// Người khác vừa quyết định hoặc phiếu đã được gửi lại: dữ liệu đang xem đã cũ.
			if (code === 'ASSET_DISPOSAL_CHANGED' || code === 'ASSET_DISPOSAL_NOT_FOUND') {
				decision.value = null;
				await load();
			} else if (code === 'ASSET_DISPOSAL_NOT_ALLOWED') {
				const map: Record<number, string> = {};
				for (const err of disposalItemErrors(e)) map[err.assetId] = err.reason;
				itemErrors.value = map;
				decision.value = null;
			}
		}
	});

	useEscapeKey(
		() => (decision.value = null),
		() => !!decision.value && !deciding.value,
	);

	// ─── Sửa và gửi lại ──────────────────────────────────────────────────────────

	const showEdit = ref(false);
	function onEdited(saved: AssetDisposal) {
		showEdit.value = false;
		disposal.value = saved;
		itemErrors.value = {};
	}

	// ─── Giấy tờ ─────────────────────────────────────────────────────────────────

	const showUpload = ref(false);
	const opening = ref<number | null>(null);

	/** Presigned URL sống ngắn: xin lúc bấm rồi mở ngay, không lưu lại. */
	async function openDoc(doc: AssetDisposalDocument) {
		if (opening.value) return;
		opening.value = doc.id;
		try {
			const url = await service.documentUrl(doc.id);
			window.open(url, '_blank', 'noopener');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được file. Bạn thử lại sau ít phút.');
		} finally {
			opening.value = null;
		}
	}

	async function onUploaded() {
		showUpload.value = false;
		await load();
	}

	/** Loại, số và ngày giấy tờ, kèm số tiền khi có (vòng 3): người in biên bản cần đối chiếu số hiệu. */
	function docDetails(doc: AssetDisposalDocument): string {
		const parts = [doc.typeLabel];
		if (doc.number) parts.push(`số ${doc.number}`);
		if (doc.issuedDate) parts.push(`ngày ${formatDate(doc.issuedDate)}`);
		if (doc.amount != null) parts.push(formatAssetMoney(doc.amount));
		return parts.join(' · ');
	}

	// ─── Hiển thị ────────────────────────────────────────────────────────────────

	/** Câu hướng dẫn theo trạng thái phiếu và việc người xem làm được. */
	const guide = computed(() => {
		const d = disposal.value;
		if (!d) return null;
		if (d.status === 'PENDING' && d.actions.canDecide) {
			// Phiếu gửi lại: nói rõ ai đã từ chối và chỉ chỗ xem đã sửa gì, không nhắc chữ "vòng".
			const rejectedBy = d.round > 1 ? [...d.history].reverse().find(h => h.action === 'REJECTED')?.actorName : undefined;
			if (rejectedBy) {
				return {
					tone: 'amber',
					text: `Phiếu này đã được sửa sau khi ${rejectedBy} từ chối. Bạn xem phần Lịch sử để biết đã sửa gì, rồi bấm Duyệt hoặc Từ chối.`,
				};
			}
			return { tone: 'amber', text: 'Phiếu đang chờ bạn duyệt. Bạn xem danh sách thiết bị bên dưới rồi bấm Duyệt hoặc Từ chối.' };
		}
		if (d.status === 'PENDING') {
			return {
				tone: 'amber',
				text: 'Phiếu đang chờ người có quyền duyệt thanh lý. Người lập phiếu sẽ nhận được thông báo khi có kết quả.',
			};
		}
		if (d.status === 'REJECTED' && d.actions.canEdit) {
			return {
				tone: 'rose',
				text: 'Phiếu bị từ chối. Bạn bấm Sửa và gửi lại để sửa theo lý do bên dưới, hoặc Huỷ phiếu nếu không thanh lý nữa.',
			};
		}
		if (d.status === 'REJECTED') {
			return { tone: 'rose', text: 'Phiếu bị từ chối và đang chờ người lập phiếu sửa rồi gửi lại.' };
		}
		if (d.status === 'APPROVED') {
			const hasRecord = d.documents.some(doc => doc.type === 'DISPOSAL_RECORD');
			return {
				tone: 'emerald',
				text:
					canUpload.value && !hasRecord
						? 'Phiếu đã được duyệt và các thiết bị đã chuyển sang Đã thanh lý. Ký biên bản thanh lý xong, bạn chụp hoặc quét rồi tải lên ở mục Giấy tờ để lưu hồ sơ.'
						: 'Phiếu đã được duyệt và các thiết bị đã chuyển sang Đã thanh lý.',
			};
		}
		return { tone: 'gray', text: 'Phiếu đã huỷ, các thiết bị trong phiếu không còn chờ thanh lý.' };
	});

	const GUIDE_CLASS: Record<string, string> = {
		amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
		rose: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300',
		emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
		gray: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
	};

	/** "Bên mua" khi Bán, "Bên nhận" khi Tặng. */
	const counterpartyLabel = computed(() => {
		const m = disposal.value?.method;
		if (m === 'SALE') return 'Bên mua';
		if (m === 'DONATION') return 'Bên nhận';
		return 'Bên mua, bên nhận';
	});

	/**
	 * Người quyết định và ghi chú. `decidedBy`, `decisionNote` là của lần duyệt khi phiếu đã duyệt,
	 * còn lại là của lần từ chối gần nhất: phiếu bị từ chối rồi bị huỷ vẫn giữ người từ chối. Người
	 * huỷ lấy từ dòng `CANCELLED` của lịch sử.
	 */
	const decisionRows = computed(() => {
		const d = disposal.value;
		if (!d) return [];
		const rows: { label: string; value: string; sub?: string; multiline?: boolean }[] = [];
		if (d.decidedBy) {
			const who =
				d.status === 'APPROVED' ? 'Người duyệt' : d.status === 'REJECTED' ? 'Người từ chối' : 'Người từ chối gần nhất';
			rows.push({ label: who, value: d.decidedBy.name, sub: d.decidedAt ? formatDateTime(d.decidedAt) : undefined });
		}
		if (d.decisionNote) {
			rows.push({
				label: d.status === 'APPROVED' ? 'Ghi chú khi duyệt' : 'Lý do từ chối',
				value: d.decisionNote,
				multiline: true,
			});
		}
		if (d.status === 'CANCELLED') {
			const cancel = [...d.history].reverse().find(h => h.action === 'CANCELLED');
			if (cancel) {
				rows.push({ label: 'Người huỷ', value: cancel.actorName, sub: formatDateTime(cancel.at) });
				if (cancel.note) rows.push({ label: 'Lý do huỷ', value: cancel.note, multiline: true });
			}
		}
		return rows;
	});

	const hasAnyAction = computed(() => {
		const a = disposal.value?.actions;
		return !!a && (a.canDecide || a.canEdit || a.canCancel);
	});

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const dtCls = 'w-36 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400';
	const ddCls = 'min-w-0 flex-1 break-words text-sm text-gray-900 dark:text-gray-100';
</script>

<template>
	<!-- Khoảng trống cuối trang để nút tròn trợ lý AI không che nút ở dòng cuối. -->
	<div class="space-y-5 pb-44 sm:pb-36">
		<NuxtLink
			to="/management/assets/disposals"
			class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Danh sách phiếu thanh lý
		</NuxtLink>

		<CommonAppModuleNotice module="ASSET" />

		<div v-if="loading" class="space-y-4">
			<div class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<div class="mt-3 flex flex-wrap items-center justify-center gap-3">
				<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
				<NuxtLink to="/management/assets/disposals" class="text-sm text-brand-600 hover:underline dark:text-brand-400">
					Quay lại danh sách
				</NuxtLink>
			</div>
		</div>

		<template v-else-if="disposal">
			<!-- Đầu trang -->
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-bold text-gray-900 dark:text-white">Phiếu thanh lý {{ disposalNumber(disposal.id) }}</h1>
						<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="DISPOSAL_STATUS_CLASS[disposal.status]">
							{{ disposal.statusLabel }}
						</span>
						<span v-if="disposalResubmitText(disposal.round)" class="text-xs text-gray-500 dark:text-gray-400">
							{{ disposalResubmitText(disposal.round) }}
						</span>
					</div>
					<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
						{{ disposal.methodLabel }} · {{ disposalCountText(disposal) }} · ngày thanh lý {{ formatDate(disposal.disposalDate) }}
					</p>
				</div>

				<!-- Nút đi đúng theo `actions` của BE, không tự tính lại. -->
				<div v-if="hasAnyAction" class="flex w-full flex-wrap gap-2 sm:w-auto">
					<template v-if="disposal.actions.canDecide">
						<CommonAppButton variant="primary" class="min-h-11 flex-1 sm:min-h-0 sm:flex-none" @click="openDecision('approve')">Duyệt</CommonAppButton>
						<CommonAppButton variant="danger" class="min-h-11 flex-1 sm:min-h-0 sm:flex-none" @click="openDecision('reject')">Từ chối</CommonAppButton>
					</template>
					<CommonAppButton
						v-if="disposal.actions.canEdit"
						variant="primary"
						class="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
						@click="showEdit = true"
					>
						Sửa và gửi lại
					</CommonAppButton>
					<CommonAppButton
						v-if="disposal.actions.canCancel"
						variant="danger_outline"
						class="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
						@click="openDecision('cancel')"
					>
						Huỷ phiếu
					</CommonAppButton>
				</div>
			</div>

			<p v-if="guide" class="rounded-xl border px-4 py-3 text-sm" :class="GUIDE_CLASS[guide.tone]">{{ guide.text }}</p>

			<!-- Thông tin phiếu -->
			<section class="grid grid-cols-1 gap-5 lg:grid-cols-2">
				<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
					<h2 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Thông tin phiếu</h2>
					<dl class="divide-y divide-gray-100 dark:divide-gray-800">
						<div class="flex gap-4 py-2">
							<dt :class="dtCls">Hình thức</dt>
							<dd :class="ddCls">{{ disposal.methodLabel }}</dd>
						</div>
						<div class="flex gap-4 py-2">
							<dt :class="dtCls">Ngày thanh lý</dt>
							<dd :class="ddCls">{{ formatDate(disposal.disposalDate) }}</dd>
						</div>
						<div v-if="disposal.counterparty" class="flex gap-4 py-2">
							<dt :class="dtCls">{{ counterpartyLabel }}</dt>
							<dd :class="ddCls">{{ disposal.counterparty }}</dd>
						</div>
						<div v-if="disposal.canViewValue" class="flex gap-4 py-2">
							<dt :class="dtCls">Giá thu về</dt>
							<dd :class="`${ddCls} tabular-nums`">{{ disposal.proceeds != null ? formatAssetMoney(disposal.proceeds) : 'Không thu tiền' }}</dd>
						</div>
						<div v-if="disposal.canViewValue && disposal.totalBookValue != null" class="flex gap-4 py-2">
							<dt :class="dtCls">Tổng giá trị còn lại</dt>
							<dd :class="`${ddCls} tabular-nums`">
								{{ formatAssetMoney(disposal.totalBookValue) }}
								<span class="block text-xs text-gray-500">
									{{ isApproved ? 'Đã chốt khi duyệt' : disposal.status === 'PENDING' ? 'Tạm tính đến ngày thanh lý, chốt khi duyệt' : 'Tạm tính đến ngày thanh lý' }}
								</span>
								<!-- Trưởng phòng: BE chỉ cộng các thiết bị có trong `items`. -->
								<span v-if="disposal.hiddenItemCount > 0" class="block text-xs text-gray-500">
									Chỉ tính các thiết bị của phòng bạn.
								</span>
							</dd>
						</div>
						<div class="flex gap-4 py-2">
							<dt :class="dtCls">Người lập phiếu</dt>
							<dd :class="ddCls">
								{{ disposal.createdBy.name }}
								<span class="block text-xs text-gray-500">
									Gửi lần gần nhất {{ formatDateTime(disposal.submittedAt) }}<template v-if="disposalResubmitText(disposal.round)">, {{ disposalResubmitText(disposal.round).toLowerCase() }}</template>
								</span>
							</dd>
						</div>
						<div v-for="row in decisionRows" :key="row.label" class="flex gap-4 py-2">
							<dt :class="dtCls">{{ row.label }}</dt>
							<dd :class="[ddCls, row.multiline ? 'whitespace-pre-line' : '']">
								{{ row.value }}
								<span v-if="row.sub" class="block text-xs text-gray-500">{{ row.sub }}</span>
							</dd>
						</div>
					</dl>
				</div>

				<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
					<h2 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Lý do thanh lý</h2>
					<p class="whitespace-pre-line break-words text-sm text-gray-800 dark:text-gray-200">{{ disposal.reason }}</p>
				</div>
			</section>

			<!-- Thiết bị trong phiếu -->
			<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
				<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
					<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Thiết bị trong phiếu</h2>
				</div>

				<ul class="divide-y divide-gray-100 sm:hidden dark:divide-gray-800">
					<li v-for="item in disposal.items" :key="item.assetId" class="space-y-1 p-4" :class="itemErrors[item.assetId] ? 'bg-rose-50 dark:bg-rose-900/20' : ''">
						<div class="flex items-start justify-between gap-2">
							<NuxtLink :to="`/management/assets/${item.assetId}`" class="min-w-0 font-medium text-gray-900 hover:text-brand-600 dark:text-white">
								{{ item.name }}
							</NuxtLink>
							<span class="inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="ASSET_STATUS_CLASS[item.status]">
								{{ item.statusLabel }}
							</span>
						</div>
						<p class="text-xs text-gray-600 dark:text-gray-400">
							<span class="font-mono">{{ item.code }}</span> · {{ item.categoryName }}
							<template v-if="item.serialNumber"> · Số serial {{ item.serialNumber }}</template>
						</p>
						<p class="text-xs text-gray-600 dark:text-gray-400">Vị trí: {{ itemLocation(item) }}</p>
						<p v-if="disposal.canViewValue" class="text-xs tabular-nums text-gray-700 dark:text-gray-300">
							Nguyên giá {{ formatAssetMoney(item.costVnd) }}
							<template v-if="itemBookValue(item) != null">
								, {{ isApproved ? 'còn lại khi thanh lý' : 'còn lại tạm tính' }} {{ formatAssetMoney(itemBookValue(item)) }}
							</template>
						</p>
						<p v-if="itemErrors[item.assetId]" class="text-sm text-rose-700 dark:text-rose-300">{{ itemErrors[item.assetId] }}</p>
					</li>
				</ul>

				<div class="hidden overflow-x-auto sm:block">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
							<tr>
								<th class="px-4 py-2 text-left font-medium">Thiết bị</th>
								<th class="px-4 py-2 text-left font-medium">Loại</th>
								<th class="px-4 py-2 text-left font-medium">Vị trí</th>
								<th class="px-4 py-2 text-left font-medium">Trạng thái</th>
								<th v-if="disposal.canViewValue" class="px-4 py-2 text-right font-medium">Nguyên giá</th>
								<th v-if="disposal.canViewValue" class="px-4 py-2 text-right font-medium">{{ bookValueHeader }}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="item in disposal.items" :key="item.assetId" :class="itemErrors[item.assetId] ? 'bg-rose-50 dark:bg-rose-900/20' : ''">
								<td class="px-4 py-3">
									<NuxtLink
										:to="`/management/assets/${item.assetId}`"
										class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
									>
										{{ item.name }}
									</NuxtLink>
									<p class="font-mono text-xs text-gray-500">{{ item.code }}</p>
									<p v-if="item.serialNumber" class="font-mono text-xs text-gray-500">Số serial {{ item.serialNumber }}</p>
									<p v-if="itemErrors[item.assetId]" class="mt-1 text-sm text-rose-700 dark:text-rose-300">{{ itemErrors[item.assetId] }}</p>
								</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ item.categoryName }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ itemLocation(item) }}</td>
								<td class="px-4 py-3">
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="ASSET_STATUS_CLASS[item.status]">
										{{ item.statusLabel }}
									</span>
								</td>
								<td v-if="disposal.canViewValue" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
									{{ formatAssetMoney(item.costVnd) }}
								</td>
								<td v-if="disposal.canViewValue" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
									{{ formatAssetMoney(itemBookValue(item)) }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<!-- Trưởng phòng chỉ nhận thiết bị của phòng mình; nói rõ phiếu còn thiết bị khác để không hiểu nhầm số máy. -->
				<p
					v-if="hiddenItemsText(disposal.hiddenItemCount)"
					class="break-words border-t border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400"
				>
					{{ hiddenItemsText(disposal.hiddenItemCount) }}
				</p>
				<p v-if="bookValueNote" class="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
					{{ bookValueNote }}
				</p>
			</section>

			<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
				<!-- Lịch sử xử lý phiếu -->
				<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
					<h2 class="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">Lịch sử xử lý phiếu</h2>
					<p v-if="!disposal.history.length" class="text-sm text-gray-500 dark:text-gray-400">Chưa có lịch sử.</p>
					<ol v-else>
						<li v-for="(h, i) in disposal.history" :key="`${h.round}-${h.action}-${h.at}`" class="relative flex gap-4 pb-5">
							<span
								v-if="i < disposal.history.length - 1"
								class="absolute left-[5px] top-4 h-full w-px bg-gray-200 dark:bg-gray-700"
								aria-hidden="true"
							/>
							<span
								class="relative mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
								:class="{
									'bg-emerald-500': h.action === 'APPROVED',
									'bg-rose-500': h.action === 'REJECTED',
									'bg-gray-400': h.action === 'CANCELLED',
									'bg-brand-500': h.action === 'SUBMITTED' || h.action === 'RESUBMITTED',
								}"
							/>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-gray-900 dark:text-white">
									{{ h.actionLabel }}<template v-if="h.action === 'RESUBMITTED' && h.round > 1">, lần {{ h.round }}</template>
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">{{ formatDateTime(h.at) }} · {{ h.actorName }}</p>
								<p v-if="disposalChangesText(h.changes)" class="mt-0.5 break-words text-sm text-gray-700 dark:text-gray-300">
									{{ disposalChangesText(h.changes) }}
								</p>
								<p v-if="h.note" class="mt-0.5 whitespace-pre-line break-words text-sm text-gray-600 dark:text-gray-300">
									{{ h.action === 'REJECTED' ? 'Lý do' : 'Ghi chú' }}: {{ h.note }}
								</p>
							</div>
						</li>
					</ol>
				</section>

				<!-- Giấy tờ của phiếu -->
				<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
						<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Giấy tờ</h2>
						<CommonAppButton v-if="canUpload" size="sm" variant="primary" class="min-h-11 sm:min-h-0" @click="showUpload = true">
							Tải lên biên bản thanh lý
						</CommonAppButton>
					</div>
					<p v-if="!disposal.documents.length && disposal.hiddenItemCount > 0" class="text-sm text-gray-500 dark:text-gray-400">
						Phiếu có thiết bị của phòng khác nên giấy tờ của phiếu chỉ người quản lý tài sản xem được.
					</p>
					<p v-else-if="!disposal.documents.length" class="text-sm text-gray-500 dark:text-gray-400">
						Chưa có giấy tờ nào.<template v-if="canUpload"> Ký biên bản xong, bạn chụp hoặc quét rồi tải lên đây.</template>
					</p>
					<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
						<li v-for="doc in disposal.documents" :key="doc.id" class="flex items-center justify-between gap-3 py-2">
							<div class="min-w-0">
								<p class="break-all text-sm font-medium text-gray-900 dark:text-white">{{ doc.fileName }}</p>
								<p class="text-xs text-gray-600 dark:text-gray-300">{{ docDetails(doc) }}</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{{ formatFileSize(doc.sizeBytes) }} · tải lên {{ formatDateTime(doc.uploadedAt) }}<template v-if="doc.uploadedBy">
										bởi {{ doc.uploadedBy.name }}</template>
								</p>
							</div>
							<CommonAppButton
								size="sm"
								variant="outline"
								class="min-h-11 flex-shrink-0 sm:min-h-0"
								:loading="opening === doc.id"
								:aria-label="`Mở ${doc.fileName}`"
								@click="openDoc(doc)"
							>
								Mở
							</CommonAppButton>
						</li>
					</ul>
				</section>
			</div>

			<DisposalFormModal v-if="showEdit" :disposal="disposal" @saved="onEdited" @close="showEdit = false" />
			<DocumentUploadModal
				v-if="showUpload"
				:disposal-id="disposal.id"
				default-type="DISPOSAL_RECORD"
				@uploaded="onUploaded"
				@close="showUpload = false"
			/>

			<!-- Hộp duyệt, từ chối, huỷ -->
			<Teleport to="body">
				<div
					v-if="decision"
					class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
					role="dialog"
					aria-modal="true"
					:aria-label="decisionTitle"
				>
					<form class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900" @submit.prevent="submitDecision">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ decisionTitle }} {{ disposalNumber(disposal.id) }}</h2>
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ decisionHint }}</p>
						<div class="mt-4 space-y-1">
							<label for="disposal-decision-note" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								{{ decision === 'reject' ? 'Lý do từ chối' : decision === 'cancel' ? 'Lý do huỷ' : 'Ghi chú' }}
								<span v-if="decision === 'reject'" class="text-red-500">*</span>
							</label>
							<textarea
								id="disposal-decision-note"
								v-model="decisionNote"
								v-bind="decisionNoteAttrs"
								rows="3"
								maxlength="2000"
								:class="`${inputCls} resize-none`"
								:placeholder="decision === 'reject' ? 'VD: thiếu biên bản giám định hỏng, bạn bổ sung rồi gửi lại' : 'Không bắt buộc'"
							/>
							<p v-if="decisionErrors.note" class="text-xs text-red-500">{{ decisionErrors.note }}</p>
						</div>
						<div class="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
							<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" :disabled="deciding" @click="decision = null">
								Quay lại
							</CommonAppButton>
							<CommonAppButton
								:variant="decision === 'approve' ? 'primary' : 'danger'"
								type="submit"
								class="min-h-11 sm:min-h-0"
								:loading="deciding"
							>
								{{ decision === 'approve' ? 'Duyệt phiếu' : decision === 'reject' ? 'Từ chối phiếu' : 'Huỷ phiếu' }}
							</CommonAppButton>
						</div>
					</form>
				</div>
			</Teleport>
		</template>
	</div>
</template>
