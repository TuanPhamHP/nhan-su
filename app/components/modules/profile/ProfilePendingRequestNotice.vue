<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import { useMeProfileService } from '~/services/me-profile.service';
	import type { MyProfileChange } from '~/types/hr-profile.types';

	/**
	 * Dòng nhắc "đang chờ duyệt" đặt ngay dưới khối thông tin liên quan.
	 *
	 * Đặt ở đây thay vì chỉ trong tab Yêu cầu của tôi, để người vừa gửi đề nghị thấy ngay là
	 * hệ thống đã nhận, và biết giá trị cũ vẫn đang có hiệu lực.
	 */
	const props = defineProps<{
		request: MyProfileChange;
	}>();

	const emit = defineEmits<{
		cancelled: [];
	}>();

	const toast = useToast();
	const service = useMeProfileService();
	const cancelling = ref(false);

	async function cancel() {
		cancelling.value = true;
		try {
			await service.cancelChangeRequest(props.request.id);
			toast.success('Đã thu hồi đề nghị.');
			emit('cancelled');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa thu hồi được đề nghị này.');
		} finally {
			cancelling.value = false;
		}
	}
</script>

<template>
	<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<p class="text-sm font-medium text-amber-800 dark:text-amber-200">
					Đang chờ phòng nhân sự duyệt · yêu cầu số {{ request.id }}
				</p>
				<ul class="mt-1 space-y-0.5">
					<li v-for="field in request.fields" :key="field.key" class="text-xs text-amber-700 dark:text-amber-300">
						{{ field.label }}: {{ field.before ?? '—' }} → {{ field.after ?? '—' }}
					</li>
				</ul>
				<p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
					Gửi lúc {{ formatDateTime(request.createdAt) }}
				</p>
			</div>
			<CommonAppButton size="sm" variant="outline" :loading="cancelling" @click="cancel">Thu hồi</CommonAppButton>
		</div>
	</div>
</template>
