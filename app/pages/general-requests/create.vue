<script setup lang="ts">
import { useGeneralRequestService } from '~/services/general-request.service';
import { useEmployeeService } from '~/services/employee.service';
import type { DocumentTemplateDetail, FieldDefinition, SuggestedApprover } from '~/types/general-request.types';

definePageMeta({ title: 'Tạo văn bản nội bộ' });

const toast = useToast();
const router = useRouter();
const service = useGeneralRequestService();
const employeeService = useEmployeeService();

// ─── Steps ────────────────────────────────────────────────────────────────────
const step = ref<1 | 2 | 3>(1);

// ─── Step 1: Template selection ───────────────────────────────────────────────
const templates = ref<DocumentTemplateDetail[]>([]);
const templatesLoading = ref(false);
const selectedTemplate = ref<DocumentTemplateDetail | null>(null);

const categoryLabels: Record<string, string> = {
	PROPOSAL: 'Tờ trình BGĐ',
	PURCHASE: 'Mua sắm',
	REWARD: 'Khen thưởng',
	OTHER: 'Khác',
};

const categoryColors: Record<string, string> = {
	PROPOSAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
	PURCHASE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
	REWARD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
	OTHER: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const groupedTemplates = computed(() => {
	const groups: Record<string, DocumentTemplateDetail[]> = {};
	templates.value.forEach(t => {
		if (!groups[t.category]) groups[t.category] = [];
		groups[t.category].push(t);
	});
	return groups;
});

async function loadTemplates() {
	templatesLoading.value = true;
	try {
		templates.value = await service.findTemplates({ isActive: true });
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải mẫu văn bản');
	} finally {
		templatesLoading.value = false;
	}
}

async function selectTemplate(t: DocumentTemplateDetail) {
	try {
		selectedTemplate.value = await service.findTemplate(t.id);
		initFieldValues();
		step.value = 2;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải chi tiết mẫu');
	}
}

// ─── Step 2: Dynamic form ─────────────────────────────────────────────────────
const title = ref('');
const fieldValues = reactive<Record<string, unknown>>({});
const fieldErrors = reactive<Record<string, string>>({});

// Auto-save draft debounce
let draftId: number | null = null;
let draftDebounce: ReturnType<typeof setTimeout> | null = null;

function initFieldValues() {
	if (!selectedTemplate.value) return;
	selectedTemplate.value.fields.forEach(f => {
		fieldValues[f.key] = f.defaultValue ?? '';
	});
}

function onFieldChange() {
	if (!draftId) return;
	if (draftDebounce) clearTimeout(draftDebounce);
	draftDebounce = setTimeout(() => autoSaveDraft(), 3000);
}

async function autoSaveDraft() {
	if (!draftId) return;
	try {
		await service.saveDraft(draftId, { fieldValues: { ...fieldValues } });
	} catch { /* silent */ }
}

function validateStep2(): boolean {
	let valid = true;
	Object.keys(fieldErrors).forEach(k => delete fieldErrors[k]);

	if (!title.value.trim() || title.value.trim().length < 3) {
		fieldErrors['__title'] = 'Tiêu đề phải ít nhất 3 ký tự';
		valid = false;
	}

	selectedTemplate.value?.fields.forEach(f => {
		if (f.required && !fieldValues[f.key]) {
			fieldErrors[f.key] = `${f.label} là bắt buộc`;
			valid = false;
		}
	});
	return valid;
}

async function goToStep3() {
	if (!validateStep2()) return;

	// Create draft if not yet
	if (!draftId) {
		try {
			const created = await service.create({
				templateId: selectedTemplate.value!.id,
				title: title.value,
				fieldValues: { ...fieldValues },
			});
			draftId = created.id;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tạo nháp');
			return;
		}
	} else {
		await autoSaveDraft();
	}
	step.value = 3;
}

// ─── Step 3: Approvers ────────────────────────────────────────────────────────
const suggestedApprovers = ref<SuggestedApprover[]>([]);
const selectedApprovers = ref<{ employeeId: number; fullName: string; role?: string }[]>([]);
const approverSearch = ref('');
const showApproverDropdown = ref(false);
const allEmployees = ref<{ id: number; fullName: string; employeeCode: string }[]>([]);

const filteredEmployees = computed(() =>
	allEmployees.value.filter(e =>
		!selectedApprovers.value.some(a => a.employeeId === e.id) &&
		(e.fullName.toLowerCase().includes(approverSearch.value.toLowerCase()) ||
			e.employeeCode.toLowerCase().includes(approverSearch.value.toLowerCase())),
	).slice(0, 10),
);

async function loadSuggestedApprovers() {
	try {
		const res = await service.findSuggestedApprovers();
		suggestedApprovers.value = res;
		selectedApprovers.value = res.map(a => ({ employeeId: a.employeeId, fullName: a.fullName, role: a.role }));
	} catch { /* non-critical */ }
}

async function loadAllEmployees() {
	try {
		const res = await employeeService.findAll({ status: 'ACTIVE', limit: 200 });
		allEmployees.value = res.data.map(e => ({ id: e.id, fullName: e.fullName, employeeCode: e.employeeCode }));
	} catch { /* non-critical */ }
}

function addApprover(emp: { id: number; fullName: string }) {
	if (selectedApprovers.value.some(a => a.employeeId === emp.id)) return;
	selectedApprovers.value.push({ employeeId: emp.id, fullName: emp.fullName });
	approverSearch.value = '';
	showApproverDropdown.value = false;
}

function removeApprover(idx: number) {
	selectedApprovers.value.splice(idx, 1);
}

function moveApproverUp(idx: number) {
	if (idx === 0) return;
	const tmp = selectedApprovers.value[idx - 1]!;
	selectedApprovers.value[idx - 1] = selectedApprovers.value[idx]!;
	selectedApprovers.value[idx] = tmp;
}

function moveApproverDown(idx: number) {
	if (idx === selectedApprovers.value.length - 1) return;
	const tmp = selectedApprovers.value[idx]!;
	selectedApprovers.value[idx] = selectedApprovers.value[idx + 1]!;
	selectedApprovers.value[idx + 1] = tmp;
}

// ─── Final submit ─────────────────────────────────────────────────────────────
const submitting = ref(false);

async function handleSubmit() {
	if (selectedApprovers.value.length === 0) {
		toast.error('Vui lòng chọn ít nhất 1 người duyệt');
		return;
	}
	if (!draftId) {
		toast.error('Chưa tạo nháp, vui lòng quay lại bước 2');
		return;
	}
	submitting.value = true;
	try {
		await service.submit(draftId, {
			approvers: selectedApprovers.value.map(a => ({ employeeId: a.employeeId })),
		});
		toast.success('Đã gửi văn bản để duyệt');
		router.push('/general-requests');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		submitting.value = false;
	}
}

async function saveDraftAndExit() {
	if (!draftId && title.value.trim() && selectedTemplate.value) {
		try {
			await service.create({
				templateId: selectedTemplate.value.id,
				title: title.value,
				fieldValues: { ...fieldValues },
			});
			toast.success('Đã lưu nháp');
		} catch { /* silent */ }
	} else if (draftId) {
		await autoSaveDraft();
		toast.success('Đã lưu nháp');
	}
	router.push('/general-requests');
}

onMounted(() => {
	loadTemplates();
});

watch(step, s => {
	if (s === 3) {
		loadSuggestedApprovers();
		loadAllEmployees();
	}
});
</script>

<template>
	<div class="max-w-3xl mx-auto space-y-6">
		<!-- Header -->
		<div class="flex items-center gap-3">
			<NuxtLink to="/general-requests" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Tạo văn bản nội bộ</h1>
			</div>
		</div>

		<!-- Step indicator -->
		<div class="flex items-center gap-2">
			<div v-for="(s, idx) in ['Chọn mẫu', 'Điền thông tin', 'Chọn người duyệt']" :key="idx" class="flex items-center gap-2">
				<div :class="['flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors', step > idx + 1 ? 'bg-green-500 text-white' : step === idx + 1 ? 'bg-brand-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500']">
					<svg v-if="step > idx + 1" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
					<span v-else>{{ idx + 1 }}</span>
				</div>
				<span :class="['text-sm', step === idx + 1 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-400']">{{ s }}</span>
				<svg v-if="idx < 2" class="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
			</div>
		</div>

		<!-- STEP 1: Choose template -->
		<template v-if="step === 1">
			<div v-if="templatesLoading" class="flex justify-center py-12">
				<svg class="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
			</div>
			<div v-else-if="templates.length === 0" class="py-16 text-center text-sm text-gray-400 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
				Chưa có mẫu văn bản nào. Liên hệ HR để tạo mẫu.
			</div>
			<div v-else class="space-y-6">
				<div v-for="(group, category) in groupedTemplates" :key="category" class="space-y-3">
					<div class="flex items-center gap-2">
						<span :class="['text-xs font-semibold px-2 py-1 rounded-full', categoryColors[category] ?? categoryColors.OTHER]">{{ categoryLabels[category] ?? category }}</span>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div
							v-for="t in group"
							:key="t.id"
							class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-sm transition-all cursor-pointer"
							@click="selectTemplate(t)"
						>
							<p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t.name }}</p>
							<p v-if="t.description" class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t.description }}</p>
							<div class="flex items-center justify-between mt-3">
								<span class="text-xs text-gray-400">v{{ t.version }}</span>
								<button class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">Dùng template này →</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>

		<!-- STEP 2: Dynamic form -->
		<template v-else-if="step === 2">
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ selectedTemplate?.name }}</h2>
					<button class="text-xs text-gray-400 hover:text-brand-600 dark:hover:text-brand-400" @click="step = 1">Đổi mẫu</button>
				</div>

				<!-- Title -->
				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tiêu đề <span class="text-red-500">*</span></label>
					<input v-model="title" type="text" placeholder="Nhập tiêu đề văn bản..." class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" @input="onFieldChange" />
					<p v-if="fieldErrors['__title']" class="text-xs text-red-500">{{ fieldErrors['__title'] }}</p>
				</div>

				<!-- Dynamic fields -->
				<template v-for="field in selectedTemplate?.fields" :key="field.key">
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							{{ field.label }}
							<span v-if="field.required" class="text-red-500">*</span>
						</label>

						<template v-if="field.type === 'textarea'">
							<textarea
								v-model="(fieldValues as Record<string, string>)[field.key]"
								rows="3"
								:placeholder="field.placeholder"
								class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none"
								@input="onFieldChange"
							/>
						</template>
						<template v-else-if="field.type === 'select'">
							<select
								v-model="(fieldValues as Record<string, string>)[field.key]"
								class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
								@change="onFieldChange"
							>
								<option value="">Chọn...</option>
								<option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
							</select>
						</template>
						<template v-else-if="field.type === 'checkbox'">
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									v-model="(fieldValues as Record<string, boolean>)[field.key]"
									type="checkbox"
									class="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									@change="onFieldChange"
								/>
								<span class="text-sm text-gray-600 dark:text-gray-400">{{ field.placeholder || field.label }}</span>
							</label>
						</template>
						<template v-else>
							<input
								v-model="(fieldValues as Record<string, string>)[field.key]"
								:type="field.type"
								:placeholder="field.placeholder"
								class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
								@input="onFieldChange"
							/>
						</template>

						<p v-if="fieldErrors[field.key]" class="text-xs text-red-500">{{ fieldErrors[field.key] }}</p>
					</div>
				</template>
			</div>

			<div class="flex justify-between">
				<CommonAppButton variant="secondary" @click="step = 1">Quay lại</CommonAppButton>
				<div class="flex gap-3">
					<CommonAppButton variant="secondary" @click="saveDraftAndExit">Lưu nháp</CommonAppButton>
					<CommonAppButton @click="goToStep3">Tiếp theo →</CommonAppButton>
				</div>
			</div>
		</template>

		<!-- STEP 3: Approvers -->
		<template v-else-if="step === 3">
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
				<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Chuỗi duyệt</h2>
				<p class="text-xs text-gray-500 dark:text-gray-400">Thứ tự trong danh sách = thứ tự duyệt thực tế. Dùng nút ↑↓ để sắp xếp lại.</p>

				<!-- Approver list -->
				<div v-if="selectedApprovers.length === 0" class="py-6 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
					Chưa có người duyệt
				</div>
				<div v-else class="space-y-2">
					<div v-for="(a, idx) in selectedApprovers" :key="a.employeeId" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
						<div class="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-400">{{ idx + 1 }}</div>
						<div class="flex-1">
							<p class="text-sm font-medium text-gray-900 dark:text-white">{{ a.fullName }}</p>
							<p v-if="a.role" class="text-xs text-gray-400">{{ a.role }}</p>
						</div>
						<div class="flex gap-1">
							<button type="button" class="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700" @click="moveApproverUp(idx)">
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
							</button>
							<button type="button" class="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700" @click="moveApproverDown(idx)">
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
							</button>
							<button type="button" class="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" @click="removeApprover(idx)">
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>
					</div>
				</div>

				<!-- Add approver -->
				<div class="relative">
					<input
						v-model="approverSearch"
						type="text"
						placeholder="Tìm thêm người duyệt..."
						class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
						@focus="showApproverDropdown = true"
						@blur="setTimeout(() => showApproverDropdown = false, 150)"
					/>
					<div v-if="showApproverDropdown && approverSearch && filteredEmployees.length > 0" class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
						<button
							v-for="emp in filteredEmployees"
							:key="emp.id"
							type="button"
							class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
							@mousedown.prevent="addApprover(emp)"
						>
							<span class="font-medium text-gray-900 dark:text-white">{{ emp.fullName }}</span>
							<span class="text-xs text-gray-400">{{ emp.employeeCode }}</span>
						</button>
					</div>
				</div>

				<!-- Chain preview -->
				<div v-if="selectedApprovers.length > 0" class="pt-2">
					<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Preview chuỗi duyệt:</p>
					<div class="flex items-center flex-wrap gap-1">
						<span class="px-2 py-1 text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-full font-medium">Bạn</span>
						<template v-for="(a, idx) in selectedApprovers" :key="idx">
							<svg class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
							<span class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">{{ a.fullName }}</span>
						</template>
						<svg class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
						<span class="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">✓ Hoàn thành</span>
					</div>
				</div>
			</div>

			<div class="flex justify-between">
				<CommonAppButton variant="secondary" @click="step = 2">Quay lại</CommonAppButton>
				<div class="flex gap-3">
					<CommonAppButton variant="secondary" @click="saveDraftAndExit">Lưu nháp</CommonAppButton>
					<CommonAppButton :loading="submitting" @click="handleSubmit">Gửi duyệt</CommonAppButton>
				</div>
			</div>
		</template>
	</div>
</template>
