<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { storeToRefs } from 'pinia';
import EmployeePicker from '~/components/modules/general-request/EmployeePicker.vue';
import TemplateFieldsBuilder from '~/components/modules/general-request/TemplateFieldsBuilder.vue';
import { useGeneralRequestService } from '~/services/general-request.service';
import { cleanFields, fieldsError } from '~/utils/form-field-key';
import { buildPreviewHtml, PRINT_EXTRA_CSS, sanitizePrintTemplate } from '~/utils/print-template';
import type { DocumentTemplateDetail, FieldDefinition } from '~/types/general-request.types';

/**
 * Tạo và sửa một loại phiếu (UI-05, lô 4a).
 *
 * Ba thứ thêm ở lô 4a: tiền tố số hiệu (`codePrefix`, in hoa, một đến mười ký tự, cho ra số hiệu
 * dạng `TT-0012/2026`), bật tắt mẫu (`isActive`: tắt thì không tạo phiếu mới được, phiếu đang
 * chạy không ảnh hưởng), và người theo dõi mặc định (`defaultWatcherIds`, tự thành người theo
 * dõi của mọi phiếu theo mẫu này).
 *
 * Luồng duyệt KHÔNG nằm ở đây mà ở màn riêng, vì luồng có nhiều bước và điều kiện, nhồi vào hộp
 * thoại này thì vừa chật vừa dễ lưu nhầm hai thứ cùng lúc.
 */
const props = defineProps<{ editTarget?: DocumentTemplateDetail }>();
const emit = defineEmits<{
	saved: [template: DocumentTemplateDetail];
	close: [];
}>();

const toast = useToast();
const service = useGeneralRequestService();

const categoryOptions = [
	{ value: 'PROPOSAL', label: 'Tờ trình' },
	{ value: 'PURCHASE', label: 'Mua sắm' },
	{ value: 'REWARD', label: 'Khen thưởng' },
	{ value: 'OTHER', label: 'Khác' },
];

const schema = toTypedSchema(z.object({
	name: z.string().min(3, 'Tên mẫu phải ít nhất 3 ký tự'),
	category: z.string().min(1, 'Vui lòng chọn danh mục'),
	description: z.string().optional(),
	printTemplate: z.string().min(1, 'HTML template không được để trống'),
	// Máy chủ chỉ nhận chữ in hoa và số: gõ chữ thường thì báo ngay tại ô thay vì chờ 400.
	codePrefix: z
		.string()
		.regex(/^[A-Z0-9]{1,10}$/, 'Tiền tố gồm 1 đến 10 chữ in hoa hoặc số, VD TT'),
}));

const { handleSubmit, defineField, errors, isSubmitting, setValues } = useForm({ validationSchema: schema });
const [name, nameAttrs] = defineField('name');
const [category, categoryAttrs] = defineField('category');
const [description, descriptionAttrs] = defineField('description');
const [printTemplate, printTemplateAttrs] = defineField('printTemplate');
const [codePrefix, codePrefixAttrs] = defineField('codePrefix');

const fields = ref<FieldDefinition[]>([]);
const isActive = ref(true);
const defaultWatcherIds = ref<number[]>([]);
const activeTab = ref<'fields' | 'preview'>('fields');

const directoryStore = useDirectoryStore();
const { employees: directoryEmployees } = storeToRefs(directoryStore);
const watcherChoices = computed(() =>
	directoryEmployees.value.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode })),
);

const sampleData = computed(() => {
	const data: Record<string, string> = {};
	fields.value.forEach(f => { data[f.key] = f.placeholder || f.label; });
	return data;
});

/**
 * Bản xem trước mẫu in, dựng trong iframe sandbox.
 *
 * Hai lớp bảo vệ: giá trị mẫu được escape trong `buildPreviewHtml`, và chính HTML của mẫu được
 * lọc bỏ thẻ chạy mã rồi hiện trong iframe không có `allow-scripts`. Trước đây chỗ này dùng
 * `v-html`, nên một mẫu chứa `<img src=x onerror=…>` sẽ chạy mã ngay trong phiên của người đang
 * soạn mẫu, và mẫu do người khác soạn cũng chạy khi người này mở ra xem.
 */
const previewHtml = computed(() => (printTemplate.value ? buildPreviewHtml(printTemplate.value, sampleData.value) : ''));

