<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { differenceInCalendarDays } from 'date-fns';
import { useBusinessTripService } from '~/services/business-trip.service';
import { useEmployeeService } from '~/services/employee.service';
import { useGeneralRequestService } from '~/services/general-request.service';
import type { TransportType } from '~/types/business-trip.types';
import type { EmployeeSummary } from '~/types/employee.types';

definePageMeta({ title: 'Tạo đơn công tác' });

const toast = useToast();
const router = useRouter();
const service = useBusinessTripService();
const employeeService = useEmployeeService();

const transportOptions: { value: TransportType; label: string }[] = [
	{ value: 'PLANE', label: 'Máy bay' },
	{ value: 'TRAIN', label: 'Tàu hỏa' },
	{ value: 'CAR', label: 'Xe ô tô' },
	{ value: 'OTHER', label: 'Khác' },
];

const schema = toTypedSchema(z.object({
	title: z.string().min(3, 'Tiêu đề phải ít nhất 3 ký tự'),
	destination: z.string().min(2, 'Điểm đến phải ít nhất 2 ký tự'),
	purpose: z.string().min(10, 'Mục đích phải ít nhất 10 ký tự'),
	startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
	endDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc'),
	estimatedCost: z.number().min(0).optional(),
	transportType: z.enum(['PLANE', 'TRAIN', 'CAR', 'OTHER']).optional(),
}));

const { handleSubmit, defineField, errors, isSubmitting, values } = useForm({ validationSchema: schema });
const [title, titleAttrs] = defineField('title');
const [destination, destinationAttrs] = defineField('destination');
const [purpose, purposeAttrs] = defineField('purpose');
const [startDate, startDateAttrs] = defineField('startDate');
const [endDate, endDateAttrs] = defineField('endDate');
const [estimatedCost, estimatedCostAttrs] = defineField('estimatedCost');
const [transportType, transportTypeAttrs] = defineField('transportType');

const dayCount = computed(() => {
	if (!values.startDate || !values.endDate) return 0;
	const diff = differenceInCalendarDays(new Date(values.endDate), new Date(values.startDate));
	return diff >= 0 ? diff + 1 : 0;
});

// ─── Companions ───────────────────────────────────────────────────────────────
const companions = ref<EmployeeSummary[]>([]);
const allEmployees = ref<EmployeeSummary[]>([]);
const employeeSearch = ref('');
const showEmployeeDropdown = ref(false);

const filteredEmployees = computed(() =>
	allEmployees.value.filter(e =>
		!companions.value.some(c => c.id === e.id) &&
		(e.fullName.toLowerCase().includes(employeeSearch.value.toLowerCase()) ||
			e.employeeCode.toLowerCase().includes(employeeSearch.value.toLowerCase())),
	).slice(0, 10),
);

async function loadEmployees() {
	try {
		const res = await employeeService.findAll({ status: 'ACTIVE', limit: 200 });
		allEmployees.value = res.data;
	} catch { /* non-critical */ }
}

function addCompanion(emp: EmployeeSummary) {
	companions.value.push(emp);
	employeeSearch.value = '';
	showEmployeeDropdown.value = false;
}

function removeCompanion(id: number) {
	companions.value = companions.value.filter(c => c.id !== id);
}

// ─── Approver ─────────────────────────────────────────────────────────────────
interface SuggestedApproverLocal {
	id: number;
	fullName: string;
	role?: string;
	position?: string;
}

const suggestedApprovers = ref<SuggestedApproverLocal[]>([]);
const selectedApproverId = ref<number | null>(null);
const approverSearch = ref('');
const showApproverDropdown = ref(false);

const filteredApprovers = computed(() =>
	allEmployees.value.filter(e =>
		e.fullName.toLowerCase().includes(approverSearch.value.toLowerCase()) ||
		e.employeeCode.toLowerCase().includes(approverSearch.value.toLowerCase()),
	).slice(0, 10),
);

