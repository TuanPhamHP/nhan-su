<script setup lang="ts">
import { useLeaveBalanceService } from '~/services/leave-balance.service';
import type { EmployeeBalanceGroup, LeaveBalance, LeaveType } from '~/types/leave.types';

const props = defineProps<{
	group: EmployeeBalanceGroup;
	year: number;
	leaveTypes: LeaveType[];
}>();

const emit = defineEmits<{ close: []; updated: [] }>();

const balanceService = useLeaveBalanceService();
const toast = useToast();

const balances = ref<LeaveBalance[]>(props.group.balances.map(b => ({ ...b })));
const hasChanges = ref(false);

// Inline edit
const editingId = ref<number | null>(null);
const editingDays = ref(0);
const savingId = ref<number | null>(null);

// Add form
const showAddForm = ref(false);
const addLeaveTypeId = ref<number | null>(null);
const addTotalDays = ref<number | null>(null);
const addLoading = ref(false);

const limitedLeaveTypes = computed(() => props.leaveTypes.filter(t => t.daysPerYear !== null && t.isActive));

const availableLeaveTypes = computed(() =>
	limitedLeaveTypes.value.filter(t => !balances.value.some(b => b.leaveType.id === t.id)),
);

function remainingClass(days: number): string {
	if (days < 2) return 'text-red-600 dark:text-red-400 font-semibold';
	if (days <= 5) return 'text-orange-500 dark:text-orange-400 font-medium';
	return 'text-green-600 dark:text-green-400 font-medium';
}

function startEdit(b: LeaveBalance) {
	editingId.value = b.id;
	editingDays.value = b.totalDays;
}

function cancelEdit() {
	editingId.value = null;
}

async function saveEdit(b: LeaveBalance) {
	savingId.value = b.id;
	try {
		const updated = await balanceService.update(b.id, { totalDays: editingDays.value });
		const idx = balances.value.findIndex(x => x.id === b.id);
		if (idx !== -1) balances.value.splice(idx, 1, updated);
		editingId.value = null;
		hasChanges.value = true;
		toast.success('Đã cập nhật số dư phép');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		savingId.value = null;
	}
}

async function submitAdd() {
	if (!addLeaveTypeId.value || !addTotalDays.value) return;
	addLoading.value = true;
	try {
		const balance = await balanceService.create({
			employeeId: props.group.employee.id,
			leaveTypeId: addLeaveTypeId.value,
			year: props.year,
			totalDays: addTotalDays.value,
		});
		balances.value.push(balance);
		hasChanges.value = true;
		showAddForm.value = false;
		addLeaveTypeId.value = null;
		addTotalDays.value = null;
		toast.success('Đã thêm loại phép');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		addLoading.value = false;
	}
}

function cancelAdd() {
	showAddForm.value = false;
	addLeaveTypeId.value = null;
	addTotalDays.value = null;
}

function close() {
	if (hasChanges.value) emit('updated');
	emit('close');
}
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
			<!-- Header -->
			<div class="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ group.employee.fullName }}</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
						{{ group.employee.employeeCode }}
						<span v-if="group.employee.department"> · {{ group.employee.department.name }}</span>
						· Năm {{ year }}
					</p>
				</div>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="close"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="overflow-y-auto flex-1 px-6 py-4">
				<div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Loại phép
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Tổng ngày
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Đã dùng
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Còn lại
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Thao tác
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="balances.length === 0 && !showAddForm">
								<td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
									Chưa có loại phép nào
								</td>
							</tr>

							<tr
								v-for="bal in balances"
								:key="bal.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{{ bal.leaveType.name }}</td>

								<!-- Tổng ngày — inline edit -->
								<td class="px-4 py-3 text-right">
									<div v-if="editingId === bal.id" class="flex items-center justify-end gap-1.5">
										<input
											v-model.number="editingDays"
											type="number"
											min="0"
											class="w-16 text-right px-2 py-1 text-sm rounded border border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
											@keydown.enter="saveEdit(bal)"
											@keydown.escape="cancelEdit"
										/>
										<button
											:disabled="savingId === bal.id"
											class="p-1 rounded text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
											title="Lưu"
											@click="saveEdit(bal)"
										>
											<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
												<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
											</svg>
										</button>
										<button
											class="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
											title="Huỷ"
											@click="cancelEdit"
										>
											<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
												<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
									<span v-else class="font-medium text-gray-700 dark:text-gray-300">{{ bal.totalDays }}</span>
								</td>

								<td class="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{{ bal.usedDays }}</td>
								<td class="px-4 py-3 text-right">
									<span :class="remainingClass(bal.remainingDays)">{{ bal.remainingDays }}</span>
								</td>
								<td class="px-4 py-3 text-right">
									<button
										v-if="editingId !== bal.id"
										class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
										title="Sửa số ngày"
										@click="startEdit(bal)"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
											/>
										</svg>
									</button>
								</td>
							</tr>

							<!-- Add form row -->
							<tr v-if="showAddForm" class="bg-blue-50/50 dark:bg-blue-900/10">
								<td class="px-4 py-3">
									<UiSelect
										:model-value="addLeaveTypeId ?? undefined"
										:options="[
											{ value: undefined, label: 'Chọn loại phép...' },
											...availableLeaveTypes.map(t => ({ value: t.id, label: `${t.name} (${t.daysPerYear}n/năm)` })),
										]"
										placeholder="Chọn loại phép..."
										@update:model-value="addLeaveTypeId = ($event as number) ?? null"
									/>
								</td>
								<td class="px-4 py-3 text-right">
									<input
										v-model.number="addTotalDays"
										type="number"
										min="1"
										placeholder="Ngày"
										class="w-20 text-right px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
									/>
								</td>
								<td class="px-4 py-3 text-right text-gray-400">—</td>
								<td class="px-4 py-3 text-right text-gray-400">—</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-1.5">
										<button
											:disabled="!addLeaveTypeId || !addTotalDays || addLoading"
											class="p-1 rounded text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
											title="Thêm"
											@click="submitAdd"
										>
											<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
												<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
											</svg>
										</button>
										<button
											class="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
											title="Huỷ"
											@click="cancelAdd"
										>
											<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
												<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<button
					v-if="availableLeaveTypes.length > 0 && !showAddForm"
					class="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
					@click="showAddForm = true"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Thêm loại phép
				</button>
				<div v-else />
				<CommonAppButton variant="outline" @click="close">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
