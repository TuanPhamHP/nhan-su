<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import { ASSET_KIND_LABELS, type AssetCategory, type AssetKind } from '~/types/asset.types';

	definePageMeta({ title: 'Cài đặt tài sản' });

	const toast = useToast();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();

	/** Trang này đã được `permission-guard` gác bằng `asset:manage`; chỉ còn kiểm module. */
	const canEdit = computed(() => canWrite('ASSET'));

	const categories = ref<AssetCategory[]>([]);
	const loading = ref(true);
	const showInactive = ref(false);

	const showForm = ref(false);
	const editing = ref<AssetCategory | null>(null);
	const saving = ref(false);
	const form = reactive({
		name: '',
		groupName: '',
		kind: 'PHYSICAL' as AssetKind,
		defaultDepreciationMonths: '',
		requireSerial: false,
		isActive: true,
	});

	async function load() {
		loading.value = true;
		try {
			categories.value = await service.findCategories(
				showInactive.value ? undefined : { isActive: true },
			);
		} catch (e) {
			categories.value = [];
			toast.error(e instanceof Error ? e.message : 'Không tải được loại tài sản');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(showInactive, load);

	/** Hiển thị Nhóm → Loại: gom theo `groupName`, giữ nguyên thứ tự BE trả về. */
	const grouped = computed(() => {
		const map = new Map<string, AssetCategory[]>();
		for (const c of categories.value) {
			const list = map.get(c.groupName) ?? [];
			list.push(c);
			map.set(c.groupName, list);
		}
		return [...map.entries()].map(([groupName, items]) => ({ groupName, items }));
	});

	const existingGroups = computed(() => [...new Set(categories.value.map(c => c.groupName))]);

	function openCreate() {
		editing.value = null;
		Object.assign(form, {
			name: '',
			groupName: '',
			kind: 'PHYSICAL' as AssetKind,
			defaultDepreciationMonths: '',
			requireSerial: false,
			isActive: true,
		});
		showForm.value = true;
	}

	function openEdit(c: AssetCategory) {
		editing.value = c;
		Object.assign(form, {
			name: c.name,
			groupName: c.groupName,
			kind: c.kind,
			defaultDepreciationMonths:
				c.defaultDepreciationMonths != null ? String(c.defaultDepreciationMonths) : '',
			requireSerial: c.requireSerial,
			isActive: c.isActive,
		});
		showForm.value = true;
	}

	async function save() {
		if (!form.name.trim() || !form.groupName.trim() || saving.value) return;
		saving.value = true;
		try {
			const months = form.defaultDepreciationMonths ? Number(form.defaultDepreciationMonths) : undefined;
			if (editing.value) {
				// `kind` không đổi được khi loại đã có tài sản (BE trả 409), nên không gửi lại.
				await service.updateCategory(editing.value.id, {
					name: form.name.trim(),
					groupName: form.groupName.trim(),
					defaultDepreciationMonths: months,
					requireSerial: form.requireSerial,
					isActive: form.isActive,
				});
			} else {
				await service.createCategory({
					name: form.name.trim(),
					groupName: form.groupName.trim(),
					kind: form.kind,
					defaultDepreciationMonths: months,
					requireSerial: form.requireSerial,
					isActive: form.isActive,
				});
			}
			toast.success(editing.value ? 'Đã lưu loại tài sản' : 'Đã thêm loại tài sản');
			showForm.value = false;
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lưu loại tài sản thất bại');
		} finally {
			saving.value = false;
		}
	}

	const kindOptions = Object.entries(ASSET_KIND_LABELS).map(([value, label]) => ({ value, label }));
	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Cài đặt tài sản</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Loại tài sản, xếp theo Nhóm → Loại. Mã tài sản sinh theo mã công ty, không cấu hình ở đây.
				</p>
			</div>
			<CommonAppButton v-if="canEdit" variant="primary" @click="openCreate">Thêm loại</CommonAppButton>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
			<input v-model="showInactive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
			Hiện cả loại đã ngừng dùng
		</label>

		<!-- Form thêm / sửa -->
		<div v-if="showForm" class="rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-gray-900">
			<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
				{{ editing ? `Sửa loại ${editing.name}` : 'Thêm loại tài sản' }}
			</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-1">
					<label :class="labelCls">Nhóm <span class="text-red-500">*</span></label>
					<input v-model="form.groupName" type="text" list="asset-groups" :class="inputCls" placeholder="VD: Máy tính" />
					<datalist id="asset-groups">
						<option v-for="g in existingGroups" :key="g" :value="g" />
					</datalist>
				</div>
				<div class="space-y-1">
					<label :class="labelCls">Loại <span class="text-red-500">*</span></label>
					<input v-model="form.name" type="text" :class="inputCls" placeholder="VD: Laptop" />
				</div>
				<div class="space-y-1">
					<label :class="labelCls">Họ tài sản</label>
					<UiSelect v-if="!editing" v-model="form.kind" :options="kindOptions" />
					<p v-else class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
						{{ ASSET_KIND_LABELS[form.kind] }} — không đổi được sau khi tạo
					</p>
				</div>
				<div class="space-y-1">
					<label :class="labelCls">Số tháng khấu hao mặc định</label>
					<input v-model="form.defaultDepreciationMonths" type="number" min="0" :class="inputCls" placeholder="Bỏ trống nếu loại này không khấu hao" />
				</div>
				<label class="flex items-center gap-2">
					<input v-model="form.requireSerial" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
					<span class="text-sm text-gray-700 dark:text-gray-300">Bắt buộc nhập số serial</span>
				</label>
				<label class="flex items-center gap-2">
					<input v-model="form.isActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
					<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
				</label>
			</div>
			<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
				Không xoá được loại — bỏ dấu "Đang dùng" để ngừng chọn trong các form mới.
			</p>
			<div class="mt-4 flex justify-end gap-3">
				<CommonAppButton variant="secondary" @click="showForm = false">Huỷ</CommonAppButton>
				<CommonAppButton
					variant="primary"
					:disabled="!form.name.trim() || !form.groupName.trim()"
					:loading="saving"
					@click="save"
				>
					Lưu
				</CommonAppButton>
			</div>
		</div>

		<!-- Danh sách theo nhóm -->
		<div v-if="loading" class="space-y-3">
			<div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<p
			v-else-if="!grouped.length"
			class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
		>
			Chưa có loại tài sản nào.
		</p>

		<div v-else class="space-y-4">
			<section
				v-for="group in grouped"
				:key="group.groupName"
				class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
					{{ group.groupName }}
					<span class="ml-1 text-xs font-normal text-gray-400">{{ group.items.length }} loại</span>
				</h3>
				<table class="w-full text-sm">
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="c in group.items" :key="c.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/40">
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ c.name }}</p>
								<p class="text-xs text-gray-400">{{ c.kindLabel }}</p>
							</td>
							<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
								{{ c.defaultDepreciationMonths != null ? `Khấu hao ${c.defaultDepreciationMonths} tháng` : 'Không khấu hao' }}
							</td>
							<td class="px-4 py-3">
								<span v-if="c.requireSerial" class="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
									Bắt buộc serial
								</span>
							</td>
							<td class="px-4 py-3">
								<span
									v-if="!c.isActive"
									class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
								>
									Ngừng dùng
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								<CommonAppButton v-if="canEdit" size="sm" variant="outline" @click="openEdit(c)">Sửa</CommonAppButton>
							</td>
						</tr>
					</tbody>
				</table>
			</section>
		</div>
	</div>
</template>
