<script setup lang="ts">
import { useDirectoryStore } from '~/stores/directory';
import type { EmployeeSummary } from '~/types/employee.types';

const props = defineProps<{
	locationId: number;
	assignedEmployees: EmployeeSummary[];
}>();

const emit = defineEmits<{
	close: [];
	assigned: [employees: EmployeeSummary[]];
}>();

const directoryStore = useDirectoryStore();
const { employees, departments } = storeToRefs(directoryStore);

const searchQuery = ref('');
const selectedDepartmentId = ref<number | null>(null);
const selectedIds = ref<Set<number>>(new Set(props.assignedEmployees.map(e => e.id)));
const submitting = ref(false);

const assignedIds = computed(() => new Set(props.assignedEmployees.map(e => e.id)));

const filteredEmployees = computed(() => {
	let list = employees.value;
	if (selectedDepartmentId.value !== null) {
		list = list.filter(e => e.department?.id === selectedDepartmentId.value);
	}
	if (searchQuery.value.trim()) {
		const q = searchQuery.value.trim().toLowerCase();
		list = list.filter(
			e => e.fullName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q),
		);
	}
	return list;
});

const allFilteredSelected = computed(() => {
	if (!filteredEmployees.value.length) return false;
	return filteredEmployees.value.every(e => selectedIds.value.has(e.id));
});

function toggleEmployee(id: number) {
	const next = new Set(selectedIds.value);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	selectedIds.value = next;
}

function toggleSelectAll() {
	const next = new Set(selectedIds.value);
	if (allFilteredSelected.value) {
		filteredEmployees.value.forEach(e => next.delete(e.id));
	} else {
		filteredEmployees.value.forEach(e => next.add(e.id));
	}
	selectedIds.value = next;
}

const selectedEmployees = computed(() =>
	employees.value.filter(e => selectedIds.value.has(e.id)),
);

async function submit() {
	if (!selectedIds.value.size) return;
	submitting.value = true;
	try {
		emit('assigned', selectedEmployees.value);
	} finally {
		submitting.value = false;
	}
}

onMounted(() => {
	directoryStore.load();
});
</script>

<template>
	<div class="fixed inset-0 z-[1100] flex items-center justify-center p-4">
		<div class="absolute inset-0 bg-black/50" />

		<div class="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[80vh]">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Gán nhân viên</h2>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Filters -->
			<div class="px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex gap-3 flex-shrink-0">
				<div class="relative flex-1">
					<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
					</svg>
					<input
						v-model="searchQuery"
						type="text"
						placeholder="Tìm theo tên hoặc email..."
						class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
					/>
				</div>
				<select
					v-model="selectedDepartmentId"
					class="text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent min-w-[160px]"
				>
					<option :value="null">Tất cả phòng ban</option>
					<option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
				</select>
			</div>

			<!-- Select all row -->
			<div class="px-6 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 flex-shrink-0">
				<input
					type="checkbox"
					:checked="allFilteredSelected"
					:indeterminate="!allFilteredSelected && filteredEmployees.some(e => selectedIds.has(e.id))"
					class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
					@change="toggleSelectAll"
				/>
				<span class="text-xs text-gray-500 dark:text-gray-400">
					Chọn tất cả ({{ filteredEmployees.length }} nhân viên)
				</span>
				<span v-if="selectedIds.size" class="ml-auto text-xs font-medium text-brand-600 dark:text-brand-400">
					Đã chọn {{ selectedIds.size }}
				</span>
			</div>

			<!-- Employee list -->
			<div class="flex-1 overflow-y-auto">
				<div v-if="directoryStore.loading" class="px-6 py-4 space-y-3">
					<div v-for="i in 6" :key="i" class="flex items-center gap-3 animate-pulse">
						<div class="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700" />
						<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
						<div class="flex-1 space-y-1.5">
							<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
							<div class="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
						</div>
					</div>
				</div>

				<div v-else-if="!filteredEmployees.length" class="px-6 py-12 text-center">
					<p class="text-sm text-gray-400">Không tìm thấy nhân viên</p>
				</div>

				<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
					<li
						v-for="emp in filteredEmployees"
						:key="emp.id"
						class="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
						@click="toggleEmployee(emp.id)"
					>
						<input
							type="checkbox"
							:checked="selectedIds.has(emp.id)"
							class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
							@click.stop
							@change="toggleEmployee(emp.id)"
						/>
						<div class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center flex-shrink-0">
							<span class="text-xs font-semibold text-brand-700 dark:text-brand-300">
								{{ emp.fullName.charAt(0).toUpperCase() }}
							</span>
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
							<p class="text-xs text-gray-400 truncate">{{ emp.email }}</p>
						</div>
						<div class="flex items-center gap-2 flex-shrink-0">
							<span v-if="emp.department" class="text-xs text-gray-400">{{ emp.department.name }}</span>
						</div>
					</li>
				</ul>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 flex-shrink-0">
				<button
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
					@click="emit('close')"
				>
					Huỷ
				</button>
				<button
					:disabled="!selectedIds.size || submitting"
					class="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-600 hover:bg-brand-700 text-white"
					@click="submit"
				>
					{{ submitting ? 'Đang gán...' : `Gán ${selectedIds.size || ''} nhân viên` }}
				</button>
			</div>
		</div>
	</div>
</template>
