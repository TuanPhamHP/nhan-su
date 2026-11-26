<script setup lang="ts">
	import FaceConfirmDialog from '~/components/modules/attendance/FaceConfirmDialog.vue';
	import type { EmployeeFaceResponseDto } from '~/types/attendance.types';
	import { formatDate, formatDateTime } from '~/utils/date';

	/**
	 * Khối "Khuôn mặt chấm công" ở tab Định danh của chi tiết nhân viên. Nơi dùng tự ẩn khối này
	 * khi người xem không có `attendance:face:manage`.
	 *
	 * Xoá là xoá hẳn ảnh và dữ liệu khuôn mặt; nhân viên nhận thông báo và phải đăng ký lại trước
	 * lần chấm công tới.
	 */
	const props = defineProps<{
		employeeId: number;
		employeeName: string;
	}>();

	const toast = useToast();
	const imageViewer = useImageViewerStore();
	const { loading, saving, getEmployee, resetEmployee } = useAttendanceFace();

	const face = ref<EmployeeFaceResponseDto | null>(null);
	const confirmReset = ref(false);

	async function load() {
		try {
			face.value = await getEmployee(props.employeeId);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được khuôn mặt chấm công');
		}
	}

	async function applyReset() {
		try {
			await resetEmployee(props.employeeId);
			confirmReset.value = false;
			toast.success('Đã xoá khuôn mặt');
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không xoá được khuôn mặt');
		}
	}

	onMounted(load);
</script>

<template>
	<div
		class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
		data-testid="employee-face"
	>
		<div class="mb-4 flex items-center justify-between gap-3">
			<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Khuôn mặt chấm công</h3>
			<CommonAppButton
				v-if="face?.registered"
				size="sm"
				variant="danger_outline"
				data-testid="employee-face-reset"
				@click="confirmReset = true"
			>
				Xoá khuôn mặt
			</CommonAppButton>
		</div>

		<p v-if="loading && !face" class="text-sm text-gray-400">Đang tải...</p>

		<div v-else-if="face?.registered" class="flex items-start gap-4">
			<img
				v-if="face.photoUrl"
				:src="face.photoUrl"
				alt="Ảnh khuôn mặt đã đăng ký"
				class="h-28 w-24 flex-shrink-0 cursor-pointer rounded-lg border border-gray-200 object-cover dark:border-gray-700"
				@click="imageViewer.open([face.photoUrl], 0)"
			/>
			<dl class="grid min-w-0 gap-3 text-sm">
				<div>
					<dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Ngày đăng ký</dt>
					<dd class="text-gray-900 dark:text-white">{{ formatDate(face.registeredAt) }}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Đồng ý dùng ảnh lúc</dt>
					<dd class="text-gray-900 dark:text-white">{{ face.consentAt ? formatDateTime(face.consentAt) : '—' }}</dd>
				</div>
			</dl>
		</div>

		<p v-else-if="face" class="text-sm text-gray-500 dark:text-gray-400">
			Chưa đăng ký khuôn mặt. Nhân viên tự đăng ký ở màn chấm công hoặc hồ sơ của mình.
		</p>
	</div>

	<FaceConfirmDialog
		v-if="confirmReset"
		title="Xoá khuôn mặt"
		:message="`Xoá khuôn mặt của ${employeeName}? Người này phải đăng ký lại trước lần chấm công tới.`"
		confirm-label="Xoá"
		danger
		:busy="saving"
		@confirm="applyReset"
		@cancel="confirmReset = false"
	/>
</template>