async function loadSuggestedApprovers() {
	try {
		const generalRequestService = useGeneralRequestService();
		const res = await generalRequestService.findSuggestedApprovers();
		if (res.length > 0) {
			suggestedApprovers.value = res.map(a => ({ id: a.employeeId, fullName: a.fullName, role: a.role }));
			if (!selectedApproverId.value) selectedApproverId.value = res[0].employeeId;
		}
	} catch { /* non-critical */ }
}

const selectedApproverName = computed(() => {
	if (!selectedApproverId.value) return '';
	const local = suggestedApprovers.value.find(a => a.id === selectedApproverId.value);
	if (local) return local.fullName;
	const emp = allEmployees.value.find(e => e.id === selectedApproverId.value);
	return emp?.fullName ?? '';
});

function selectApprover(emp: { id: number; fullName: string }) {
	selectedApproverId.value = emp.id;
	approverSearch.value = '';
	showApproverDropdown.value = false;
}

// ─── Submit ───────────────────────────────────────────────────────────────────
const onSaveDraft = handleSubmit(async values => {
	try {
		await service.create({
			...values,
			estimatedCost: values.estimatedCost,
			transportType: values.transportType as TransportType | undefined,
			companions: companions.value.map(c => ({ employeeId: c.id })),
		});
		toast.success('Đã lưu nháp đơn công tác');
		router.push('/business-trips');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});

const onSubmit = handleSubmit(async values => {
	if (!selectedApproverId.value) {
		toast.error('Vui lòng chọn người duyệt');
		return;
	}
	try {
		const created = await service.create({
			...values,
			estimatedCost: values.estimatedCost,
			transportType: values.transportType as TransportType | undefined,
			companions: companions.value.map(c => ({ employeeId: c.id })),
		});
		await service.submit(created.id, { approverId: selectedApproverId.value });
		toast.success('Đã gửi đơn công tác');
		router.push('/business-trips');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});

onMounted(() => {
	loadEmployees();
	loadSuggestedApprovers();
});
</script>

<template>
	<div class="max-w-2xl mx-auto space-y-6">
		<!-- Header -->
		<div class="flex items-center gap-3">
			<NuxtLink to="/business-trips" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Tạo đơn công tác</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Điền đầy đủ thông tin và gửi duyệt</p>
			</div>
		</div>

		<form class="space-y-6" @submit.prevent>
			<!-- Basic info -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
				<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Thông tin chuyến đi</h2>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tiêu đề <span class="text-red-500">*</span></label>
					<input v-model="title" v-bind="titleAttrs" type="text" placeholder="VD: Khảo sát thị trường Hà Nội" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
					<p v-if="errors.title" class="text-xs text-red-500">{{ errors.title }}</p>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Điểm đến <span class="text-red-500">*</span></label>
						<input v-model="destination" v-bind="destinationAttrs" type="text" placeholder="VD: Hà Nội, TP.HCM" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
						<p v-if="errors.destination" class="text-xs text-red-500">{{ errors.destination }}</p>
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Phương tiện</label>
						<select v-model="transportType" v-bind="transportTypeAttrs" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors">
							<option value="">Chọn phương tiện...</option>
							<option v-for="opt in transportOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
						</select>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ngày bắt đầu <span class="text-red-500">*</span></label>
						<input v-model="startDate" v-bind="startDateAttrs" type="date" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
						<p v-if="errors.startDate" class="text-xs text-red-500">{{ errors.startDate }}</p>
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ngày kết thúc <span class="text-red-500">*</span></label>
						<input v-model="endDate" v-bind="endDateAttrs" type="date" :min="values.startDate" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
						<p v-if="errors.endDate" class="text-xs text-red-500">{{ errors.endDate }}</p>
					</div>
				</div>

				<p v-if="dayCount > 0" class="text-sm text-brand-600 dark:text-brand-400 font-medium">
					Khoảng {{ dayCount }} ngày (số ngày làm việc thực tế sẽ được tính bởi server)
				</p>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mục đích <span class="text-red-500">*</span></label>
					<textarea v-model="purpose" v-bind="purposeAttrs" rows="3" placeholder="Mô tả mục đích của chuyến công tác..." class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none" />
					<p v-if="errors.purpose" class="text-xs text-red-500">{{ errors.purpose }}</p>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Chi phí dự kiến (VNĐ)</label>
					<input v-model.number="estimatedCost" v-bind="estimatedCostAttrs" type="number" min="0" placeholder="0" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
				</div>
			</div>

			<!-- Companions -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
				<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Người đi cùng (tùy chọn)</h2>

				<div class="relative">
					<input
						v-model="employeeSearch"
						type="text"
						placeholder="Tìm nhân viên..."
						class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
						@focus="showEmployeeDropdown = true"
						@blur="setTimeout(() => showEmployeeDropdown = false, 150)"
					/>
					<div v-if="showEmployeeDropdown && filteredEmployees.length > 0" class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
						<button
							v-for="emp in filteredEmployees"
							:key="emp.id"
							type="button"
							class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
							@mousedown.prevent="addCompanion(emp)"
						>
							<span class="font-medium text-gray-900 dark:text-white">{{ emp.fullName }}</span>
							<span class="text-xs text-gray-400">{{ emp.employeeCode }}</span>
						</button>
					</div>
				</div>

				<div v-if="companions.length > 0" class="flex flex-wrap gap-2">
					<div v-for="c in companions" :key="c.id" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-medium">
						{{ c.fullName }}
						<button type="button" class="hover:text-brand-900 dark:hover:text-brand-200" @click="removeCompanion(c.id)">
							<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>
			</div>

			<!-- Approver -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
				<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Người duyệt <span class="text-red-500">*</span></h2>

				<div v-if="suggestedApprovers.length > 0" class="space-y-2">
					<p class="text-xs text-gray-500 dark:text-gray-400">Gợi ý:</p>
					<div class="flex flex-wrap gap-2">
						<button
							v-for="a in suggestedApprovers"
							:key="a.id"
							type="button"
							:class="['px-3 py-1.5 rounded-lg text-sm border transition-all', selectedApproverId === a.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-300']"
							@click="selectedApproverId = a.id"
						>
							{{ a.fullName }}
							<span v-if="a.role" class="text-xs text-gray-400 ml-1">({{ a.role }})</span>
						</button>
					</div>
				</div>

				<div class="relative">
					<input
						v-model="approverSearch"
						type="text"
						:placeholder="selectedApproverName ? `Đang chọn: ${selectedApproverName}` : 'Hoặc tìm nhân viên khác...'"
						class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
						@focus="showApproverDropdown = true"
						@blur="setTimeout(() => showApproverDropdown = false, 150)"
					/>
					<div v-if="showApproverDropdown && approverSearch && filteredApprovers.length > 0" class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
						<button
							v-for="emp in filteredApprovers"
							:key="emp.id"
							type="button"
							class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
							@mousedown.prevent="selectApprover(emp)"
						>
							<span class="font-medium text-gray-900 dark:text-white">{{ emp.fullName }}</span>
							<span class="text-xs text-gray-400">{{ emp.employeeCode }}</span>
						</button>
					</div>
				</div>

				<p v-if="selectedApproverName" class="text-xs text-green-600 dark:text-green-400">
					✓ Đã chọn: <strong>{{ selectedApproverName }}</strong>
				</p>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3">
				<NuxtLink to="/business-trips">
					<CommonAppButton variant="secondary" type="button">Hủy</CommonAppButton>
				</NuxtLink>
				<CommonAppButton variant="secondary" type="button" :loading="isSubmitting" @click="onSaveDraft">Lưu nháp</CommonAppButton>
				<CommonAppButton type="button" :loading="isSubmitting" @click="onSubmit">Gửi duyệt</CommonAppButton>
			</div>
		</form>
	</div>
</template>
