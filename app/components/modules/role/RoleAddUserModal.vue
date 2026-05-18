<script setup lang="ts">
import type { RoleEmployee } from '~/types/role.types';
import type { EmployeeSummary } from '~/types/employee.types';

const props = defineProps<{
	roleId: number;
	existingEmployees: RoleEmployee[];
}>();

const emit = defineEmits<{
	close: [];
	added: [];
}>();

const toast = useToast();
const { addEmployeesToRole } = useRole();
const { items: employees, loading: searchLoading, fetchList } = useEmployee();

const search = ref('');
const selected = ref<Set<number>>(new Set());

let searchTimer: ReturnType<typeof setTimeout>;
function onSearch(val: string) {
	search.value = val;
	clearTimeout(searchTimer);
	searchTimer = setTimeout(() => {
		fetchList({ search: val || undefined, limit: 20 });
	}, 400);
}

const existingIds = computed(() => new Set(props.existingEmployees.map(e => e.id)));

const filteredEmployees = computed<EmployeeSummary[]>(() =>
	employees.value.filter(e => !existingIds.value.has(e.id)),
);

function toggleEmployee(id: number) {
	const next = new Set(selected.value);
	next.has(id) ? next.delete(id) : next.add(id);
	selected.value = next;
}

const submitting = ref(false);

async function onSubmit() {
	if (selected.value.size === 0) return;
	submitting.value = true;
	try {
		await addEmployeesToRole(props.roleId, [...selected.value]);
		toast.success(`Đã thêm ${selected.value.size} người vào vai trò`);
		emit('added');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi thêm người dùng');
	} finally {
		submitting.value = false;
	}
}

onMounted(() => {
	fetchList({ limit: 20 });
});
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="emit('close')"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[80vh]"
				>
					<div class="flex items-center justify-between mb-4 flex-shrink-0">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thêm người vào vai trò</h2>
						<button
							class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="emit('close')"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Search -->
					<div class="flex-shrink-0 mb-3">
						<CommonAppInput
							:model-value="search"
							placeholder="Tìm theo tên, email, mã NV..."
							@update:model-value="onSearch"
						/>
					</div>

					<!-- Selected count -->
					<div v-if="selected.size > 0" class="flex-shrink-0 mb-2">
						<span class="text-xs text-brand-600 dark:text-brand-400 font-medium">
							Đã chọn {{ selected.size }} người
						</span>
					</div>

					<!-- List -->
					<div class="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
						<div v-if="searchLoading" class="p-4 space-y-3">
							<div v-for="i in 4" :key="i" class="flex items-center gap-3">
								<div class="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
								<div class="flex-1 space-y-1.5">
									<div class="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
									<div class="h-3 w-44 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
								</div>
							</div>
						</div>

						<div
							v-else-if="!filteredEmployees.length"
							class="flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400"
						>
							Không tìm thấy nhân viên
						</div>

						<label
							v-for="emp in filteredEmployees"
							:key="emp.id"
							class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
						>
							<input
								type="checkbox"
								:checked="selected.has(emp.id)"
								class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600"
								@change="toggleEmployee(emp.id)"
							/>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
								<p class="text-xs text-gray-500 dark:text-gray-400 truncate">
									{{ emp.employeeCode }} &middot; {{ emp.email }}
								</p>
							</div>
							<span v-if="emp.department" class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
								{{ emp.department.name }}
							</span>
						</label>
					</div>

					<div class="flex justify-end gap-3 pt-4 flex-shrink-0">
						<CommonAppButton variant="outline" type="button" @click="emit('close')">Hủy</CommonAppButton>
						<CommonAppButton :disabled="selected.size === 0" :loading="submitting" @click="onSubmit">
							Thêm {{ selected.size > 0 ? `(${selected.size})` : '' }}
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
