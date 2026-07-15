<script setup lang="ts">
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useDashboardService } from '~/services/dashboard.service';
import type { NewHireEmployee } from '~/types/dashboard.types';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const toast = useToast();
const dashboardService = useDashboardService();

const loading = ref(false);
const employees = ref<NewHireEmployee[]>([]);

const dateRange = computed(() => {
	const today = new Date();
	return {
		to_date: format(today, 'yyyy-MM-dd'),
		from_date: format(subDays(today, 30), 'yyyy-MM-dd'),
	};
});

const fromLabel = computed(() => format(subDays(new Date(), 30), 'dd/MM/yyyy', { locale: vi }));
const toLabel = computed(() => format(new Date(), 'dd/MM/yyyy', { locale: vi }));

async function load() {
	loading.value = true;
	employees.value = [];
	try {
		employees.value = await dashboardService.getNewHires(dateRange.value);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không thể tải danh sách nhân viên mới');
		emit('close');
	} finally {
		loading.value = false;
	}
}

watch(() => props.open, (val) => {
	if (val) load();
});

function formatJoinDate(iso: string) {
	return format(new Date(iso), 'dd/MM/yyyy', { locale: vi });
}
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition-opacity duration-200"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition-opacity duration-150"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
				<!-- Backdrop -->
				<div class="absolute inset-0 bg-black/50" @click="emit('close')" />

				<!-- Panel -->
				<Transition
					enter-active-class="transition-all duration-200"
					enter-from-class="opacity-0 scale-95"
					enter-to-class="opacity-100 scale-100"
					leave-active-class="transition-all duration-150"
					leave-from-class="opacity-100 scale-100"
					leave-to-class="opacity-0 scale-95"
				>
					<div v-if="open" class="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
						<!-- Header -->
						<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
							<div>
								<h2 class="text-base font-semibold text-gray-900 dark:text-white">Nhân viên mới</h2>
								<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ fromLabel }} – {{ toLabel }}</p>
							</div>
							<button
								class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 flex items-center justify-center transition-colors"
								@click="emit('close')"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<!-- Body -->
						<div class="max-h-[28rem] overflow-y-auto">
							<!-- Loading skeleton -->
							<div v-if="loading" class="p-4 space-y-3">
								<div v-for="n in 5" :key="n" class="flex items-center gap-3 animate-pulse">
									<div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
									<div class="flex-1 space-y-1.5">
										<div class="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-36" />
										<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48" />
									</div>
									<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
								</div>
							</div>

							<!-- Employee list -->
							<div v-else-if="employees.length" class="divide-y divide-gray-100 dark:divide-gray-800">
								<div
									v-for="emp in employees"
									:key="emp.id"
									class="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
								>
									<!-- Avatar -->
									<CommonAppAvatar :src="emp.avatarUrl" :name="emp.fullName" size="md" />

									<!-- Info -->
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
										<p class="text-xs text-gray-500 dark:text-gray-400 truncate">
											{{ emp.departmentName }} · {{ emp.positionName }}
										</p>
									</div>

									<!-- Join date -->
									<div class="flex-shrink-0 text-right">
										<p class="text-xs text-gray-400 dark:text-gray-500">Gia nhập</p>
										<p class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ formatJoinDate(emp.joinDate) }}</p>
									</div>
								</div>
							</div>

							<!-- Empty state -->
							<div v-else class="flex flex-col items-center justify-center py-14 text-gray-400">
								<svg class="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								<p class="text-sm">Không có nhân viên mới trong 30 ngày qua</p>
							</div>
						</div>

						<!-- Footer -->
						<div v-if="!loading && employees.length" class="px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
							<span class="text-xs text-gray-400">{{ employees.length }} nhân viên</span>
							<NuxtLink
								to="/management/employees?sort=joinDate"
								class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
								@click="emit('close')"
							>
								Xem trong danh sách →
							</NuxtLink>
						</div>
					</div>
				</Transition>
			</div>
		</Transition>
	</Teleport>
</template>
