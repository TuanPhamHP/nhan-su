<script setup lang="ts">
	import OfficeDialog from '~/components/modules/office/OfficeDialog.vue';
	import { useInjectedSupplyCatalog } from '~/composables/useSupplyCatalog';

	/** Thêm hoặc sửa một nhóm văn phòng phẩm; trường và API giữ nguyên như form cũ. */
	const { editingGroup, savingGroup, groupNameError, groupForm, saveGroup, showGroupForm } = useInjectedSupplyCatalog();

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<OfficeDialog
		:title="editingGroup ? `Sửa nhóm ${editingGroup.name}` : 'Thêm nhóm'"
		:busy="savingGroup"
		width="lg"
		@close="showGroupForm = false"
	>
		<form id="supply-group-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="saveGroup">
			<div class="space-y-1">
				<label for="supply-group-name" :class="labelCls">Tên nhóm <span class="text-red-500">*</span></label>
				<input
					id="supply-group-name"
					v-model="groupForm.name"
					type="text"
					maxlength="200"
					:class="inputCls"
					:aria-invalid="groupNameError ? 'true' : undefined"
					:aria-describedby="groupNameError ? 'supply-group-name-error' : undefined"
					placeholder="VD: Đồ uống"
				/>
				<p v-if="groupNameError" id="supply-group-name-error" role="alert" class="text-xs text-red-500">{{ groupNameError }}</p>
			</div>
			<div class="space-y-1">
				<span :class="labelCls">Thứ tự hiện</span>
				<UiNumberInput v-model="groupForm.sortOrder" :min="0" :input-class="inputCls" placeholder="Bỏ trống thì xếp cuối" />
			</div>
			<label class="flex items-center gap-2">
				<input v-model="groupForm.hrOnly" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
				<span class="text-sm text-gray-700 dark:text-gray-300">Chỉ HCNS đặt</span>
			</label>
			<label v-if="editingGroup" class="flex items-center gap-2">
				<input v-model="groupForm.isActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
				<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
			</label>
		</form>
		<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
			Nhóm chỉ HCNS đặt không hiện trong ô chọn của nhân viên phòng ban, chỉ HCNS thêm được khi làm phiếu bổ sung.
		</p>
		<template #actions>
			<CommonAppButton variant="secondary" :disabled="savingGroup" @click="showGroupForm = false">Đóng</CommonAppButton>
			<CommonAppButton
				variant="primary"
				type="submit"
				form="supply-group-form"
				:disabled="!groupForm.name.trim()"
				:loading="savingGroup"
			>
				Lưu
			</CommonAppButton>
		</template>
	</OfficeDialog>
</template>
