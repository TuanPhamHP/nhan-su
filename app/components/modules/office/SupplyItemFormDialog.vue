<script setup lang="ts">
	import OfficeDialog from '~/components/modules/office/OfficeDialog.vue';
	import { useInjectedSupplyCatalog } from '~/composables/useSupplyCatalog';

	/**
	 * Thêm hoặc sửa một mặt hàng của danh mục. Trường, điều kiện bắt buộc và API giữ nguyên như form
	 * cũ; chỉ chuyển từ khối chèn giữa trang sang hộp thoại để mở form không đẩy danh sách xuống.
	 */
	const {
		groupOptions,
		unitSuggestions,
		editingItem,
		savingItem,
		itemNameError,
		itemForm,
		saveItem,
		showItemForm,
	} = useInjectedSupplyCatalog();

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<OfficeDialog
		:title="editingItem ? `Sửa mặt hàng ${editingItem.name}` : 'Thêm mặt hàng'"
		:busy="savingItem"
		width="lg"
		@close="showItemForm = false"
	>
		<form id="supply-item-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="saveItem">
			<div class="space-y-1">
				<span :class="labelCls">Nhóm <span class="text-red-500">*</span></span>
				<UiSelectInput
					:model-value="itemForm.groupId ?? null"
					:options="groupOptions"
					placeholder="Chọn nhóm"
					search-placeholder="Tìm nhóm"
					@update:model-value="itemForm.groupId = Number($event)"
				/>
			</div>
			<div class="space-y-1">
				<label for="supply-item-name" :class="labelCls">Tên mặt hàng <span class="text-red-500">*</span></label>
				<input
					id="supply-item-name"
					v-model="itemForm.name"
					type="text"
					maxlength="255"
					:class="inputCls"
					:aria-invalid="itemNameError ? 'true' : undefined"
					:aria-describedby="itemNameError ? 'supply-item-name-error' : undefined"
					placeholder="VD: Giấy in A4 IK Plus"
				/>
				<p v-if="itemNameError" id="supply-item-name-error" role="alert" class="text-xs text-red-500">{{ itemNameError }}</p>
			</div>
			<div class="space-y-1">
				<label for="supply-item-unit" :class="labelCls">Đơn vị tính <span class="text-red-500">*</span></label>
				<input
					id="supply-item-unit"
					v-model="itemForm.unit"
					type="text"
					maxlength="50"
					list="supply-unit-suggestions"
					:class="inputCls"
					placeholder="VD: Tập"
				/>
				<datalist id="supply-unit-suggestions">
					<option v-for="unit in unitSuggestions" :key="unit" :value="unit" />
				</datalist>
			</div>
			<div class="space-y-1">
				<span :class="labelCls">Đơn giá gồm VAT</span>
				<UiNumberInput v-model="itemForm.unitPrice" :min="0" :input-class="inputCls" placeholder="Bỏ trống nếu chưa có giá" />
				<!-- Máy chủ: kỳ còn mở đọc giá danh mục; khoá kỳ thì chụp giá lúc đó (`snapshotPeriodItems`). -->
				<p class="text-xs text-gray-500 dark:text-gray-400">Áp dụng cho kỳ đang mở và kỳ mở sau; kỳ đã khoá giữ giá lúc khoá.</p>
			</div>
			<div class="space-y-1">
				<span :class="labelCls">Thứ tự hiện</span>
				<UiNumberInput v-model="itemForm.sortOrder" :min="0" :input-class="inputCls" placeholder="Bỏ trống thì xếp cuối" />
			</div>
			<label v-if="editingItem" class="flex items-center gap-2 self-end pb-2">
				<input v-model="itemForm.isActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
				<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
			</label>
		</form>
		<template #actions>
			<CommonAppButton variant="secondary" :disabled="savingItem" @click="showItemForm = false">Đóng</CommonAppButton>
			<CommonAppButton
				variant="primary"
				type="submit"
				form="supply-item-form"
				:disabled="!itemForm.groupId || !itemForm.name.trim() || !itemForm.unit.trim()"
				:loading="savingItem"
			>
				Lưu
			</CommonAppButton>
		</template>
	</OfficeDialog>
</template>
