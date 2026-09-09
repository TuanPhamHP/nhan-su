<script setup lang="ts">
import { storeToRefs } from 'pinia';
import LeaveSplitPreview from '~/components/modules/tools/LeaveSplitPreview.vue';
import LeaveBalancePreview from '~/components/modules/tools/LeaveBalancePreview.vue';
import ToolConfirmModal from '~/components/modules/tools/ToolConfirmModal.vue';
import type { LeaveToolsFilter } from '~/composables/useLeaveTools';
import type { SelectOption } from '~/components/ui/Select.vue';
import { formatDateTime } from '~/utils/date';

definePageMeta({
	title: 'Tính lại phép năm',
	middleware: [
		function () {
			const auth = useAuthStore();
			if (auth.user?.role !== 'ADMIN') return navigateTo('/');
		},
	],
});

const toast = useToast();
const router = useRouter();
const directoryStore = useDirectoryStore();
const { employees } = storeToRefs(directoryStore);

const {
	splitPreview,
	splitApplied,
	splitLoading,
	balancePreview,
	balanceApplied,
	balanceLoading,
	step1Settled,
	lastSplitRunAt,
	lastBalanceRunAt,
	reset,
	invalidateIfFilterChanged,
	previewSplit,
	applySplit,
	previewBalance,
	applyBalance,
	loadLastRuns,
} = useLeaveTools();

// ─── Filter ───────────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear();

const filter = reactive<LeaveToolsFilter>({
	year: currentYear,
	month: undefined,
	employeeIds: [],
});

const yearOptions = computed<SelectOption[]>(() =>
	Array.from({ length: 6 }, (_, i) => {
		const y = currentYear - 4 + i;
		return { value: y, label: `Năm ${y}` };
	}),
);

const monthOptions = computed<SelectOption[]>(() => [
	{ value: 0, label: 'Cả năm' },
	...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
]);

const employeeOptions = computed(() => [
	{ value: 0, label: 'Thêm nhân viên...' },
	...employees.value
		.filter(e => !filter.employeeIds?.includes(e.id))
		.map(e => ({ value: e.id, label: `${e.fullName} (${e.employeeCode})` })),
]);

const selectedEmployees = computed(() =>
	(filter.employeeIds ?? []).map(id => ({
		id,
		label: employees.value.find(e => e.id === id)?.fullName ?? `#${id}`,
	})),
);

function addEmployee(id: number) {
	if (!id) return;
	if (!filter.employeeIds) filter.employeeIds = [];
	if (!filter.employeeIds.includes(id)) filter.employeeIds.push(id);
}

function removeEmployee(id: number) {
	filter.employeeIds = (filter.employeeIds ?? []).filter(x => x !== id);
}

// Đổi filter → payload không còn khớp với kết quả đã xem trước, bắt xem trước lại.
watch(
	() => [filter.year, filter.month, (filter.employeeIds ?? []).join(',')],
	() => invalidateIfFilterChanged(filter),
);

// ─── Confirm modal ────────────────────────────────────────────────────────────
type ConfirmTarget = 'split' | 'balance';
const confirmTarget = ref<ConfirmTarget | null>(null);

const confirmConfig = computed(() => {
	if (confirmTarget.value === 'split' && splitPreview.value) {
		const delta = splitPreview.value.paidBefore - splitPreview.value.paidAfter;
		return {
			title: 'Áp dụng bước 1 — tính lại đơn',
			message: `${splitPreview.value.changed} đơn sẽ được ghi lại, ${delta} ngày chuyển từ có lương sang không lương.`,
		};
	}
	if (confirmTarget.value === 'balance' && balancePreview.value) {
		return {
			title: 'Áp dụng bước 2 — ghi lại số dư',
			message: `${balancePreview.value.changed} bản ghi số dư sẽ bị ghi đè, tổng chênh lệch ${balancePreview.value.totalDelta} ngày.`,
		};
	}
	return { title: '', message: '' };
});

const confirmLoading = computed(() =>
	confirmTarget.value === 'split' ? splitLoading.value : balanceLoading.value,
);

// ─── Actions ──────────────────────────────────────────────────────────────────
async function handlePreviewSplit() {
	try {
		const res = await previewSplit(filter);
		toast.success(res.changed === 0 ? 'Không có đơn nào cần sửa' : `${res.changed} đơn cần sửa`);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không thể xem trước bước 1');
	}
}

