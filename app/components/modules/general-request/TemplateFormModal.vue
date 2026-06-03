<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { useGeneralRequestService } from '~/services/general-request.service';
import type { DocumentTemplateDetail, FieldDefinition, FieldType } from '~/types/general-request.types';

const props = defineProps<{ editTarget?: DocumentTemplateDetail }>();
const emit = defineEmits<{
	saved: [template: DocumentTemplateDetail];
	close: [];
}>();

const toast = useToast();
const service = useGeneralRequestService();

const categoryOptions = [
	{ value: 'PROPOSAL', label: 'Tờ trình BGĐ' },
	{ value: 'PURCHASE', label: 'Mua sắm' },
	{ value: 'REWARD', label: 'Khen thưởng' },
	{ value: 'OTHER', label: 'Khác' },
];

const fieldTypeOptions: { value: FieldType; label: string }[] = [
	{ value: 'text', label: 'Văn bản ngắn' },
	{ value: 'textarea', label: 'Văn bản dài' },
	{ value: 'date', label: 'Ngày tháng' },
	{ value: 'number', label: 'Số' },
	{ value: 'select', label: 'Chọn từ danh sách' },
	{ value: 'checkbox', label: 'Checkbox' },
];

const schema = toTypedSchema(z.object({
	name: z.string().min(3, 'Tên mẫu phải ít nhất 3 ký tự'),
	category: z.string().min(1, 'Vui lòng chọn danh mục'),
	description: z.string().optional(),
	printTemplate: z.string().min(1, 'HTML template không được để trống'),
}));

const { handleSubmit, defineField, errors, isSubmitting, setValues } = useForm({ validationSchema: schema });
const [name, nameAttrs] = defineField('name');
const [category, categoryAttrs] = defineField('category');
const [description, descriptionAttrs] = defineField('description');
const [printTemplate, printTemplateAttrs] = defineField('printTemplate');

const fields = ref<FieldDefinition[]>([]);
const activeTab = ref<'fields' | 'preview'>('fields');
const sampleData = computed(() => {
	const data: Record<string, string> = {};
	fields.value.forEach(f => { data[f.key] = f.placeholder || f.label; });
	return data;
});

const previewHtml = computed(() => {
	if (!printTemplate.value) return '';
	let html = printTemplate.value;
	for (const [key, val] of Object.entries(sampleData.value)) {
		html = html.replaceAll(`{{${key}}}`, `<span style="background:#fef9c3;padding:0 2px;">${val}</span>`);
	}
	return html;
});

onMounted(() => {
	if (props.editTarget) {
		setValues({
			name: props.editTarget.name,
			category: props.editTarget.category,
			description: props.editTarget.description ?? '',
			printTemplate: props.editTarget.printTemplate,
		});
		fields.value = [...props.editTarget.fields];
	}
});

function addField() {
	fields.value.push({
		key: `field_${Date.now()}`,
		label: 'Trường mới',
		type: 'text',
		required: false,
		placeholder: '',
		options: [],
	});
}

function removeField(idx: number) {
	fields.value.splice(idx, 1);
}

function moveUp(idx: number) {
	if (idx === 0) return;
	const tmp = fields.value[idx - 1]!;
	fields.value[idx - 1] = fields.value[idx]!;
	fields.value[idx] = tmp;
}

function moveDown(idx: number) {
	if (idx === fields.value.length - 1) return;
	const tmp = fields.value[idx]!;
	fields.value[idx] = fields.value[idx + 1]!;
	fields.value[idx + 1] = tmp;
}

