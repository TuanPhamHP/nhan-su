<script setup lang="ts">
import { useLeaveBalanceService } from '~/services/leave-balance.service';
import type { LeaveType } from '~/types/leave.types';

const props = defineProps<{
	leaveTypes: LeaveType[];
}>();

const emit = defineEmits<{ done: [created: number, skipped: number]; close: [] }>();

const service = useLeaveBalanceService();
const toast = useToast();

const currentYear = new Date().getFullYear();

type InitMode = 'all' | 'single';
const initMode = ref<InitMode>('all');
const selectedLeaveTypeId = ref<number | null>(null);
const selectedYear = ref<number>(currentYear);
const loading = ref(false);

const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

const limitedLeaveTypes = computed(() => props.leaveTypes.filter(t => t.daysPerYear !== null && t.isActive));

const canSubmit = computed(() => initMode.value === 'all' || selectedLeaveTypeId.value !== null);

async function submit() {
	if (!canSubmit.value) {
		toast.error('Vui lòng chọn loại phép');
		return;
	}

	loading.value = true;
	try {
		const leaveTypeId = initMode.value === 'single' ? (selectedLeaveTypeId.value ?? undefined) : undefined;
		const result = await service.bulkInit(selectedYear.value, leaveTypeId);
		emit('done', result.created, result.skipped);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Khởi tạo số dư phép hàng loạt</h2>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="px-6 py-5 space-y-4">
				<!-- Mode toggle -->
				<div class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Chế độ khởi tạo</label>
					<div class="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
						<button
							type="button"
							:class="[
								'flex-1 py-2 px-3 text-sm font-medium transition-colors',
								initMode === 'all'
									? 'bg-brand-600 text-white'
									: 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
							]"
							@click="initMode = 'all'"
						>
							Tất cả loại phép
						</button>
						<button
							type="button"
							:class="[
								'flex-1 py-2 px-3 text-sm font-medium transition-colors border-l border-gray-200 dark:border-gray-700',
								initMode === 'single'
									? 'bg-brand-600 text-white'
									: 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
							]"
							@click="initMode = 'single'"
						>
							Chọn loại phép
						</button>
					</div>
				</div>

				<!-- Leave type selector (single mode only) -->
				<Transition
					enter-active-class="transition-all duration-150 ease-out"
					enter-from-class="opacity-0 -translate-y-1"
					enter-to-class="opacity-100 translate-y-0"
					leave-active-class="transition-all duration-100 ease-in"
					leave-from-class="opacity-100 translate-y-0"
					leave-to-class="opacity-0 -translate-y-1"
				>
					<div v-if="initMode === 'single'" class="space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Loại phép <span class="text-red-500">*</span>
						</label>
						<UiSelect
							:model-value="selectedLeaveTypeId ?? undefined"
							:options="[
								{ value: undefined, label: 'Chọn loại phép...' },
								...limitedLeaveTypes.map(t => ({ value: t.id, label: `${t.name} (${t.daysPerYear} ngày/năm)` })),
							]"
							placeholder="Chọn loại phép..."
							@update:model-value="selectedLeaveTypeId = $event as number"
						/>
						<p class="text-xs text-gray-400">Chỉ hiển thị loại phép có giới hạn số ngày/năm</p>
					</div>
				</Transition>

				<!-- Year -->
				<div class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Năm</label>
					<div class="flex gap-2">
						<button
							v-for="year in yearOptions"
							:key="year"
							type="button"
							:class="[
								'flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
								selectedYear === year
									? 'bg-brand-600 text-white border-brand-600'
									: 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600',
							]"
							@click="selectedYear = year"
						>
							{{ year }}
						</button>
					</div>
				</div>

				<!-- Warning -->
				<div class="flex gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
					<svg
						class="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5"
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
					<p v-if="initMode === 'all'" class="text-xs text-amber-700 dark:text-amber-300">
						Sẽ tạo số dư phép cho tất cả nhân viên đang <strong>ACTIVE</strong> × tất cả loại phép có
						<strong>daysPerYear</strong>. Nhân viên đã có balance trong năm {{ selectedYear }} sẽ bị <strong>bỏ qua</strong>.
					</p>
					<p v-else class="text-xs text-amber-700 dark:text-amber-300">
						Sẽ tạo số dư phép cho tất cả nhân viên đang <strong>ACTIVE</strong>. Nhân viên đã có balance trong năm
						{{ selectedYear }} sẽ bị <strong>bỏ qua</strong>.
					</p>
				</div>

				<div class="flex items-center justify-end gap-3 pt-2">
					<CommonAppButton variant="outline" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton :loading="loading" :disabled="!canSubmit" @click="submit">Khởi tạo</CommonAppButton>
				</div>
			</div>
		</div>
	</div>
</template>
