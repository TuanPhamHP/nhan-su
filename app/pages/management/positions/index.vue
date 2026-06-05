<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import type { SelectOption } from '~/components/ui/Select.vue';
	import type { CreatePositionDto, UpdatePositionDto, PositionSummary } from '~/types/position.types';

	definePageMeta({ title: 'Chức vụ' });

	const toast = useToast();
	const authStore = useAuthStore();

	const isHRorAdmin = computed(() => authStore.user?.role === 'HR' || authStore.user?.role === 'ADMIN');
	const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

	const { positions, meta, loading, fetchList, create, update, deactivate } = usePositions();
	const { departments, fetchAll: fetchDepartments } = useDepartment();

	// ─── Filter ────────────────────────────────────────────────────────────────
	const searchInput = ref('');
	const filterDepartmentId = ref<number | undefined>(undefined);
	const filterActive = ref<boolean | undefined>(undefined);
	const page = ref(1);

	const queryParams = computed(() => ({
		search: searchInput.value || undefined,
		departmentId: filterDepartmentId.value,
		isActive: filterActive.value,
		page: page.value,
		limit: 20,
	}));

	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(val: string) {
		searchInput.value = val;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			page.value = 1;
			load();
		}, 400);
	}

	function applyFilter() {
		page.value = 1;
		load();
	}

	async function load() {
		try {
			await fetchList(queryParams.value);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách chức vụ');
		}
	}

	const departmentOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id, label: d.name })),
	]);

	const activeFilterOptions = [
		{ value: undefined, label: 'Tất cả' },
		{ value: true, label: 'Đang hoạt động' },
		{ value: false, label: 'Đã vô hiệu' },
	] as { value: boolean | undefined; label: string }[];

	// ═══════════════════════════════════════════════════════════════════════════
	// Modal tạo / chỉnh sửa
	// ═══════════════════════════════════════════════════════════════════════════
	const showModal = ref(false);
	const editTarget = ref<PositionSummary | null>(null);
	const modalTitle = computed(() => (editTarget.value ? 'Chỉnh sửa chức vụ' : 'Thêm chức vụ'));

	const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm<{
		name: string;
		departmentId: number | undefined;
	}>({
		validationSchema: {
			name: (v: string) => (v && v.trim().length >= 2 ? true : 'Tối thiểu 2 ký tự'),
			departmentId: (v: unknown) => (v ? true : 'Vui lòng chọn phòng ban'),
		},
	});

	const [name, nameAttrs] = defineField('name');
	const [departmentId] = defineField('departmentId');

	function openCreate() {
		editTarget.value = null;
		resetForm({ values: { name: '', departmentId: undefined } });
		showModal.value = true;
	}

	function openEdit(pos: PositionSummary) {
		editTarget.value = pos;
		const deptMatch = departments.value.find(d => d.name === pos.department);
		resetForm({ values: { name: pos.name, departmentId: deptMatch?.id } });
		showModal.value = true;
	}

	function closeModal() {
		showModal.value = false;
	}

	const onSubmit = handleSubmit(async values => {
		try {
			if (editTarget.value) {
				const dto: UpdatePositionDto = {};
				if (values.name !== editTarget.value.name) dto.name = values.name;
				const deptMatch = departments.value.find(d => d.name === editTarget.value!.department);
				if (values.departmentId !== deptMatch?.id) dto.departmentId = Number(values.departmentId);
				await update(editTarget.value.id, dto);
				toast.success('Đã cập nhật chức vụ');
			} else {
				const dto: CreatePositionDto = {
					name: values.name,
					departmentId: Number(values.departmentId),
				};
				const created = await create(dto);
				positions.value.unshift({
					id: created.id,
					name: created.name,
					department: created.department.name,
					isActive: created.isActive,
					employeeCount: created.employeeCount,
				});
				toast.success('Đã thêm chức vụ mới');
			}
			closeModal();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		}
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// Deactivate
	// ═══════════════════════════════════════════════════════════════════════════
	const deactivateTarget = ref<PositionSummary | null>(null);
	const deactivating = ref(false);

	function openDeactivate(pos: PositionSummary) {
		deactivateTarget.value = pos;
	}

	async function confirmDeactivate() {
		if (!deactivateTarget.value) return;
		deactivating.value = true;
		try {
			await deactivate(deactivateTarget.value.id);
			toast.success('Đã vô hiệu hóa chức vụ');
			deactivateTarget.value = null;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi vô hiệu hóa');
		} finally {
			deactivating.value = false;
		}
	}

	// ─── Lifecycle ─────────────────────────────────────────────────────────────
	onMounted(() => {
		fetchDepartments();
		load();
	});

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Chức vụ</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Quản lý danh sách chức vụ theo phòng ban</p>
			</div>
			<CommonAppButton v-if="isHRorAdmin" @click="openCreate">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Thêm chức vụ
			</CommonAppButton>
		</div>

		<!-- Filter bar -->
		<div class="flex flex-col sm:flex-row flex-wrap gap-3">
			<div class="flex-1 min-w-[200px] max-w-xs">
				<input
					:value="searchInput"
					type="text"
					:class="inputCls"
					placeholder="Tìm tên chức vụ..."
					@input="onSearchInput(($event.target as HTMLInputElement).value)"
				/>
			</div>
			<div class="w-full sm:w-48">
				<UiSelect
					:model-value="filterDepartmentId"
					:options="departmentOptions"
					placeholder="Tất cả phòng ban"
					@update:model-value="
						filterDepartmentId = $event as number | undefined;
						applyFilter();
					"
				/>
			</div>
			<div class="flex gap-1">
				<button
					v-for="opt in activeFilterOptions"
					:key="String(opt.value)"
					class="px-3 py-2 text-sm rounded-lg border transition-colors"
					:class="
						filterActive === opt.value
							? 'bg-brand-600 text-white border-brand-600'
							: 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 bg-white dark:bg-gray-800'
					"
					@click="
						filterActive = opt.value;
						applyFilter();
					"
				>
					{{ opt.label }}
				</button>
			</div>
		</div>

		<!-- Table card -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th
								class="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Tên chức vụ
							</th>
							<th
								class="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Phòng ban
							</th>
							<th
								class="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Số nhân viên
							</th>
							<th
								class="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Trạng thái
							</th>
							<th
								class="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Thao tác
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<!-- Loading skeleton -->
						<template v-if="loading">
							<tr v-for="i in 8" :key="i">
								<td class="px-5 py-3.5">
									<div class="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
								</td>
								<td class="px-5 py-3.5">
									<div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
								</td>
								<td class="px-5 py-3.5 text-right">
									<div class="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
								</td>
								<td class="px-5 py-3.5">
									<div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
								</td>
								<td class="px-5 py-3.5" />
							</tr>
						</template>

						<!-- Empty -->
						<tr v-else-if="positions.length === 0">
							<td colspan="5" class="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
								Không có chức vụ nào
							</td>
						</tr>

						<!-- Rows -->
						<tr
							v-for="pos in positions"
							:key="pos.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
						>
							<td class="px-5 py-3.5">
								<span class="font-medium text-gray-900 dark:text-white">{{ pos.name }}</span>
							</td>
							<td class="px-5 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{{ pos.department }}
							</td>
							<td class="px-5 py-3.5 text-right">
								<span
									class="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold"
									:class="
										pos.employeeCount > 0
											? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
											: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
									"
								>
									{{ pos.employeeCount }}
								</span>
							</td>
							<td class="px-5 py-3.5">
								<span
									class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
									:class="
										pos.isActive
											? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
											: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
									"
								>
									{{ pos.isActive ? 'Hoạt động' : 'Vô hiệu' }}
								</span>
							</td>
							<td class="px-5 py-3.5 text-right">
								<div class="flex items-center justify-end gap-1">
									<button
										v-if="isHRorAdmin"
										class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
										title="Chỉnh sửa"
										@click="openEdit(pos)"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
											/>
										</svg>
									</button>
									<button
										v-if="isAdmin && pos.isActive"
										class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
										title="Vô hiệu hóa"
										@click="openDeactivate(pos)"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
											/>
										</svg>
									</button>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		<div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Trang {{ meta.page }}/{{ meta.totalPages }} &middot;
				<strong class="text-gray-700 dark:text-gray-300">{{ meta.total }}</strong> chức vụ
			</p>
			<CommonAppPagination
				:current-page="page"
				:total-pages="meta.totalPages"
				@update:current-page="
					p => {
						page = p;
						load();
					}
				"
			/>
		</div>
	</div>

	<!-- ═══════════════════ Modal tạo / chỉnh sửa ═══════════════════ -->
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
				v-if="showModal"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
				@click.self="closeModal"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-700"
				>
					<!-- Header -->
					<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
						<h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ modalTitle }}</h3>
						<button
							class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="closeModal"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Form -->
					<form class="p-6 space-y-4" @submit.prevent="onSubmit">
						<div>
							<label :class="labelCls">Tên chức vụ <span class="text-red-500">*</span></label>
							<input
								v-model="name"
								v-bind="nameAttrs"
								:class="[inputCls, errors.name ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="VD: Software Engineer"
								autofocus
							/>
							<p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
						</div>

						<div>
							<label :class="labelCls">Phòng ban <span class="text-red-500">*</span></label>
							<UiSelect v-model="departmentId" :options="departmentOptions" />
							<p v-if="errors.departmentId" class="mt-1 text-xs text-red-500">{{ errors.departmentId }}</p>
						</div>

						<div class="flex justify-end gap-3 pt-1">
							<CommonAppButton type="button" variant="outline" @click="closeModal">Hủy</CommonAppButton>
							<CommonAppButton type="submit" :loading="isSubmitting">
								{{ editTarget ? 'Lưu thay đổi' : 'Thêm chức vụ' }}
							</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Transition>

		<!-- ═══════════════════ Confirm deactivate ═══════════════════ -->
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="deactivateTarget"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
				@click.self="deactivateTarget = null"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-sm shadow-xl border border-gray-200 dark:border-gray-700 p-6"
				>
					<div class="flex items-start gap-4">
						<div
							class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0"
						>
							<svg
								class="w-5 h-5 text-red-600 dark:text-red-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
						</div>
						<div class="flex-1 min-w-0">
							<h3 class="font-semibold text-gray-900 dark:text-white">Vô hiệu hóa chức vụ</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
								Chức vụ
								<strong class="text-gray-700 dark:text-gray-300">{{ deactivateTarget.name }}</strong>
								sẽ không còn hiển thị trong dropdown tuyển chọn.
							</p>
							<div
								v-if="deactivateTarget.employeeCount > 0"
								class="mt-3 flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
							>
								<svg
									class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
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
								<p class="text-xs text-amber-700 dark:text-amber-400">
									Hiện có
									<strong>{{ deactivateTarget.employeeCount }}</strong> nhân viên đang giữ chức vụ này. Nhân viên sẽ không
									bị ảnh hưởng nhưng chức vụ sẽ không thể chọn cho nhân viên mới.
								</p>
							</div>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-6">
						<CommonAppButton variant="outline" @click="deactivateTarget = null">Hủy</CommonAppButton>
						<CommonAppButton variant="danger" :loading="deactivating" @click="confirmDeactivate">
							Xác nhận
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
