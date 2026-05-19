<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import type { PublicHolidayResponse } from '~/types/public-holiday.types';
import { formatDate } from '~/utils/date';

definePageMeta({ title: 'Ngày lễ & Nghỉ bù' });

const toast = useToast();
const { holidays, loading, fetchHolidays, createHolidayRange, updateHoliday, deleteHoliday, bulkCreateYear } = usePublicHolidays();

// --- Year selector ---
const currentYear = new Date().getFullYear();
const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
const selectedYear = ref(currentYear);

// --- Grouped by month ---
const groupedByMonth = computed(() => {
	const groups = new Map<number, PublicHolidayResponse[]>();
	const sorted = [...holidays.value].sort((a, b) => a.date.localeCompare(b.date));
	for (const h of sorted) {
		const month = parseInt(h.date.split('-')[1], 10);
		if (!groups.has(month)) groups.set(month, []);
		groups.get(month)!.push(h);
	}
	return groups;
});

const sortedMonths = computed(() => [...groupedByMonth.value.keys()].sort((a, b) => a - b));

// --- Add/Edit modal ---
const showModal = ref(false);
const editTarget = ref<PublicHolidayResponse | null>(null);

const nameRule = z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(100, 'Tên tối đa 100 ký tự');

const addSchema = toTypedSchema(
	z.object({
		name: nameRule,
		fromDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
		toDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc'),
	}),
);

const editSchema = toTypedSchema(
	z.object({
		name: nameRule,
		date: z.string().min(1, 'Vui lòng chọn ngày'),
	}),
);

const validationSchema = computed(() => (editTarget.value ? editSchema : addSchema));

const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm({ validationSchema });
const [name, nameAttrs] = defineField('name');
const [date, dateAttrs] = defineField('date');
const [fromDate] = defineField('fromDate');
const [toDate] = defineField('toDate');

function openAddModal() {
	resetForm({ values: { name: '', fromDate: '', toDate: '', date: '' } });
	editTarget.value = null;
	showModal.value = true;
}

function openEditModal(holiday: PublicHolidayResponse) {
	resetForm({ values: { name: holiday.name, date: holiday.date, fromDate: '', toDate: '' } });
	editTarget.value = holiday;
	showModal.value = true;
}

function closeModal() {
	showModal.value = false;
}

