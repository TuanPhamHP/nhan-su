<script setup lang="ts">
	import OfficeDialog from '~/components/modules/office/OfficeDialog.vue';
	import {
		addDaysYmd,
		daysBetweenYmd,
		lockAtOfDeadline,
		supplyLockLabel,
		vnDateYmd,
		weekdayOf,
	} from '~/utils/office.utils';
	import { formatDate } from '~/utils/date';

	/**
	 * Đổi hạn chót của kỳ còn mở, lùi để chờ thêm hoặc rút ngắn để chốt sớm (Q6).
	 *
	 * Xem trước giờ phiếu tự khoá ngay khi chọn ngày, cùng cách hiện với hộp Mở kỳ (thứ trong tuần,
	 * cảnh báo cuối tuần, "còn N ngày"). Hạn chót không được trước hôm nay theo giờ Việt Nam; lỗi của
	 * máy chủ hiện ngay dưới ô ngày, hộp không đóng.
	 */
	const props = defineProps<{
		current: string;
		saving: boolean;
		save: (deadline: string) => Promise<string | null>;
	}>();

	const emit = defineEmits<{ close: [] }>();

	const today = vnDateYmd(new Date());
	const deadline = ref(props.current);
	const error = ref('');

	watch(deadline, () => (error.value = ''));

	const weekday = computed(() => (deadline.value ? weekdayOf(deadline.value) : null));
	const preview = computed(() => {
		if (!deadline.value) return '';
		const days = daysBetweenYmd(today, addDaysYmd(deadline.value, 1));
		return `Phiếu sẽ khoá lúc ${supplyLockLabel(lockAtOfDeadline(deadline.value))}${days > 0 ? ` · còn ${days} ngày` : ''}`;
	});
	const unchanged = computed(() => deadline.value === props.current);

	async function submit() {
		if (!deadline.value) {
			error.value = 'Bạn chọn hạn chót mới.';
			return;
		}
		if (deadline.value < today) {
			error.value = 'Hạn chót không được trước hôm nay.';
			return;
		}
		const message = await props.save(deadline.value);
		if (message) error.value = message;
		else emit('close');
	}
</script>

<template>
	<OfficeDialog title="Đổi hạn chót" :busy="saving" @close="emit('close')">
		<p>Hạn chót hiện tại là {{ formatDate(current) }}. Các phòng đã nhận thông báo mở kỳ sẽ được báo hạn mới.</p>
		<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
			<label for="period-new-deadline" class="sr-only">Hạn chót mới</label>
			<div class="w-48">
				<UiDatePicker id="period-new-deadline" v-model="deadline" :min="today" :error="error" />
			</div>
			<span
				v-if="weekday"
				:class="['text-sm', weekday.weekend ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400']"
			>
				{{ weekday.label }}<template v-if="weekday.weekend"> · cuối tuần</template>
			</span>
		</div>
		<p class="mt-2 text-xs text-gray-600 dark:text-gray-400" aria-live="polite">{{ preview }}</p>
		<template #actions>
			<CommonAppButton variant="secondary" :disabled="saving" @click="emit('close')">Thôi</CommonAppButton>
			<CommonAppButton variant="primary" :loading="saving" :disabled="unchanged" @click="submit">Lưu hạn chót</CommonAppButton>
		</template>
	</OfficeDialog>
</template>
