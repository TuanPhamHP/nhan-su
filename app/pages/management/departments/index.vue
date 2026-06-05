<script setup lang="ts">
	import type { DepartmentQueryParams } from '~/types/department.types';
	import type { DropdownMenuItem } from '~/components/ui/DropdownMenu.vue';
	import type { DepartmentSummary } from '~/types/department.types';

	definePageMeta({ title: 'Phòng ban' });

	const toast = useToast();
	const router = useRouter();
	const route = useRoute();

	const { departments, meta, loading, fetchList } = useDepartment();

	const searchInput = ref(String(route.query.search || ''));
	const search = ref(searchInput.value);
	const page = ref(Number(route.query.page) || 1);

	const queryParams = computed<DepartmentQueryParams>(() => ({
		search: search.value || undefined,
		page: page.value,
		limit: 20,
	}));

	watch(queryParams, params => {
		router.replace({
			query: {
				...(params.search ? { search: params.search } : {}),
				...(params.page && params.page > 1 ? { page: String(params.page) } : {}),
			},
		});
	});

	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(val: string) {
		searchInput.value = val;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			search.value = val;
			page.value = 1;
		}, 400);
	}

	async function load() {
		try {
			await fetchList(queryParams.value);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách phòng ban');
		}
	}

	watch(queryParams, load, { immediate: true });

	function getActions(dept: DepartmentSummary): DropdownMenuItem[] {
		return [
			{
				label: 'Chi tiết',
				icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
				action: () => router.push(`/management/departments/${dept.id}`),
			},
			{
				label: 'Chỉnh sửa',
				icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
				action: () => router.push(`/management/departments/${dept.id}?edit=true`),
			},
		];
	}
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Phòng ban</h1>
				<p v-if="meta" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tổng {{ meta.total }} phòng ban</p>
			</div>
			<NuxtLink to="/management/departments/new">
				<CommonAppButton>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
					Thêm phòng ban
				</CommonAppButton>
			</NuxtLink>
		</div>

		<!-- Search -->
		<div class="flex flex-col sm:flex-row gap-3">
			<div class="flex-1 max-w-sm">
				<CommonAppInput
					:model-value="searchInput"
					placeholder="Tìm theo tên phòng ban..."
					@update:model-value="onSearchInput"
				/>
			</div>
		</div>

		<!-- Table card -->
		<div
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
		>
			<!-- Loading skeleton -->
			<div v-if="loading" class="divide-y divide-gray-100 dark:divide-gray-800">
				<div v-for="i in 6" :key="i" class="flex items-center gap-4 px-6 py-4">
					<div class="flex flex-col gap-1.5 flex-1">
						<div class="h-3.5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					</div>
					<div class="h-3.5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
					<div class="h-7 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse ml-auto" />
				</div>
			</div>

			<!-- Empty state -->
			<div v-else-if="!departments.length" class="flex flex-col items-center justify-center py-16 text-center">
				<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
					<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
						/>
					</svg>
				</div>
				<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Không có phòng ban nào</p>
				<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
					Thử thay đổi từ khóa tìm kiếm hoặc thêm phòng ban mới
				</p>
			</div>

			<!-- Table -->
			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th
								class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Tên phòng ban
							</th>
							<th
								class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Số nhân viên
							</th>
							<th
								class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Trạng thái
							</th>
							<th
								class="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Hành động
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
						<tr
							v-for="dept in departments"
							:key="dept.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
						>
							<td
								class="px-6 py-4 font-medium text-gray-900 dark:text-white cursor-pointer hover:underline"
								@click="router.push(`/management/departments/${dept.id}`)"
							>
								{{ dept.name }}
							</td>
							<td class="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{{ dept.employeeCount }} nhân viên
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span
									:class="[
										'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
										dept.isActive
											? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
											: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
									]"
								>
									<span
										:class="[
											'w-1.5 h-1.5 rounded-full',
											dept.isActive ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400',
										]"
									/>
									{{ dept.isActive ? 'Hoạt động' : 'Vô hiệu' }}
								</span>
							</td>
							<td class="px-6 py-4 text-right">
								<UiDropdownMenu :items="getActions(dept)" />
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		<div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Trang {{ meta.page }} / {{ meta.totalPages }} &middot; {{ meta.total }} kết quả
			</p>
			<CommonAppPagination :current-page="page" :total-pages="meta.totalPages" @update:current-page="p => (page = p)" />
		</div>
	</div>
</template>
