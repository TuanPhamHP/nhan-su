<script setup lang="ts">
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import { useKpiService } from '~/services/kpi.service';
	import { useDirectoryStore } from '~/stores/directory';
	import type { KpiReviewDetail } from '~/types/kpi.types';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Đổi người chấm (bridge mục 1, 5): nhân sự đổi khi phiếu chưa gửi đánh giá, ví dụ người chấm nghỉ việc
	 * hay chuyển phòng. Danh sách là người đang làm, bỏ chính nhân viên của phiếu và người chấm hiện tại;
	 * máy chủ vẫn kiểm lại (`KPI_REVIEWER_INVALID`).
	 */
	const props = defineProps<{ review: KpiReviewDetail }>();
	const emit = defineEmits<{ close: []; saved: [review: KpiReviewDetail] }>();

	const service = useKpiService();
	const toast = useToast();
	const directoryStore = useDirectoryStore();
	const picked = ref<number[]>([]);
	const reason = ref('');
	const error = ref('');
	const saving = ref(false);

	onMounted(() => directoryStore.load().catch(() => toast.error('Chưa tải được danh sách nhân viên')));

	const people = computed<PickablePerson[]>(() =>
		directoryStore.employees
			.filter(e => e.id !== props.review.employee.id && e.id !== props.review.reviewer.id)
			.map(e => ({ id: e.id, fullName: e.fullName, hint: [e.employeeCode, e.department?.name].filter(Boolean).join(' · ') })),
	);

	async function save() {
		error.value = '';
		const reviewerId = picked.value[0];
		if (!reviewerId) {
			error.value = 'Chọn người chấm mới';
			return;
		}
		saving.value = true;
		try {
			const review = await service.changeReviewer(props.review.id, { reviewerId, reason: reason.value.trim() || undefined });
			toast.success(`Đã đổi người chấm sang ${review.reviewer.fullName}`);
			emit('saved', review);
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa đổi được người chấm.');
			error.value = info.message;
			toast.error(info.message);
		} finally {
			saving.value = false;
		}
	}
	useEscapeKey(() => emit('close'), () => !saving.value);
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" @click.self="emit('close')">
			<form
				class="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				aria-label="Đổi người chấm"
				data-testid="kpi-change-reviewer"
				@submit.prevent="save"
			>
				<div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Đổi người chấm</h2>
					<p class="text-sm text-gray-500">Phiếu của {{ review.employee.fullName }} · đang do {{ review.reviewer.fullName }} chấm</p>
				</div>
				<div class="space-y-4 px-5 py-4">
					<EmployeePicker v-model="picked" :people="people" single label="Người chấm mới" :error="error || null" />
					<div>
						<label for="kpi-reviewer-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Lý do</label>
						<textarea
							id="kpi-reviewer-reason"
							v-model="reason"
							rows="2"
							maxlength="500"
							placeholder="Ví dụ: người chấm cũ đã chuyển phòng"
							class="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>
				</div>
				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="saving" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="saving" data-testid="kpi-change-reviewer-save">Đổi người chấm</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
