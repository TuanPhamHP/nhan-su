<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import { officeErrorCode, officeErrorMessage, vnTimeLabel } from '~/utils/office.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { RoomBooking } from '~/types/office.types';

	/**
	 * Chi tiết một lượt đặt phòng: xem, sửa và huỷ.
	 *
	 * Huỷ lượt CỦA NGƯỜI KHÁC thì lý do là bắt buộc, vì người bị huỷ chỉ nhận được một thông báo và
	 * cần biết vì sao mất phòng. Tự huỷ lượt của mình thì không cần giải thích với chính mình.
	 */
	const props = defineProps<{
		booking: RoomBooking;
		/** Người đang xem có phải người đặt hoặc người chủ trì; dùng để biết lý do huỷ có bắt buộc. */
		mine: boolean;
	}>();

	const emit = defineEmits<{
		cancelled: [booking: RoomBooking];
		edit: [];
		close: [];
	}>();

	const toast = useToast();
	const service = useOfficeService();
	const { user } = useAuth();

	const showCancelForm = ref(false);
	const reason = ref('');
	const reasonError = ref('');
	const working = ref(false);

	const reasonRequired = computed(() => !props.mine);

	/**
	 * Tiêu đề hộp khi người xem không được đọc nội dung.
	 *
	 * Lượt đã huỷ mà vẫn ghi "Đã có người đặt" thì người xem tưởng phòng còn bị giữ, trong khi nó
	 * đã trống và họ đặt được.
	 */
	const headerTitle = computed(() => {
		if (props.booking.detailsVisible) return props.booking.title;
		return props.booking.status === 'CANCELLED' ? 'Lượt riêng tư đã huỷ' : 'Đã có người đặt';
	});

	/**
	 * Huỷ xong có ai khác nhận thông báo hay không.
	 *
	 * Tự huỷ lượt một mình mà màn hình nói "Người liên quan vừa nhận thông báo" là nói sai: không
	 * có ai khác trong lượt đó cả, và người dùng đi hỏi đồng nghiệp xem họ có nhận gì không.
	 */
	const notifiesOthers = computed(() => {
		const me = user.value?.id;
		const others = [props.booking.organizer.id, props.booking.createdBy.id, ...props.booking.attendees.map(a => a.id)];
		return others.some(id => id !== me);
	});

	/**
	 * Tên người trong lượt, ghi rõ ai đã nghỉ việc.
	 *
	 * Không ghi thì người xem thấy một cái tên không còn trong công ty mà không hiểu vì sao, và
	 * cũng không biết là phải tìm người khác chủ trì.
	 */
	function personLabel(person: { fullName: string; isActive: boolean }): string {
		return person.isActive ? person.fullName : `${person.fullName} (đã nghỉ việc)`;
	}

	useEscapeKey(
		() => emit('close'),
		() => !working.value,
	);

	async function cancel() {
		if (working.value) return;
		if (reasonRequired.value && !reason.value.trim()) {
			reasonError.value = 'Bạn ghi lý do khi huỷ lượt của người khác.';
			return;
		}
		working.value = true;
		reasonError.value = '';
		try {
			const cancelled = await service.cancelBooking(props.booking.id, {
				reason: reason.value.trim() || undefined,
			});
			toast.success(
				notifiesOthers.value
					? `Đã huỷ lượt họp ở ${cancelled.room.name}. Người liên quan vừa nhận thông báo.`
					: `Đã huỷ lượt họp ở ${cancelled.room.name}.`,
			);
			emit('cancelled', cancelled);
		} catch (e) {
			if (officeErrorCode(e) === 'OFFICE_ROOM_BOOKING_REASON_REQUIRED') {
				reasonError.value = officeErrorMessage(e, 'Bạn ghi lý do khi huỷ lượt của người khác.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa huỷ được lượt họp. Bạn thử lại sau ít phút.'));
			}
		} finally {
			working.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-label="Chi tiết lượt đặt phòng họp"
		>
			<div class="my-4 w-full max-w-lg rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ headerTitle }}</h2>
						<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							{{ booking.room.name }} · {{ booking.officeSite.name }}
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng chi tiết lượt họp"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="space-y-3 p-4 text-sm sm:p-6">
					<p class="text-gray-900 dark:text-white">
						{{ formatDate(booking.startAt) }} · {{ vnTimeLabel(booking.startAt) }} đến
						{{ vnTimeLabel(booking.endAt) }}
					</p>
					<p class="text-gray-600 dark:text-gray-300">Người đặt: {{ booking.createdBy.fullName }}</p>
					<p class="text-gray-600 dark:text-gray-300">Chủ trì: {{ personLabel(booking.organizer) }}</p>
					<p v-if="booking.detailsVisible && booking.attendees.length" class="text-gray-600 dark:text-gray-300">
						Người dự: {{ booking.attendees.map(personLabel).join(', ') }}
					</p>
					<p v-if="booking.detailsVisible && booking.note" class="text-gray-600 dark:text-gray-300">
						Ghi chú: {{ booking.note }}
					</p>
					<p v-if="!booking.detailsVisible" class="rounded-lg bg-gray-50 px-3 py-2 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
						Đây là lượt riêng tư, nên bạn chỉ thấy khung giờ bận và người đặt.
					</p>
					<p v-if="booking.status === 'CANCELLED'" class="rounded-lg bg-rose-50 px-3 py-2 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						Lượt này đã huỷ
						<!-- Không có người huỷ nghĩa là hệ thống tự huỷ, thường vì người chủ trì nghỉ việc. -->
						<template v-if="booking.cancelledBy"> bởi {{ booking.cancelledBy.fullName }}</template>
						<template v-else> tự động</template>
						<template v-if="booking.cancelledAt"> lúc {{ formatDateTime(booking.cancelledAt) }}</template>.
						<template v-if="booking.cancelReason"> Lý do: {{ booking.cancelReason }}</template>
					</p>

					<div v-if="showCancelForm" class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Lý do huỷ
							<span v-if="reasonRequired" class="text-red-500">*</span>
						</label>
						<input v-model="reason" type="text" maxlength="500" :class="inputCls" placeholder="VD: Họp ban giám đốc dùng phòng này" />
						<p v-if="reasonError" class="text-xs text-red-500">{{ reasonError }}</p>
						<p v-else-if="!reasonRequired" class="text-xs text-gray-500 dark:text-gray-400">
							Lượt này của bạn nên lý do không bắt buộc.
						</p>
					</div>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" class="min-h-11 sm:min-h-0" @click="emit('close')">Đóng</CommonAppButton>
						<CommonAppButton
							v-if="booking.canEdit && booking.status !== 'CANCELLED'"
							variant="outline"
							class="min-h-11 sm:min-h-0"
							@click="emit('edit')"
						>
							Sửa, dời giờ
						</CommonAppButton>
						<!--
							Nút Huỷ đi theo `canCancel`, không theo `canEdit`: khi phân hệ hết hạn và chuyển sang
							chỉ xem thì không ai sửa được lượt nữa, nhưng người đã đặt vẫn phải huỷ được để
							nhường phòng cho người khác.
						-->
						<CommonAppButton
							v-if="booking.canCancel && booking.status !== 'CANCELLED' && !showCancelForm"
							variant="danger_outline"
							class="min-h-11 sm:min-h-0"
							@click="showCancelForm = true"
						>
							Huỷ lượt
						</CommonAppButton>
						<CommonAppButton
							v-if="showCancelForm"
							variant="danger"
							class="min-h-11 sm:min-h-0"
							:loading="working"
							@click="cancel"
						>
							Xác nhận huỷ
						</CommonAppButton>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