const onSubmit = handleSubmit(async values => {
	try {
		const dto = { ...values, description: values.description ?? '', fields: fields.value };
		let saved: DocumentTemplateDetail;
		if (props.editTarget) {
			saved = await service.updateTemplate(props.editTarget.id, dto);
		} else {
			saved = await service.createTemplate(dto);
		}
		toast.success(props.editTarget ? 'Đã cập nhật mẫu' : 'Đã tạo mẫu mới');
		emit('saved', saved);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">
					{{ editTarget ? 'Sửa mẫu tờ trình' : 'Tạo mẫu tờ trình mới' }}
				</h2>
				<button class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" @click="emit('close')">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form class="flex-1 overflow-y-auto" @submit.prevent="onSubmit">
				<div class="p-6 space-y-5">
					<!-- Basic info -->
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<div class="sm:col-span-2 space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên mẫu <span class="text-red-500">*</span></label>
							<input v-model="name" v-bind="nameAttrs" type="text" placeholder="VD: Đề xuất mua sắm thiết bị" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							<p v-if="errors.name" class="text-xs text-red-500">{{ errors.name }}</p>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Danh mục <span class="text-red-500">*</span></label>
							<select v-model="category" v-bind="categoryAttrs" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors">
								<option value="">Chọn danh mục...</option>
								<option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
							</select>
							<p v-if="errors.category" class="text-xs text-red-500">{{ errors.category }}</p>
						</div>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mô tả</label>
						<input v-model="description" v-bind="descriptionAttrs" type="text" placeholder="Mô tả ngắn về mẫu tờ trình này..." class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
					</div>

					<!-- Fields builder -->
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Các trường nhập liệu</h3>
							<CommonAppButton size="sm" variant="secondary" type="button" @click="addField">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
								</svg>
								Thêm trường
							</CommonAppButton>
						</div>

						<div v-if="fields.length === 0" class="py-6 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
							Chưa có trường nào. Nhấn "Thêm trường" để bắt đầu.
						</div>

						<div v-for="(field, idx) in fields" :key="idx" class="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
							<div class="col-span-3 space-y-1">
								<label class="block text-xs text-gray-500">Key</label>
								<input v-model="field.key" type="text" placeholder="field_key" class="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500" />
							</div>
							<div class="col-span-3 space-y-1">
								<label class="block text-xs text-gray-500">Nhãn</label>
								<input v-model="field.label" type="text" placeholder="Tên trường" class="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500" />
							</div>
							<div class="col-span-2 space-y-1">
								<label class="block text-xs text-gray-500">Loại</label>
								<select v-model="field.type" class="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500">
									<option v-for="opt in fieldTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
								</select>
							</div>
							<div class="col-span-2 space-y-1">
								<label class="block text-xs text-gray-500">Placeholder</label>
								<input v-model="field.placeholder" type="text" class="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500" />
							</div>
							<div class="col-span-1 space-y-1 flex flex-col items-center">
								<label class="block text-xs text-gray-500">Bắt buộc</label>
								<input v-model="field.required" type="checkbox" class="mt-2 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							</div>
							<div class="col-span-1 flex flex-col gap-1 pt-5">
								<button type="button" class="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Lên" @click="moveUp(idx)">
									<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
								</button>
								<button type="button" class="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Xuống" @click="moveDown(idx)">
									<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
								</button>
								<button type="button" class="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Xóa" @click="removeField(idx)">
									<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
								</button>
							</div>
							<div v-if="field.type === 'select'" class="col-span-12 space-y-1">
								<label class="block text-xs text-gray-500">Options (mỗi dòng 1 giá trị)</label>
								<textarea
									:value="(field.options ?? []).join('\n')"
									rows="2"
									placeholder="Option 1&#10;Option 2&#10;Option 3"
									class="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
									@input="(e) => field.options = (e.target as HTMLTextAreaElement).value.split('\n').filter(Boolean)"
								/>
							</div>
						</div>
					</div>

					<!-- Print template editor -->
					<div class="space-y-3">
						<div class="flex items-center gap-3">
							<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">HTML Template in</h3>
							<div class="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
								<button type="button" :class="['px-3 py-1 text-xs font-medium rounded-md transition-all', activeTab === 'fields' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400']" @click="activeTab = 'fields'">Chỉnh sửa</button>
								<button type="button" :class="['px-3 py-1 text-xs font-medium rounded-md transition-all', activeTab === 'preview' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400']" @click="activeTab = 'preview'">Preview</button>
							</div>
						</div>
						<p class="text-xs text-gray-400">Dùng <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{{key}}'}</code> để chèn giá trị từ form. VD: <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{{fullName}}'}</code></p>

						<template v-if="activeTab === 'fields'">
							<textarea
								v-model="printTemplate"
								v-bind="printTemplateAttrs"
								rows="12"
								placeholder="<div><h2>Đề xuất mua sắm</h2><p>Người yêu cầu: {{fullName}}</p></div>"
								class="w-full px-3 py-2 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-y"
							/>
							<p v-if="errors.printTemplate" class="text-xs text-red-500">{{ errors.printTemplate }}</p>
						</template>

						<template v-else>
							<div class="border border-gray-300 dark:border-gray-600 rounded-lg bg-white p-4 min-h-[200px] text-sm" v-html="previewHtml" />
							<p class="text-xs text-gray-400">Các placeholder được tô vàng với dữ liệu mẫu</p>
						</template>
					</div>
				</div>

				<div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
					<CommonAppButton variant="secondary" type="button" @click="emit('close')">Hủy</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting">{{ editTarget ? 'Lưu thay đổi' : 'Tạo mẫu' }}</CommonAppButton>
				</div>
			</form>
		</div>
	</div>
</template>