async function handlePreviewBalance() {
	try {
		const res = await previewBalance(filter);
		toast.success(res.changed === 0 ? 'Không có số dư nào cần sửa' : `${res.changed} bản ghi cần sửa`);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không thể xem trước bước 2');
	}
}

async function handleConfirm() {
	const target = confirmTarget.value;
	if (!target) return;
	try {
		if (target === 'split') {
			const res = await applySplit(filter);
			toast.success(`Đã cập nhật ${res.changed} đơn`);
		} else {
			const res = await applyBalance(filter);
			toast.success(`Đã ghi lại ${res.changed} bản ghi số dư`);
		}
		confirmTarget.value = null;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Áp dụng thất bại');
	}
}

function goToBalances() {
	router.push('/management/leave?tab=balances');
}

function resetWizard() {
	reset();
	toast.info('Đã đặt lại wizard — chạy xem trước để bắt đầu');
}

onMounted(async () => {
	try {
		await directoryStore.load();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không thể tải danh sách nhân viên');
	}
	loadLastRuns();
});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div class="flex items-start justify-between gap-4">
			<div>
				<NuxtLink
					to="/management/tools"
					class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
					</svg>
					Tools
				</NuxtLink>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white mt-1">Tính lại phép năm & công lương</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
					Sửa dữ liệu cũ sau khi quy tắc nghỉ nửa ngày đổi sang trừ 0.5 ngày quỹ phép năm.
				</p>
			</div>
			<CommonAppButton variant="ghost" size="sm" @click="resetWizard">Đặt lại</CommonAppButton>
		</div>

		<!-- Cảnh báo chạy lại -->
		<div class="flex gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
			<svg
				class="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
				/>
			</svg>
			<div class="text-sm text-amber-800 dark:text-amber-200 space-y-1">
				<p>Chỉ chạy lại khi thực sự cần. Chạy ở tháng khác có thể làm đổi số liệu đã chốt.</p>
				<p class="text-xs">
					Lần chạy bước 1 gần nhất: <strong>{{ lastSplitRunAt ? formatDateTime(lastSplitRunAt) : 'chưa từng' }}</strong>
					· bước 2: <strong>{{ lastBalanceRunAt ? formatDateTime(lastBalanceRunAt) : 'chưa từng' }}</strong>
				</p>
			</div>
		</div>

		<!-- BƯỚC 1 — phạm vi -->
		<section class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
			<div class="flex items-center gap-2.5">
				<span
					class="flex items-center justify-center w-7 h-7 rounded-full bg-brand-600 text-white text-sm font-semibold"
				>
					1
				</span>
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chọn phạm vi</h2>
			</div>

			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Năm</label>
					<UiSelect v-model="filter.year" :options="yearOptions" />
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tháng (tuỳ chọn)</label>
					<UiSelect
						:model-value="filter.month ?? 0"
						:options="monthOptions"
						@update:model-value="filter.month = $event ? (Number($event) as number) : undefined"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
						Nhân viên (tuỳ chọn)
					</label>
					<UiSelectInput
						:model-value="0"
						:options="employeeOptions"
						placeholder="Toàn bộ nhân sự"
						search-placeholder="Tìm nhân viên..."
						@update:model-value="addEmployee(Number($event))"
					/>
				</div>
			</div>

			<div v-if="selectedEmployees.length > 0" class="flex flex-wrap gap-1.5">
				<span
					v-for="emp in selectedEmployees"
					:key="emp.id"
					class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
				>
					{{ emp.label }}
					<button class="text-gray-400 hover:text-red-500" @click="removeEmployee(emp.id)">
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</span>
			</div>

			<p class="text-xs text-gray-500 dark:text-gray-400">
				Chọn tháng khi tháng trước đã chốt lương và không muốn số liệu đã thanh toán bị đổi. Ở bước 2, tháng chỉ
				<strong>thu hẹp danh sách nhân sự</strong> — <code>usedDays</code> vẫn luôn cộng từ toàn bộ đơn trong năm.
			</p>

			<CommonAppButton :loading="splitLoading" @click="handlePreviewSplit">Xem trước bước 1</CommonAppButton>
		</section>

		<!-- BƯỚC 2 — xem trước & áp dụng tính lại đơn -->
		<section
			class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4"
			:class="{ 'opacity-60 pointer-events-none': !splitPreview }"
		>
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-2.5">
					<span
						class="flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold"
						:class="
							splitApplied
								? 'bg-green-600 text-white'
								: splitPreview
									? 'bg-brand-600 text-white'
									: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
						"
					>
						2
					</span>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Tính lại đơn đã duyệt (P / KL)</h2>
				</div>
				<span
					v-if="splitApplied"
					class="px-2 py-0.5 text-xs font-semibold rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
				>
					Đã áp dụng
				</span>
			</div>

			<p v-if="!splitPreview" class="text-sm text-gray-500 dark:text-gray-400">
				Chạy "Xem trước bước 1" để xem những đơn sẽ thay đổi.
			</p>

			<template v-else>
				<LeaveSplitPreview :result="splitApplied ?? splitPreview" />
				<CommonAppButton
					v-if="!splitApplied"
					variant="danger"
					:disabled="splitPreview.changed === 0"
					:loading="splitLoading"
					@click="confirmTarget = 'split'"
				>
					Áp dụng bước 1
				</CommonAppButton>
			</template>
		</section>

		<!-- BƯỚC 3 — xem trước & áp dụng ghi lại số dư -->
		<section
			class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4"
			:class="{ 'opacity-60 pointer-events-none': !step1Settled }"
		>
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-2.5">
					<span
						class="flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold"
						:class="
							balanceApplied
								? 'bg-green-600 text-white'
								: step1Settled
									? 'bg-brand-600 text-white'
									: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
						"
					>
						3
					</span>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Ghi lại số dư đã dùng</h2>
				</div>
				<span
					v-if="balanceApplied"
					class="px-2 py-0.5 text-xs font-semibold rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
				>
					Đã áp dụng
				</span>
			</div>

			<p v-if="!step1Settled" class="text-sm text-gray-500 dark:text-gray-400">
				Phải áp dụng xong bước 1 trước — <code>usedDays</code> được cộng từ <code>paidDays</code> mà bước 1 vừa ghi.
			</p>

			<template v-else>
				<CommonAppButton v-if="!balancePreview" :loading="balanceLoading" @click="handlePreviewBalance">
					Xem trước bước 2
				</CommonAppButton>

				<template v-else>
					<LeaveBalancePreview :result="balanceApplied ?? balancePreview" @go-to-balances="goToBalances" />
					<div class="flex items-center gap-2">
						<CommonAppButton
							v-if="!balanceApplied"
							variant="danger"
							:disabled="balancePreview.changed === 0"
							:loading="balanceLoading"
							@click="confirmTarget = 'balance'"
						>
							Áp dụng bước 2
						</CommonAppButton>
						<CommonAppButton
							v-if="!balanceApplied"
							variant="ghost"
							:loading="balanceLoading"
							@click="handlePreviewBalance"
						>
							Xem trước lại
						</CommonAppButton>
					</div>
				</template>
			</template>
		</section>

		<!-- BƯỚC 4 — tổng kết -->
		<section
			v-if="splitApplied || balanceApplied"
			class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-3"
		>
			<div class="flex items-center gap-2.5">
				<span class="flex items-center justify-center w-7 h-7 rounded-full bg-green-600 text-white text-sm font-semibold">
					4
				</span>
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Tổng kết</h2>
			</div>
			<ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
				<li v-if="splitApplied">
					Bước 1 — đã ghi lại <strong>{{ splitApplied.changed }}</strong> đơn,
					<strong>{{ splitApplied.paidBefore - splitApplied.paidAfter }}</strong> ngày chuyển sang không lương.
				</li>
				<li v-if="balanceApplied">
					Bước 2 — đã ghi lại <strong>{{ balanceApplied.changed }}</strong> bản ghi số dư, tổng chênh lệch
					<strong>{{ balanceApplied.totalDelta }}</strong> ngày.
				</li>
				<li v-if="balanceApplied && balanceApplied.skipped.length > 0" class="text-amber-700 dark:text-amber-300">
					Còn {{ balanceApplied.skipped.length }} nhân sự chưa được cấp phát quỹ — chưa ghi được số dư.
				</li>
			</ul>
			<p class="text-xs text-gray-500 dark:text-gray-400">
				Các ngày chuyển P → KL không còn được cộng vào tổng công tính lương; bảng công sẽ hiện ký hiệu KL / KL/X.
			</p>
		</section>

		<!-- Confirm -->
		<Teleport to="body">
			<ToolConfirmModal
				v-if="confirmTarget"
				:title="confirmConfig.title"
				:message="confirmConfig.message"
				:loading="confirmLoading"
				@confirm="handleConfirm"
				@close="confirmTarget = null"
			/>
		</Teleport>
	</div>
</template>