const onSubmit = handleSubmit(async () => {
	try {
		if (editTarget.value) {
			await updateHoliday(editTarget.value.id, { name: name.value!, date: date.value! });
			toast.success('Đã cập nhật ngày lễ');
		} else {
			const result = await createHolidayRange(
				{ name: name.value!, fromDate: fromDate.value!, toDate: toDate.value! },
				selectedYear.value,
			);
			toast.success(result.message);
		}
		closeModal();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});

// --- Delete confirm ---
const deleteTargetId = ref<number | null>(null);
const deleting = ref(false);

async function confirmDelete() {
	if (!deleteTargetId.value) return;
	deleting.value = true;
	try {
		await deleteHoliday(deleteTargetId.value);
		toast.success('Đã xóa ngày lễ');
		deleteTargetId.value = null;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi xóa ngày lễ');
	} finally {
		deleting.value = false;
	}
}

// --- Bulk create confirm ---
const showBulkConfirm = ref(false);
const bulkCreating = ref(false);

async function confirmBulk() {
	bulkCreating.value = true;
	try {
		const result = await bulkCreateYear(selectedYear.value);
		toast.success(`${result.message}. Lưu ý: Tết Nguyên Đán và Giỗ Tổ Hùng Vương cần nhập thủ công.`);
		showBulkConfirm.value = false;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tạo nhanh ngày lễ');
	} finally {
		bulkCreating.value = false;
	}
}

// --- Watchers & init ---
watch(selectedYear, (year) => fetchHolidays(year));

onMounted(() => fetchHolidays(selectedYear.value));
</script>

<template>
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">
					Ngày lễ &amp; Nghỉ bù {{ selectedYear }}
				</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Quản lý ngày lễ quốc gia và ngày nghỉ bù</p>
			</div>

			<div class="flex items-center gap-3 flex-wrap">
				<!-- Year selector -->
				<select
					v-model="selectedYear"
					class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
				>
					<option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
				</select>

				<!-- Bulk create -->
				<button
					class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					@click="showBulkConfirm = true"
				>
					<svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
					</svg>
					Tạo nhanh {{ selectedYear }}
				</button>

				<!-- Add holiday -->
				<button
					class="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
					@click="openAddModal"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
					Thêm ngày lễ
				</button>
			</div>
		</div>

		<!-- Loading skeleton -->
		<div v-if="loading" class="space-y-8">
			<div v-for="g in 3" :key="g" class="space-y-2">
				<div class="flex items-center gap-3 mb-3">
					<div class="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
					<div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div class="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
				</div>
				<div v-for="i in 2" :key="i" class="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
					<div class="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
					<div class="w-px h-8 bg-gray-200 dark:bg-gray-700" />
					<div class="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded max-w-xs" />
				</div>
			</div>
		</div>

		<!-- Empty state -->
		<div
			v-else-if="!holidays.length"
			class="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
		>
			<div class="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
				<svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
				</svg>
			</div>
			<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chưa có ngày lễ nào cho năm {{ selectedYear }}</p>
			<p class="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">Nhấn "Tạo nhanh" để tự động tạo các ngày lễ cố định</p>
			<div class="flex items-center gap-3">
				<button
					class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					@click="showBulkConfirm = true"
				>
					Tạo nhanh {{ selectedYear }}
				</button>
				<button
					class="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
					@click="openAddModal"
				>
					Thêm thủ công
				</button>
			</div>
		</div>

		<!-- Timeline by month -->
		<div v-else class="space-y-8">
			<div v-for="month in sortedMonths" :key="month">
				<!-- Month header -->
				<div class="flex items-center gap-3 mb-3">
					<div class="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
					<span class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
						Tháng {{ month }}
					</span>
					<div class="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
				</div>

				<!-- Holiday rows -->
				<div class="space-y-2">
					<div
						v-for="holiday in groupedByMonth.get(month)"
						:key="holiday.id"
						class="group flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
					>
						<!-- Date -->
						<div class="flex items-center gap-2 w-24 flex-shrink-0">
							<svg class="w-4 h-4 text-brand-500 dark:text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
							</svg>
							<span class="text-sm font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
								{{ formatDate(holiday.date, 'dd/MM') }}
							</span>
						</div>

						<!-- Divider -->
						<div class="w-px h-5 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

						<!-- Name -->
						<p class="flex-1 text-sm text-gray-900 dark:text-white">{{ holiday.name }}</p>

						<!-- Actions -->
						<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
							<button
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
								title="Sửa"
								@click="openEditModal(holiday)"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
								</svg>
							</button>
							<button
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
								title="Xóa"
								@click="deleteTargetId = holiday.id"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Add/Edit Modal -->
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
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="closeModal"
			>
				<div class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700">
					<div class="flex items-center gap-3 mb-6">
						<div class="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
							<svg class="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
							</svg>
						</div>
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ editTarget ? 'Sửa ngày lễ' : 'Thêm ngày lễ' }}
						</h3>
					</div>

					<form class="space-y-4" @submit.prevent="onSubmit">
						<CommonAppInput
							v-model="name"
							v-bind="nameAttrs"
							label="Tên ngày lễ"
							placeholder="VD: Tết Nguyên Đán"
							required
							:error="errors.name"
						/>

						<!-- Add mode: date range picker -->
						<div v-if="!editTarget">
							<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Khoảng ngày <span class="text-red-500 ml-0.5">*</span>
							</label>
							<div class="mt-1">
								<UiDateRangePicker
									:from-date="fromDate ?? ''"
									:to-date="toDate ?? ''"
									placeholder="Chọn ngày bắt đầu → ngày kết thúc"
									@update:from-date="(val) => (fromDate = val)"
									@update:to-date="(val) => (toDate = val)"
								/>
							</div>
							<p v-if="errors.fromDate" class="mt-1 text-xs text-red-500 dark:text-red-400">{{ errors.fromDate }}</p>
							<p v-else-if="errors.toDate" class="mt-1 text-xs text-red-500 dark:text-red-400">{{ errors.toDate }}</p>
						</div>

						<!-- Edit mode: single date input -->
						<CommonAppInput
							v-else
							v-model="date"
							v-bind="dateAttrs"
							type="date"
							label="Ngày"
							required
							:error="errors.date"
						/>

						<div class="flex gap-3 pt-2">
							<CommonAppButton
								type="button"
								variant="outline"
								class="flex-1"
								@click="closeModal"
							>
								Hủy
							</CommonAppButton>
							<CommonAppButton
								type="submit"
								class="flex-1"
								:loading="isSubmitting"
							>
								{{ editTarget ? 'Cập nhật' : 'Thêm ngày lễ' }}
							</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Transition>
	</Teleport>

	<!-- Delete confirm -->
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
				v-if="deleteTargetId"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="deleteTargetId = null"
			>
				<div class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700">
					<div class="flex items-start gap-4">
						<div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
							<svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900 dark:text-white">Xóa ngày lễ</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
								Bạn có chắc chắn muốn xóa ngày lễ này? Hành động này không thể hoàn tác.
							</p>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-6">
						<CommonAppButton variant="outline" @click="deleteTargetId = null">Hủy</CommonAppButton>
						<CommonAppButton variant="danger" :loading="deleting" @click="confirmDelete">Xóa</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>

	<!-- Bulk create confirm -->
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
				v-if="showBulkConfirm"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="showBulkConfirm = false"
			>
				<div class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700">
					<div class="flex items-start gap-4">
						<div class="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
							<svg class="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900 dark:text-white">
								Tạo nhanh ngày lễ {{ selectedYear }}
							</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
								Sẽ tạo các ngày lễ cố định cho năm {{ selectedYear }}. Các ngày Tết và Giỗ Tổ cần nhập thủ công.
							</p>
							<ul class="mt-3 space-y-1">
								<li
									v-for="item in ['Tết Dương lịch (01/01)', 'Ngày Giải phóng miền Nam (30/04)', 'Ngày Quốc tế Lao động (01/05)', 'Quốc khánh (02/09)', 'Quốc khánh ngày 2 (03/09)']"
									:key="item"
									class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
								>
									<svg class="w-3 h-3 text-brand-500 dark:text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
									</svg>
									{{ item }}
								</li>
							</ul>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-6">
						<CommonAppButton variant="outline" @click="showBulkConfirm = false">Hủy</CommonAppButton>
						<CommonAppButton :loading="bulkCreating" @click="confirmBulk">Tạo nhanh</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
