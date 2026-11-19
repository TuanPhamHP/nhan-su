<script setup lang="ts">
	import { useEmployeeDocumentTypeService } from '~/services/employee-document-type.service';
	import DocumentTypeFormModal from '~/components/modules/settings/DocumentTypeFormModal.vue';
	import type { CreateEmployeeDocumentTypeDto, EmployeeDocumentType } from '~/types/hr-profile.types';

	/**
	 * Danh mục loại giấy tờ nhân viên (UI-06, lô 3a).
	 *
	 * Loại không xoá được, chỉ tắt: giấy tờ đã tải lên vẫn phải giữ đúng loại của nó. Loại đã
	 * tắt không còn hiện trong form tải tài liệu nhưng vẫn nằm trong danh sách này để bật lại.
	 */
	definePageMeta({ title: 'Loại giấy tờ' });

	const toast = useToast();
	const service = useEmployeeDocumentTypeService();
	const { hasPermission } = usePermissions();

	const canManage = computed(() => hasPermission('employee:document-type:manage'));

	const types = ref<EmployeeDocumentType[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const submitting = ref(false);
	const showForm = ref(false);
	const formTarget = ref<EmployeeDocumentType | null>(null);
	const togglingId = ref<number | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			// Người quản lý danh mục cần thấy cả loại đã tắt để bật lại được.
			types.value = await service.findAll(canManage.value);
		} catch (e) {
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được danh mục loại giấy tờ.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	const sortedTypes = computed(() =>
		types.value.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi')),
	);

	function openCreate() {
		formTarget.value = null;
		showForm.value = true;
	}

	function openEdit(type: EmployeeDocumentType) {
		formTarget.value = type;
		showForm.value = true;
	}

	function upsert(type: EmployeeDocumentType) {
		const idx = types.value.findIndex(t => t.id === type.id);
		if (idx === -1) types.value = [...types.value, type];
		else types.value.splice(idx, 1, type);
	}

	async function onSubmit(payload: CreateEmployeeDocumentTypeDto) {
		submitting.value = true;
		try {
			const target = formTarget.value;
			if (target) {
				// Loại mặc định của hệ thống không nhận mã mới, nên không gửi `code` cho nó.
				const { code, ...rest } = payload;
				upsert(await service.update(target.id, target.isSystem ? rest : { code, ...rest }));
				toast.success('Đã lưu loại giấy tờ.');
			} else {
				upsert(await service.create(payload));
				toast.success('Đã thêm loại giấy tờ mới.');
			}
			showForm.value = false;
		} catch (e) {
			// Giữ form mở: lỗi hay gặp là trùng mã, người dùng sửa mã rồi lưu lại.
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	async function toggleActive(type: EmployeeDocumentType) {
		togglingId.value = type.id;
		try {
			upsert(await service.update(type.id, { isActive: !type.isActive }));
			toast.success(type.isActive ? `Đã tắt loại ${type.name}.` : `Đã bật lại loại ${type.name}.`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa đổi được trạng thái loại giấy tờ.');
		} finally {
			togglingId.value = null;
		}
	}
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<NuxtLink
					to="/management/settings"
					class="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
					Cài đặt
				</NuxtLink>
				<UiPageHeader title="Loại giấy tờ" description="Danh mục này quyết định các loại giấy tờ mà phòng nhân sự chọn được khi tải tài liệu vào hồ sơ nhân viên." />
			</div>
			<CommonAppButton v-if="canManage" @click="openCreate">Thêm loại giấy tờ</CommonAppButton>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 4" :key="i" class="h-12 w-full animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
			</div>

			<div v-else-if="loadError" class="flex flex-wrap items-center justify-between gap-3 p-6">
				<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
			</div>

			<p v-else-if="!sortedTypes.length" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
				Chưa có loại giấy tờ nào trong danh mục.
			</p>

			<template v-else>
				<!-- Điện thoại: mỗi loại một dòng, bảng năm cột không vừa khung hẹp -->
				<ul class="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
					<li v-for="type in sortedTypes" :key="type.id" class="space-y-1 px-4 py-3">
						<div class="flex items-start justify-between gap-2">
							<p class="font-medium text-gray-900 dark:text-white">{{ type.name }}</p>
							<span
								v-if="!type.isActive"
								class="inline-flex flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
							>
								Đã tắt
							</span>
						</div>
						<p class="font-mono text-xs text-gray-400 dark:text-gray-500">{{ type.code }}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							{{ type.isSensitive ? 'Nhạy cảm' : 'Thường' }}
							· {{ type.validityMonths ? `${type.validityMonths} tháng` : 'Không thời hạn' }}
							· {{ type.employeeVisible ? 'Nhân viên thấy' : 'Chỉ nội bộ' }}
						</p>
						<div v-if="canManage" class="flex gap-1.5 pt-1">
							<button
								type="button"
								class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
								@click="openEdit(type)"
							>
								Sửa
							</button>
							<button
								type="button"
								class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
								:disabled="togglingId === type.id"
								@click="toggleActive(type)"
							>
								{{ type.isActive ? 'Tắt' : 'Bật lại' }}
							</button>
						</div>
					</li>
				</ul>

				<div class="hidden overflow-x-auto sm:block">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
									Tên loại
								</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
									Mã
								</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
									Thời hạn
								</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
									Tính chất
								</th>
								<th
									v-if="canManage"
									class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
								>
									Thao tác
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr
								v-for="type in sortedTypes"
								:key="type.id"
								class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
								:class="type.isActive ? '' : 'opacity-60'"
							>
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ type.name }}</p>
									<p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
										<template v-if="type.isSystem">Loại mặc định của hệ thống</template>
										<template v-else>Loại công ty tự thêm</template>
										<template v-if="!type.isActive"> · đã tắt</template>
									</p>
								</td>
								<td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{{ type.code }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
									{{ type.validityMonths ? `${type.validityMonths} tháng` : '—' }}
								</td>
								<td class="px-4 py-3">
									<div class="flex flex-wrap gap-1">
										<span
											v-if="type.isSensitive"
											class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
										>
											Nhạy cảm
										</span>
										<span
											v-if="!type.employeeVisible"
											class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
										>
											Chỉ nội bộ
										</span>
									</div>
								</td>
								<td v-if="canManage" class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<button
											type="button"
											class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
											@click="openEdit(type)"
										>
											Sửa
										</button>
										<button
											type="button"
											class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
											:disabled="togglingId === type.id"
											@click="toggleActive(type)"
										>
											{{ type.isActive ? 'Tắt' : 'Bật lại' }}
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</template>
		</div>

		<DocumentTypeFormModal
			v-if="showForm"
			:target="formTarget"
			:submitting="submitting"
			@submit="onSubmit"
			@close="showForm = false"
		/>
	</div>
</template>
