<script setup lang="ts">
	import { formatDate } from '~/utils/date';
	import { GENDER_LABELS, type Employee } from '~/types/employee.types';
	import { useMeProfileService } from '~/services/me-profile.service';
	import type { MyProfileChange } from '~/types/hr-profile.types';
	import ProfileChangeRequestModal, {
		type ChangeRequestField,
	} from '~/components/modules/profile/ProfileChangeRequestModal.vue';
	import ProfilePendingRequestNotice from '~/components/modules/profile/ProfilePendingRequestNotice.vue';

	/**
	 * Khối thông tin định danh trên trang cá nhân (UI-04, lô 3a).
	 *
	 * Bốn trường này nhân viên không tự sửa được: họ tên, email công việc, ngày sinh và giới
	 * tính đều phải qua phòng nhân sự duyệt, vì chúng đi vào hợp đồng và bảng lương.
	 */
	const props = defineProps<{
		employee: Employee;
		pending: MyProfileChange | null;
	}>();

	const emit = defineEmits<{
		created: [];
		cancelled: [];
	}>();

	const toast = useToast();
	const service = useMeProfileService();

	const showModal = ref(false);
	const submitting = ref(false);

	// Họ tên và email công việc là trường bắt buộc của hồ sơ: để trống thì server trả 400, nên
	// form chặn ngay.
	const fields = computed<ChangeRequestField[]>(() => [
		{ key: 'fullName', label: 'Họ và tên', value: props.employee.fullName, required: true },
		{
			key: 'email',
			label: 'Email công việc',
			value: props.employee.email,
			required: true,
			hint: 'Email này cũng là tên đăng nhập, nên phòng nhân sự sẽ kiểm tra trước khi đổi.',
		},
		{ key: 'dateOfBirth', label: 'Ngày sinh', type: 'date', value: props.employee.dateOfBirth ?? '' },
		{
			key: 'gender',
			label: 'Giới tính',
			type: 'select',
			value: props.employee.genderCode ?? '',
			options: [
				{ value: '', label: '-- Chưa rõ --' },
				...Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label })),
			],
		},
	]);

	async function onSubmit(payload: { after: Record<string, unknown>; documentIds: number[] }) {
		submitting.value = true;
		try {
			const result = await service.createChangeRequest({
				section: 'BASIC',
				after: payload.after,
				documentIds: payload.documentIds.length ? payload.documentIds : undefined,
			});
			showModal.value = false;
			toast.success(
				result.supersededIds.length
					? 'Đã gửi đề nghị mới và huỷ đề nghị đang chờ trước đó, phòng nhân sự sẽ xem và duyệt.'
					: 'Đã gửi đề nghị thay đổi, chờ phòng nhân sự duyệt.',
			);
			emit('created');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa gửi được đề nghị. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Thông tin định danh</h3>
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					Những thông tin này chỉ đổi được sau khi phòng nhân sự duyệt.
				</p>
			</div>
			<CommonAppButton size="sm" variant="outline" @click="showModal = true">Đề nghị thay đổi</CommonAppButton>
		</div>

		<div class="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
			<div>
				<p :class="labelCls">Họ và tên</p>
				<p :class="valueCls">{{ employee.fullName }}</p>
			</div>
			<div>
				<p :class="labelCls">Email công việc</p>
				<p :class="[valueCls, 'break-all']">{{ employee.email }}</p>
			</div>
			<div>
				<p :class="labelCls">Ngày sinh</p>
				<p :class="valueCls">{{ employee.dateOfBirth ? formatDate(employee.dateOfBirth) : '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Giới tính</p>
				<p :class="valueCls">{{ employee.gender ?? '—' }}</p>
			</div>
		</div>

		<ProfilePendingRequestNotice
			v-if="pending"
			class="mt-4"
			:request="pending"
			@cancelled="emit('cancelled')"
		/>

		<ProfileChangeRequestModal
			v-if="showModal"
			section="BASIC"
			:fields="fields"
			allow-documents
			:submitting="submitting"
			@submit="onSubmit"
			@close="showModal = false"
		/>
	</div>
</template>
