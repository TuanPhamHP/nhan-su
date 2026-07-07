<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { differenceInCalendarDays } from 'date-fns';
import { useBusinessTripService } from '~/services/business-trip.service';
import { useEmployeeService } from '~/services/employee.service';
import { useGeneralRequestService } from '~/services/general-request.service';
import type { CreateTripRouteDto, DesiredTimeType } from '~/types/business-trip.types';
import type { EmployeeSummary } from '~/types/employee.types';

definePageMeta({ title: 'Tạo đơn công tác' });

const toast = useToast();
const router = useRouter();
const service = useBusinessTripService();
const employeeService = useEmployeeService();
const { user } = useAuth();
const metaDataStore = useMetaDataStore();

const isHrOrAdmin = computed(() => !!user.value && ['HR', 'ADMIN'].includes(user.value.role));

// ─── Wizard step ──────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;
const step = ref<Step>(1);
const stepMeta = computed(() => [
	{ index: 1, label: 'Thông tin chuyến' },
	{ index: 2, label: 'Lộ trình' },
	{ index: 3, label: 'Người duyệt' },
] as const);

// ─── Bước 1 — thông tin cơ bản ────────────────────────────────────────────────
const schema = toTypedSchema(z.object({
	title: z.string().min(3, 'Tiêu đề phải ít nhất 3 ký tự'),
	destination: z.string().min(2, 'Điểm đến phải ít nhất 2 ký tự'),
	purpose: z.string().min(10, 'Mục đích phải ít nhất 10 ký tự'),
	startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
	endDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc'),
	estimatedCost: z.number().min(0).optional(),
}));

const { defineField, errors, isSubmitting, values, validate } = useForm({ validationSchema: schema });
const [title, titleAttrs] = defineField('title');
const [destination, destinationAttrs] = defineField('destination');
const [purpose, purposeAttrs] = defineField('purpose');
const [startDate, startDateAttrs] = defineField('startDate');
const [endDate, endDateAttrs] = defineField('endDate');
const [estimatedCost, estimatedCostAttrs] = defineField('estimatedCost');

const dayCount = computed(() => {
	if (!values.startDate || !values.endDate) return 0;
	const diff = differenceInCalendarDays(new Date(values.endDate), new Date(values.startDate));
	return diff >= 0 ? diff + 1 : 0;
});

// ─── HR: tạo hộ nhân viên khác ────────────────────────────────────────────────
const createForEmployee = ref(false);
const createdForEmployeeId = ref<number | null>(null);
const createdForSearch = ref('');
const showCreatedForDropdown = ref(false);

// ─── Bước 2 — routes ──────────────────────────────────────────────────────────
interface RouteRow {
	pickupPoint: string;
	dropPoint: string;
	desiredTimeType: DesiredTimeType;
	desiredTime: string;
}

function makeEmptyRoute(): RouteRow {
	return { pickupPoint: '', dropPoint: '', desiredTimeType: 'ARRIVAL', desiredTime: '' };
}

const routes = ref<RouteRow[]>([makeEmptyRoute()]);

function addRoute() {
	routes.value.push(makeEmptyRoute());
}

function removeRoute(index: number) {
	if (routes.value.length <= 1) return;
	routes.value.splice(index, 1);
}

function validateRoutes(): string | null {
	if (routes.value.length === 0) return 'Cần tối thiểu 1 lộ trình';
	for (const [i, r] of routes.value.entries()) {
		if (r.pickupPoint.trim().length < 2) return `Chặng ${i + 1}: điểm đón phải ít nhất 2 ký tự`;
		if (r.dropPoint.trim().length < 2) return `Chặng ${i + 1}: điểm đến phải ít nhất 2 ký tự`;
	}
	return null;
}

function buildRoutesPayload(): CreateTripRouteDto[] {
	return routes.value.map(r => ({
		pickupPoint: r.pickupPoint.trim(),
		dropPoint: r.dropPoint.trim(),
		desiredTimeType: r.desiredTimeType,
		desiredTime: r.desiredTime ? new Date(r.desiredTime).toISOString() : undefined,
	}));
}

