<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitHeadcountQuantityModal from '~/components/modules/recruitment/RecruitHeadcountQuantityModal.vue';
	import RecruitHeadcountCreateModal from '~/components/modules/recruitment/RecruitHeadcountCreateModal.vue';
	import RecruitHeadcountHistoryModal from '~/components/modules/recruitment/RecruitHeadcountHistoryModal.vue';
	import RecruitNotePromptModal from '~/components/modules/recruitment/RecruitNotePromptModal.vue';
	import RecruitConfirmModal from '~/components/modules/recruitment/RecruitConfirmModal.vue';
	import {
		canDeleteHeadcountRow,
		canEditHeadcountProposal,
		canWithdrawHeadcountProposal,
		downloadRecruitmentBlob,
		headcountDeleteConsequences,
		headcountUsageText,
		headcountYearOptions,
		isHeadcountRowInUse,
		overCommittedExplanation,
		recruitErrorCode,
		recruitErrorMessage,
		HEADCOUNT_STATUS_CLASS,
	} from '~/utils/recruitment.utils';
	import type { HeadcountRow } from '~/types/recruitment.types';

	definePageMeta({ title: 'Định biên tuyển dụng' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	/**
	 * Hai quyền ghi khác nhau, đừng gộp:
	 * - `recruitment:manage` nhập nháp, đề xuất và gửi chốt.
	 * - `recruitment:headcount:confirm` chốt, trả lại và sửa thẳng số đã chốt.
	 * Người chỉ có quyền thứ nhất không thấy nút Chốt, và ngược lại.
	 */
	const canPropose = computed(() => canWrite('RECRUIT') && hasPermission('recruitment:manage'));
	const canConfirm = computed(
		() => canWrite('RECRUIT') && hasPermission('recruitment:headcount:confirm'),
	);

	// Thông báo N-15, N-16 trỏ về trang này kèm `?year=`, nên năm đọc từ URL.
	const yearOptions = headcountYearOptions();
	const initialYear = Number(route.query.year);
	const year = ref(
		Number.isInteger(initialYear) && initialYear > 2000 ? initialYear : new Date().getFullYear(),
	);
	const filterDept = ref<number | undefined>(undefined);

	const rows = ref<HeadcountRow[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const exporting = ref(false);
	const selected = ref<number[]>([]);

	const showCreate = ref(false);
	const quantityTarget = ref<{ row: HeadcountRow; mode: 'proposal' | 'confirmed' } | null>(null);
	const historyTarget = ref<HeadcountRow | null>(null);
	const rejectIds = ref<number[] | null>(null);
	const withdrawTarget = ref<HeadcountRow | null>(null);
	const deleteTarget = ref<HeadcountRow | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		selected.value = [];
		try {
			rows.value = await service.findHeadcountPlans({
				year: year.value,
				departmentId: filterDept.value,
			});
		} catch (e) {
			// Trưởng phòng lọc phòng khác nhận 403 ở đây — hiện lý do, giữ bảng rỗng.
			rows.value = [];
			loadError.value = recruitErrorMessage(e, 'Không tải được bảng định biên');
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		directoryStore.load().catch(() => {
			/* ô lọc phòng ban rỗng, bảng vẫn chạy */
		});
		await load();
	});

	watch([year, filterDept], () => {
		load();
	});

	// Giữ `?year=` khớp ô chọn để người dùng chia sẻ được đúng năm đang xem.
	watch(year, y => {
		router.replace({ path: '/management/recruitment/headcount', query: { year: String(y) } });
	});

	const deptOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id as number | undefined, label: d.name })),
	]);

	const usedPositionIds = computed(() => rows.value.map(r => r.position.id));

	// ─── Chọn dòng cho thao tác hàng loạt ─────────────────────────────────────────
	//
	// Ba thao tác hàng loạt có điều kiện khác nhau, nên tính riêng từng tập thay vì dùng
	// chung một danh sách đang chọn: gửi được dòng có đề xuất Nháp hoặc Bị trả lại; chốt
	// được dòng có đề xuất Nháp hoặc Chờ chốt; trả lại chỉ được dòng Chờ chốt.

	const submittableIds = computed(() =>
		selected.value.filter(id => {
			const row = rows.value.find(r => r.id === id);
			return row?.proposalStatus === 'DRAFT' || row?.proposalStatus === 'REJECTED';
		}),
	);

	const confirmableIds = computed(() =>
		selected.value.filter(id => {
			const row = rows.value.find(r => r.id === id);
			return row?.proposalStatus === 'DRAFT' || row?.proposalStatus === 'PENDING';
		}),
	);

	const rejectableIds = computed(() =>
		selected.value.filter(id => rows.value.find(r => r.id === id)?.proposalStatus === 'PENDING'),
	);

	const allSelected = computed(
		() => rows.value.length > 0 && selected.value.length === rows.value.length,
	);

	function toggleAll() {
		selected.value = allSelected.value ? [] : rows.value.map(r => r.id);
	}

	function toggleRow(id: number) {
		selected.value = selected.value.includes(id)
			? selected.value.filter(x => x !== id)
			: [...selected.value, id];
	}

	const acting = ref(false);

	async function runBulk(action: () => Promise<unknown>, okMessage: string) {
		if (acting.value) return;
		acting.value = true;
		try {
			await action();
			toast.success(okMessage);
			await load();
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Thao tác thất bại'));
		} finally {
			acting.value = false;
		}
	}

	const submitSelected = () =>
		runBulk(() => service.submitHeadcount(submittableIds.value), 'Đã gửi đề xuất cho người chốt');

	const confirmSelected = () =>
		runBulk(() => service.confirmHeadcount(confirmableIds.value), 'Đã chốt định biên');

	async function doReject(reason: string) {
		if (!rejectIds.value?.length) return;
		await service.rejectHeadcount(rejectIds.value, reason);
	}

	async function onRejected() {
		rejectIds.value = null;
		toast.success('Đã trả lại đề xuất');
		await load();
	}

	// ─── Nút trên từng dòng ───────────────────────────────────────────────────────
	//
	// Luật hiện nút nằm ở `recruitment.utils.ts` để test được bằng vitest: bảng này có năm
	// nút mà điều kiện phụ thuộc vào ba thứ cùng lúc (đã chốt chưa, đề xuất đang ở đâu, người
	// xem có quyền gì), nhiều hơn mức đọc một dòng `v-if` là hiểu.

	const rights = computed(() => ({ canPropose: canPropose.value, canConfirm: canConfirm.value }));

	const showEdit = (row: HeadcountRow) => canEditHeadcountProposal(row, rights.value);
	const showWithdraw = (row: HeadcountRow) => canWithdrawHeadcountProposal(row, rights.value);
	const showDelete = (row: HeadcountRow) => canDeleteHeadcountRow(row, rights.value);

	async function doWithdraw() {
		const row = withdrawTarget.value;
		if (!row) return;
		await runBulk(
			() => service.withdrawHeadcountProposal(row.id),
			`Đã rút đề xuất của ${row.position.name}, số đã chốt giữ nguyên`,
		);
		withdrawTarget.value = null;
	}

	/**
	 * Dòng đang dùng thì hộp xoá là hộp cảnh báo kèm ô lý do; dòng khác là hộp xác nhận thường.
	 * Một nút Xoá, một hộp, không hỏi hai lần.
	 */
	const deleteNeedsReason = computed(() =>
		deleteTarget.value ? isHeadcountRowInUse(deleteTarget.value) : false,
	);

	async function doDelete(reason: string) {
		const row = deleteTarget.value;
		if (!row || acting.value) return;
		acting.value = true;
		try {
			await service.deleteHeadcountPlan(row.id, reason || undefined);
			toast.success(`Đã xoá dòng ${row.position.name}`);
			await load();
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Xoá dòng định biên thất bại'));
			// 400 `RECRUIT_REASON_REQUIRED` giờ chỉ còn nghĩa là bảng đang xem đã cũ: vừa có người
			// tạo yêu cầu tuyển mới cho vị trí này, nên dòng đã thành "đang dùng" mà màn hình chưa
			// biết. Tải lại để lần bấm sau mở đúng hộp cảnh báo kèm ô lý do.
			if (recruitErrorCode(e) === 'RECRUIT_REASON_REQUIRED') await load();
		} finally {
			acting.value = false;
			deleteTarget.value = null;
		}
	}

	/** Những gì sẽ mất khi xoá, để người dùng đọc trước lúc bấm. */
	function deleteDetails(row: HeadcountRow): string[] {
		if (isHeadcountRowInUse(row)) return headcountDeleteConsequences();
		const lines = [`${row.department.name} · ${row.position.name} · năm ${row.year}`];
		if (row.confirmedQuantity !== null) {
			lines.push(`Đang có số đã chốt là ${row.confirmedQuantity}, xoá dòng là mất con số đó.`);
		}
		if (row.proposedQuantity !== null) {
			lines.push(`Đề xuất ${row.proposedQuantity} đang mở cũng mất theo.`);
		}
		return lines;
	}

	/** Câu mở đầu hộp xoá: dòng đang dùng thì nói ngay đang có bao nhiêu người, bao nhiêu yêu cầu. */
	function deleteDescription(row: HeadcountRow): string {
		if (isHeadcountRowInUse(row)) {
			return `${row.position.name} · ${row.department.name} · năm ${row.year} ${headcountUsageText(row)}.`;
		}
		return 'Xoá hẳn dòng này cùng lịch sử thay đổi của nó. Sau khi xoá vẫn tạo lại được dòng cho cùng vị trí và năm.';
	}

	// ─── Sửa một dòng ─────────────────────────────────────────────────────────────

	async function saveQuantity(quantity: number, note?: string) {
		const target = quantityTarget.value;
		if (!target) return;
		if (target.mode === 'proposal') {
			await service.saveHeadcountProposal(target.row.id, { quantity, note });
		} else {
			await service.saveConfirmedHeadcount(target.row.id, { quantity, note });
		}
	}

	async function onQuantitySaved() {
		quantityTarget.value = null;
		toast.success('Đã lưu định biên');
		await load();
	}

	async function handleExport() {
		exporting.value = true;
		try {
			const blob = await service.exportHeadcountReport({
				year: year.value,
				departmentId: filterDept.value,
			});
			downloadRecruitmentBlob(blob, `dinh-bien-${year.value}.xlsx`);
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Xuất Excel thất bại'));
		} finally {
			exporting.value = false;
		}
	}

	/** Nhãn phụ "Chờ chốt" bên cạnh trạng thái gộp, vì dòng đã chốt vẫn có thể đang chờ. */
	function proposalBadge(row: HeadcountRow): string | null {
		if (!row.proposalStatus) return null;
		if (row.status === row.proposalStatus) return null;
		return row.proposalStatusLabel;
	}

	const totals = computed(() =>
		rows.value.reduce(
			(acc, r) => ({
				confirmed: acc.confirmed + (r.confirmedQuantity ?? 0),
				current: acc.current + r.current,
				recruiting: acc.recruiting + r.recruiting,
				available: acc.available + r.available,
			}),
			{ confirmed: 0, current: 0, recruiting: 0, available: 0 },
		),
	);
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Định biên tuyển dụng</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Số người được duyệt cho từng vị trí trong năm, và phần còn trống để gửi yêu cầu tuyển
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<CommonAppButton variant="outline" :loading="exporting" @click="handleExport">
					Xuất Excel
				</CommonAppButton>
				<CommonAppButton
					v-if="canPropose || canConfirm"
					variant="primary"
					@click="showCreate = true"
				>
					Thêm dòng
				</CommonAppButton>
			</div>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<UiSelect v-model="year" :options="yearOptions" />
				<UiSelect v-model="filterDept" :options="deptOptions" />
			</div>
		</div>

		<!-- Thanh thao tác hàng loạt -->
		<div
			v-if="selected.length"
			class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-900/20"
		>
			<p class="text-sm text-brand-800 dark:text-brand-200">Đang chọn {{ selected.length }} dòng</p>
			<div class="flex flex-wrap items-center gap-2">
				<CommonAppButton
					v-if="canPropose"
					variant="outline"
					size="sm"
					:disabled="!submittableIds.length || acting"
					@click="submitSelected"
				>
					Gửi chốt ({{ submittableIds.length }})
				</CommonAppButton>
				<CommonAppButton
					v-if="canConfirm"
					variant="danger_outline"
					size="sm"
					:disabled="!rejectableIds.length || acting"
					@click="rejectIds = rejectableIds"
				>
					Trả lại ({{ rejectableIds.length }})
				</CommonAppButton>
				<CommonAppButton
					v-if="canConfirm"
					variant="primary"
					size="sm"
					:disabled="!confirmableIds.length || acting"
					@click="confirmSelected"
				>
					Chốt ({{ confirmableIds.length }})
				</CommonAppButton>
				<CommonAppButton variant="ghost" size="sm" @click="selected = []">Bỏ chọn</CommonAppButton>
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div v-else-if="loadError" class="px-4 py-10 text-center">
				<p class="text-sm text-rose-600 dark:text-rose-400">{{ loadError }}</p>
			</div>

			<div
				v-else-if="!rows.length"
				class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500"
			>
				<p class="text-sm">Năm {{ year }} chưa có dòng định biên nào</p>
				<p class="mt-1 text-xs">
					Chưa chốt định biên cho một vị trí thì không gửi được yêu cầu tuyển cho vị trí đó.
				</p>
			</div>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<!-- Người chỉ xem (trưởng phòng) không có thao tác hàng loạt nào, nên không cần ô chọn. -->
							<th v-if="canPropose || canConfirm" class="w-10 px-4 py-3">
								<input
									type="checkbox"
									:checked="allSelected"
									class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									aria-label="Chọn tất cả"
									@change="toggleAll"
								/>
							</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phòng ban</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Vị trí</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đã chốt</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đang có</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đang tuyển</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Còn trống</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đề xuất</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr
							v-for="row in rows"
							:key="row.id"
							class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
							:class="row.overCommitted ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''"
						>
							<td v-if="canPropose || canConfirm" class="px-4 py-3">
								<input
									type="checkbox"
									:checked="selected.includes(row.id)"
									class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									:aria-label="`Chọn ${row.position.name}`"
									@change="toggleRow(row.id)"
								/>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ row.department.name }}</td>
							<td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.position.name }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">
								{{ row.confirmedQuantity ?? '—' }}
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
								{{ row.current }}
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
								{{ row.recruiting }}
							</td>
							<td
								class="px-4 py-3 text-right font-semibold tabular-nums"
								:class="
									row.available < 0
										? 'text-rose-600 dark:text-rose-400'
										: row.available === 0
											? 'text-gray-500 dark:text-gray-400'
											: 'text-emerald-600 dark:text-emerald-400'
								"
							>
								{{ row.available }}
							</td>
							<td class="px-4 py-3">
								<template v-if="row.proposedQuantity != null">
									<p class="tabular-nums text-gray-900 dark:text-white">{{ row.proposedQuantity }}</p>
									<p v-if="row.proposalNote" class="mt-0.5 max-w-[16rem] truncate text-xs text-gray-400">
										{{ row.proposalNote }}
									</p>
									<p v-if="row.rejectReason" class="mt-0.5 text-xs text-rose-600 dark:text-rose-400">
										Bị trả lại: {{ row.rejectReason }}
									</p>
								</template>
								<span v-else class="text-gray-400 dark:text-gray-500">—</span>
							</td>
							<td class="px-4 py-3">
								<div class="flex flex-wrap items-center gap-1">
									<RecruitChip :label="row.statusLabel" :tone="HEADCOUNT_STATUS_CLASS[row.status]" />
									<RecruitChip
										v-if="proposalBadge(row)"
										:label="proposalBadge(row) as string"
										tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
									/>
								</div>
								<p v-if="row.overCommitted" class="mt-1 max-w-[18rem] text-xs text-amber-700 dark:text-amber-400">
									<span class="font-medium">Vượt định biên.</span>
									{{ overCommittedExplanation(row) }}
								</p>
							</td>
							<td class="px-4 py-3">
								<div class="flex flex-wrap justify-end gap-2 text-xs">
									<button
										v-if="showEdit(row)"
										type="button"
										class="text-brand-600 hover:underline dark:text-brand-400"
										@click="quantityTarget = { row, mode: 'proposal' }"
									>
										Đề xuất
									</button>
									<!--
										Đề xuất đang chờ chốt thì mọi nút ghi đều bị BE trả 409, nên thay bằng
										một câu nói rõ phải chờ ai, hơn là để người dùng bấm vào lỗi.
									-->
									<span
										v-else-if="canPropose && row.proposalStatus === 'PENDING'"
										class="text-gray-400 dark:text-gray-500"
										title="Người có quyền chốt phải chốt hoặc trả lại trước"
									>
										Chờ chốt
									</span>
									<button
										v-if="showWithdraw(row)"
										type="button"
										class="text-gray-500 hover:underline dark:text-gray-400"
										@click="withdrawTarget = row"
									>
										Rút đề xuất
									</button>
									<button
										v-if="canConfirm"
										type="button"
										class="text-brand-600 hover:underline dark:text-brand-400"
										@click="quantityTarget = { row, mode: 'confirmed' }"
									>
										Sửa số chốt
									</button>
									<button
										type="button"
										class="text-gray-500 hover:underline dark:text-gray-400"
										@click="historyTarget = row"
									>
										Lịch sử
									</button>
									<button
										v-if="showDelete(row)"
										type="button"
										class="text-rose-600 hover:underline dark:text-rose-400"
										@click="deleteTarget = row"
									>
										Xoá
									</button>
								</div>
							</td>
						</tr>
					</tbody>
					<tfoot v-if="rows.length > 1">
						<tr class="border-t border-gray-200 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/50">
							<td v-if="canPropose || canConfirm" class="px-4 py-3" />
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300" colspan="2">Tổng {{ rows.length }} dòng</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">{{ totals.confirmed }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{{ totals.current }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{{ totals.recruiting }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">{{ totals.available }}</td>
							<td class="px-4 py-3" colspan="3" />
						</tr>
					</tfoot>
				</table>
			</div>
		</div>

		<RecruitHeadcountCreateModal
			v-if="showCreate"
			:year="year"
			:confirms-immediately="canConfirm"
			:used-position-ids="usedPositionIds"
			@created="
				showCreate = false;
				load();
			"
			@close="showCreate = false"
		/>

		<RecruitHeadcountQuantityModal
			v-if="quantityTarget"
			:row="quantityTarget.row"
			:mode="quantityTarget.mode"
			:submit="saveQuantity"
			@done="onQuantitySaved"
			@close="quantityTarget = null"
		/>

		<RecruitHeadcountHistoryModal
			v-if="historyTarget"
			:row="historyTarget"
			@close="historyTarget = null"
		/>

		<RecruitConfirmModal
			v-if="withdrawTarget"
			title="Rút đề xuất định biên"
			description="Đề xuất đang mở sẽ bị xoá, số đã chốt giữ nguyên hiệu lực. Lịch sử của dòng ghi lại lần rút này."
			:details="[
				`${withdrawTarget.department.name} · ${withdrawTarget.position.name} · năm ${withdrawTarget.year}`,
				`Đề xuất ${withdrawTarget.proposedQuantity} bị rút, số đã chốt vẫn là ${withdrawTarget.confirmedQuantity}.`,
			]"
			confirm-label="Rút đề xuất"
			variant="primary"
			:loading="acting"
			@confirm="doWithdraw"
			@close="withdrawTarget = null"
		/>

		<RecruitConfirmModal
			v-if="deleteTarget"
			:title="deleteNeedsReason ? 'Xoá dòng định biên đang dùng' : 'Xoá dòng định biên'"
			:description="deleteDescription(deleteTarget)"
			:details="deleteDetails(deleteTarget)"
			:tone="deleteNeedsReason ? 'danger' : 'neutral'"
			:reason-label="deleteNeedsReason ? 'Lý do xoá' : undefined"
			reason-placeholder="Vì sao bỏ định biên của vị trí này..."
			confirm-label="Xoá dòng"
			variant="danger"
			:loading="acting"
			@confirm="doDelete"
			@close="deleteTarget = null"
		/>

		<RecruitNotePromptModal
			v-if="rejectIds"
			title="Trả lại đề xuất định biên"
			description="Số đã chốt cũ vẫn giữ hiệu lực. Người đề xuất nhận được lý do này kèm thông báo."
			label="Lý do trả lại"
			confirm-label="Trả lại"
			variant="danger"
			:submit="doReject"
			@done="onRejected"
			@close="rejectIds = null"
		/>
	</div>
</template>