const previewSrcdoc = computed(() => {
	if (!previewHtml.value) return '';
	const safe = sanitizePrintTemplate(previewHtml.value);
	return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><style>html,body{margin:0;padding:16px;font-family:'Times New Roman',serif;font-size:14px;line-height:1.6;color:#111}*{box-sizing:border-box}${PRINT_EXTRA_CSS}</style></head><body>${safe}</body></html>`;
});

onMounted(() => {
	if (props.editTarget) {
		setValues({
			name: props.editTarget.name,
			category: props.editTarget.category,
			description: props.editTarget.description ?? '',
			printTemplate: props.editTarget.printTemplate,
			codePrefix: props.editTarget.codePrefix,
		});
		fields.value = [...props.editTarget.fields];
		isActive.value = props.editTarget.isActive;
		defaultWatcherIds.value = [...props.editTarget.defaultWatcherIds];
	}
	directoryStore.load().catch(() => {
		// Không có danh bạ thì chỉ mất ô chọn người theo dõi mặc định, phần còn lại vẫn lưu được.
	});
});

const onSubmit = handleSubmit(async values => {
	const problem = fieldsError(fields.value);
	if (problem) {
		toast.error(problem);
		return;
	}
	try {
		const dto = {
			...values,
			description: values.description ?? '',
			fields: cleanFields(fields.value),
			isActive: isActive.value,
			defaultWatcherIds: defaultWatcherIds.value,
		};
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
					{{ editTarget ? 'Sửa loại phiếu' : 'Tạo loại phiếu mới' }}
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
						<input v-model="description" v-bind="descriptionAttrs" type="text" placeholder="Mô tả ngắn về loại phiếu này..." class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
					</div>

					<!-- Lô 4a: tiền tố số hiệu, bật tắt mẫu, người theo dõi mặc định -->
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Tiền tố số hiệu <span class="text-red-500">*</span>
							</label>
							<input
								v-model="codePrefix"
								v-bind="codePrefixAttrs"
								type="text"
								maxlength="10"
								placeholder="TT"
								class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
							/>
							<p v-if="errors.codePrefix" class="text-xs text-red-500">{{ errors.codePrefix }}</p>
							<p v-else class="text-xs text-gray-400">Số hiệu phiếu sẽ có dạng {{ (codePrefix || 'TT') + '-0012/2026' }}</p>
						</div>
						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Trạng thái mẫu</label>
							<label class="flex cursor-pointer items-center gap-2 pt-1.5">
								<input v-model="isActive" type="checkbox" class="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
								<span class="text-sm text-gray-600 dark:text-gray-400">
									Đang dùng, cho phép tạo phiếu mới theo mẫu này
								</span>
							</label>
							<p class="text-xs text-gray-400">
								Tắt mẫu thì không ai tạo phiếu mới được nữa, còn phiếu đang chạy vẫn duyệt bình thường.
							</p>
						</div>
					</div>

					<div class="space-y-1">
						<EmployeePicker
							v-model="defaultWatcherIds"
							:people="watcherChoices"
							label="Người theo dõi mặc định"
							hint="Những người này tự thành người theo dõi của mọi phiếu gửi theo mẫu này."
						/>
					</div>

					<TemplateFieldsBuilder v-model="fields" />

					<!-- Print template editor -->
					<div class="space-y-3">
						<div class="flex items-center gap-3">
							<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">HTML Template in</h3>
							<div class="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
								<button type="button" :class="['px-3 py-1 text-xs font-medium rounded-md transition-all', activeTab === 'fields' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400']" @click="activeTab = 'fields'">Chỉnh sửa</button>
								<button type="button" :class="['px-3 py-1 text-xs font-medium rounded-md transition-all', activeTab === 'preview' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400']" @click="activeTab = 'preview'">Preview</button>
							</div>
						</div>
						<p class="text-xs text-gray-400">
							Chèn câu trả lời bằng mã của câu hỏi, VD
							<code class="rounded bg-gray-100 px-1 dark:bg-gray-800" v-text="'{{fullName}}'" />. Chép mã ở chân thẻ câu hỏi đang sửa.
						</p>

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
							<!-- sandbox không có allow-scripts: mã trong mẫu không chạy được bằng phiên người soạn. -->
							<iframe
								:srcdoc="previewSrcdoc"
								sandbox="allow-same-origin"
								title="Xem trước mẫu in"
								class="block min-h-[240px] w-full rounded-lg border border-gray-300 bg-white dark:border-gray-600"
							/>
							<p class="text-xs text-gray-400">
								Chỗ ghép giá trị được tô vàng với dữ liệu mẫu. Mã trong mẫu không chạy ở đây và cũng không chạy khi in.
							</p>
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