// ─── Companions ───────────────────────────────────────────────────────────────
const companions = ref<EmployeeSummary[]>([]);
const allEmployees = ref<EmployeeSummary[]>([]);
const employeeSearch = ref('');
const showEmployeeDropdown = ref(false);

const filteredEmployees = computed(() =>
	allEmployees.value.filter(e =>
		!companions.value.some(c => c.id === e.id) &&
		e.id !== createdForEmployeeId.value &&
		(e.fullName.toLowerCase().includes(employeeSearch.value.toLowerCase()) ||
			e.employeeCode.toLowerCase().includes(employeeSearch.value.toLowerCase())),
	).slice(0, 10),
);

const filteredCreatedFor = computed(() =>
	allEmployees.value.filter(e =>
		e.fullName.toLowerCase().includes(createdForSearch.value.toLowerCase()) ||
		e.employeeCode.toLowerCase().includes(createdForSearch.value.toLowerCase()),
	).slice(0, 10),
);

const createdForEmployeeName = computed(() => {
	if (!createdForEmployeeId.value) return '';
	const emp = allEmployees.value.find(e => e.id === createdForEmployeeId.value);
	return emp?.fullName ?? '';
});

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

function selectCreatedFor(emp: EmployeeSummary) {
	createdForEmployeeId.value = emp.id;
	createdForSearch.value = '';
	showCreatedForDropdown.value = false;
	companions.value = companions.value.filter(c => c.id !== emp.id);
}

function clearCreatedFor() {
	createdForEmployeeId.value = null;
	createdForSearch.value = '';
}

watch(createForEmployee, on => {
	if (!on) clearCreatedFor();
});

// ─── Bước 3 — approver ────────────────────────────────────────────────────────
interface SuggestedApproverLocal {
	id: number;
	fullName: string;
	role?: string;
}

const suggestedApprovers = ref<SuggestedApproverLocal[]>([]);
const selectedApproverId = ref<number | null>(null);
const approverSearch = ref('');
const showApproverDropdown = ref(false);
const selfApprove = ref(false);

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
			if (!selectedApproverId.value && !isHrOrAdmin.value) selectedApproverId.value = res[0].employeeId;
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

watch(selfApprove, on => {
	if (on) selectedApproverId.value = null;
});

// ─── Navigation between steps ─────────────────────────────────────────────────
async function goNext() {
	if (step.value === 1) {
		const { valid } = await validate();
		if (!valid) {
			toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
			return;
		}
		if (isHrOrAdmin.value && createForEmployee.value && !createdForEmployeeId.value) {
			toast.error('Chọn nhân viên bạn muốn tạo đơn hộ');
			return;
		}
		step.value = 2;
		return;
	}
	if (step.value === 2) {
		const err = validateRoutes();
		if (err) {
			toast.error(err);
			return;
		}
		step.value = 3;
		return;
	}
}

function goBack() {
	if (step.value === 1) return;
	step.value = (step.value - 1) as Step;
}

// ─── Submit ───────────────────────────────────────────────────────────────────
function buildBaseDto() {
	return {
		title: values.title!,
		destination: values.destination!,
		purpose: values.purpose!,
		startDate: values.startDate!,
		endDate: values.endDate!,
		estimatedCost: values.estimatedCost,
		companions: companions.value.map(c => ({ employeeId: c.id })),
		routes: buildRoutesPayload(),
		...(isHrOrAdmin.value && createForEmployee.value && createdForEmployeeId.value
			? { createdForEmployeeId: createdForEmployeeId.value }
			: {}),
	};
}

async function saveDraft() {
	const { valid } = await validate();
	if (!valid) {
		toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
		step.value = 1;
		return;
	}
	const routesErr = validateRoutes();
	if (routesErr) {
		toast.error(routesErr);
		step.value = 2;
		return;
	}
	try {
		await service.create(buildBaseDto());
		toast.success('Đã lưu nháp đơn công tác');
		router.push('/business-trips');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

async function submitForApproval() {
	const { valid } = await validate();
	if (!valid) {
		toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
		step.value = 1;
		return;
	}
	const routesErr = validateRoutes();
	if (routesErr) {
		toast.error(routesErr);
		step.value = 2;
		return;
	}
	if (!selfApprove.value && !selectedApproverId.value) {
		toast.error('Vui lòng chọn người duyệt');
		return;
	}
	try {
		const created = await service.create(buildBaseDto());
		const submitted = await service.submit(
			created.id,
			selfApprove.value ? {} : { approverId: selectedApproverId.value! },
		);
		toast.success(submitted.autoApproved ? 'Đã tự duyệt đơn công tác' : 'Đã gửi đơn công tác');
		router.push(`/business-trips/${submitted.id}`);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

onMounted(() => {
	loadEmployees();
	loadSuggestedApprovers();
});
</script>

<template>
	<div class="max-w-3xl mx-auto space-y-6">
		<!-- Header -->
		<div class="flex items-center gap-3">
			<NuxtLink to="/business-trips" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Tạo đơn công tác</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Bước {{ step }}/3 — hoàn tất từng bước để tạo đơn</p>
			</div>
		</div>

		<!-- Stepper -->
		<div class="flex items-center gap-2">
			<template v-for="(s, idx) in stepMeta" :key="s.index">
				<div class="flex items-center gap-2">
					<div
						:class="[
							'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
							step === s.index
								? 'bg-brand-600 text-white'
								: step > s.index
									? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400'
									: 'bg-gray-100 text-gray-400 dark:bg-gray-800',
						]"
					>
						{{ s.index }}
					</div>
					<span
						:class="[
							'text-sm font-medium',
							step === s.index ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400',
						]"
					>
						{{ s.label }}
					</span>
				</div>
				<div v-if="idx < stepMeta.length - 1" class="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
			</template>
		</div>

		<form class="space-y-6" @submit.prevent>
			<!-- ═══ STEP 1: Thông tin chuyến ═══ -->
			<template v-if="step === 1">
				<div v-if="isHrOrAdmin" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
					<label class="flex items-center gap-2 cursor-pointer">
						<input v-model="createForEmployee" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Tạo đơn cho nhân viên khác</span>
					</label>

					<div v-if="createForEmployee" class="space-y-2 pt-2">
						<div class="relative">
							<input
								v-model="createdForSearch"
								type="text"
								:placeholder="createdForEmployeeName ? `Đang chọn: ${createdForEmployeeName}` : 'Tìm nhân viên...'"
								class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
								@focus="showCreatedForDropdown = true"
								@blur="setTimeout(() => showCreatedForDropdown = false, 150)"
							/>
							<div v-if="showCreatedForDropdown && createdForSearch && filteredCreatedFor.length > 0" class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
								<button
									v-for="emp in filteredCreatedFor"
									:key="emp.id"
									type="button"
									class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
									@mousedown.prevent="selectCreatedFor(emp)"
								>
									<span class="font-medium text-gray-900 dark:text-white">{{ emp.fullName }}</span>
									<span class="text-xs text-gray-400">{{ emp.employeeCode }}</span>
								</button>
							</div>
						</div>
						<div v-if="createdForEmployeeName" class="flex items-center justify-between text-xs">
							<span class="text-green-600 dark:text-green-400">✓ Chủ đơn: <strong>{{ createdForEmployeeName }}</strong></span>
							<button type="button" class="text-gray-500 hover:text-red-500" @click="clearCreatedFor">Xoá lựa chọn</button>
						</div>
					</div>
				</div>

				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
					<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Thông tin chuyến đi</h2>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tiêu đề <span class="text-red-500">*</span></label>
						<input v-model="title" v-bind="titleAttrs" type="text" placeholder="VD: Khảo sát thị trường Hà Nội" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
						<p v-if="errors.title" class="text-xs text-red-500">{{ errors.title }}</p>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Điểm đến chính <span class="text-red-500">*</span></label>
						<input v-model="destination" v-bind="destinationAttrs" type="text" placeholder="VD: Hà Nội, TP.HCM" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
						<p v-if="errors.destination" class="text-xs text-red-500">{{ errors.destination }}</p>
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
						Khoảng {{ dayCount }} ngày công tác (số ngày làm việc thực tế do server tính)
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
			</template>

			<!-- ═══ STEP 2: Routes ═══ -->
			<template v-else-if="step === 2">
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Lộ trình di chuyển <span class="text-red-500">*</span></h2>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">HR sẽ cập nhật phương tiện cụ thể sau khi đơn được duyệt.</p>
						</div>
						<button type="button" class="text-sm text-brand-600 dark:text-brand-400 hover:underline" @click="addRoute">+ Thêm chặng</button>
					</div>

					<div v-for="(route, idx) in routes" :key="idx" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
						<div class="flex items-center justify-between">
							<p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Chặng {{ idx + 1 }}</p>
							<button v-if="routes.length > 1" type="button" class="text-xs text-gray-500 hover:text-red-500 transition-colors" @click="removeRoute(idx)">
								Xoá
							</button>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Điểm đón <span class="text-red-500">*</span></label>
								<input v-model="route.pickupPoint" type="text" placeholder="VD: Văn phòng HCM" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Điểm đến <span class="text-red-500">*</span></label>
								<input v-model="route.dropPoint" type="text" placeholder="VD: Sân bay Tân Sơn Nhất" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Loại thời điểm</label>
								<div class="flex gap-2">
									<label class="flex items-center gap-1.5 flex-1 px-3 py-2 rounded-lg border cursor-pointer transition-colors" :class="route.desiredTimeType === 'ARRIVAL' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
										<input v-model="route.desiredTimeType" value="ARRIVAL" type="radio" class="sr-only" />
										<span class="text-sm">📍 Cần có mặt lúc</span>
									</label>
									<label class="flex items-center gap-1.5 flex-1 px-3 py-2 rounded-lg border cursor-pointer transition-colors" :class="route.desiredTimeType === 'PICKUP' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'">
										<input v-model="route.desiredTimeType" value="PICKUP" type="radio" class="sr-only" />
										<span class="text-sm">🚗 Cần xe đón lúc</span>
									</label>
								</div>
							</div>
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
									{{ route.desiredTimeType === 'ARRIVAL' ? 'Giờ cần có mặt tại điểm đến' : 'Giờ cần xe đón' }}
								</label>
								<input v-model="route.desiredTime" type="datetime-local" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
						</div>
					</div>
				</div>

				<!-- Companions -->
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
					<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Người đi cùng (tuỳ chọn)</h2>

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
			</template>

			<!-- ═══ STEP 3: Approver ═══ -->
			<template v-else-if="step === 3">
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
					<div>
						<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
							Người duyệt
							<span v-if="!selfApprove" class="text-red-500">*</span>
						</h2>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Chọn người sẽ nhận thông báo duyệt đơn của bạn.</p>
					</div>

					<label v-if="isHrOrAdmin" class="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
						<input v-model="selfApprove" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
						<span class="text-sm text-amber-700 dark:text-amber-300">Tự duyệt (không cần người duyệt) — đơn sẽ tự động được duyệt khi gửi</span>
					</label>

					<template v-if="!selfApprove">
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
									<span v-if="a.role" class="text-xs text-gray-400 ml-1">({{ metaDataStore.labelForRole(a.role) }})</span>
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
					</template>
				</div>
			</template>

			<!-- Actions -->
			<div class="flex items-center justify-between">
				<CommonAppButton v-if="step > 1" variant="secondary" type="button" @click="goBack">Quay lại</CommonAppButton>
				<div v-else />

				<div class="flex gap-3">
					<CommonAppButton variant="secondary" type="button" :loading="isSubmitting" @click="saveDraft">
						Lưu nháp
					</CommonAppButton>
					<CommonAppButton v-if="step < 3" type="button" @click="goNext">Tiếp tục</CommonAppButton>
					<CommonAppButton v-else type="button" :loading="isSubmitting" @click="submitForApproval">
						{{ selfApprove ? 'Gửi & tự duyệt' : 'Gửi duyệt' }}
					</CommonAppButton>
				</div>
			</div>
		</form>
	</div>
</template>
