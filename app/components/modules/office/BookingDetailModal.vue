<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import { bookingDurationLabel, officeErrorCode, officeErrorMessage, vnTimeLabel } from '~/utils/office.utils';
	import { formatDateTime, formatVnWeekdayDate } from '~/utils/date';
	import { personInitials } from '~/utils/avatar';
	import type { BookingPerson, RoomBooking } from '~/types/office.types';

	/**
	 * Chi tiết một lượt đặt phòng: xem, sửa và huỷ.
	 *
	 * Hộp đọc từ trên xuống theo thứ tự người mở cần: lượt gì và đang ở trạng thái nào, họp lúc nào
	 * (khung giờ là chữ lớn nhất), ở phòng nào, ai tham gia, rồi ghi chú. Nút sửa và huỷ nằm riêng ở
	 * chân hộp, nút huỷ tách sang trái để không bấm nhầm.
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

	const panelRef = ref<HTMLElement | null>(null);
	const reasonRef = ref<HTMLInputElement | null>(null);
	const showCancelForm = ref(false);
	const reason = ref('');
	const reasonError = ref('');
	const working = ref(false);

	const reasonRequired = computed(() => !props.mine);
	const cancelled = computed(() => props.booking.status === 'CANCELLED');

	/**
	 * Tiêu đề hộp khi người xem không được đọc nội dung.
	 *
	 * Lượt đã huỷ mà vẫn ghi "Đã có người đặt" thì người xem tưởng phòng còn bị giữ, trong khi nó
	 * đã trống và họ đặt được.
	 */
	const headerTitle = computed(() => {
		if (props.booking.detailsVisible) return props.booking.title;
		return cancelled.value ? 'Lượt riêng tư đã huỷ' : 'Đã có người đặt';
	});

	/** Màu chip trạng thái: huỷ đỏ, đang họp vàng như trên lịch, sắp tới xanh, đã xong xám. */
	const statusCls = computed(() => {
		if (cancelled.value) return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800';
		if (props.booking.timing === 'ONGOING') return 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800';
		if (props.booking.timing === 'ENDED') return 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700';
		return 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-800';
	});

	/** Người đặt khác người chủ trì thì đây là lượt đặt hộ, cần ghi rõ ai đặt. */
	const bookedOnBehalf = computed(() => props.booking.createdBy.id !== props.booking.organizer.id);

	/** Chủ trì đứng đầu, rồi tới người dự; lượt riêng tư của người khác thì chỉ có chủ trì. */
	const people = computed<Array<{ person: BookingPerson; role: string }>>(() => [
		{ person: props.booking.organizer, role: bookedOnBehalf.value ? 'Chủ trì' : 'Chủ trì, người đặt' },
		...(props.booking.detailsVisible
			? props.booking.attendees.filter(person => person.id !== props.booking.organizer.id).map(person => ({ person, role: '' }))
			: []),
	]);

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

	useFocusTrap(panelRef);
	useEscapeKey(
		() => emit('close'),
		() => !working.value,
	);

	function close() {
		if (!working.value) emit('close');
	}

	/** Bấm nền thì đóng, trừ lúc đang ghi lý do huỷ: lỡ tay không làm mất chữ đã gõ. */
	function onBackdrop() {
		if (!showCancelForm.value) close();
	}

	function openCancelForm() {
		showCancelForm.value = true;
		nextTick(() => reasonRef.value?.focus());
	}

	function closeCancelForm() {
		showCancelForm.value = false;
		reason.value = '';
		reasonError.value = '';
	}

	async function cancel() {
		if (working.value) return;
		if (reasonRequired.value && !reason.value.trim()) {
			reasonError.value = 'Bạn ghi lý do khi huỷ lượt của người khác.';
			reasonRef.value?.focus();
			return;
		}
		working.value = true;
		reasonError.value = '';
		try {
			const result = await service.cancelBooking(props.booking.id, {
				reason: reason.value.trim() || undefined,
			});
			toast.success(
				notifiesOthers.value
					? `Đã huỷ lượt họp ở ${result.room.name}. Người liên quan vừa nhận thông báo.`
					: `Đã huỷ lượt họp ở ${result.room.name}.`,
			);
			emit('cancelled', result);
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
	const sectionLabelCls = 'text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400';
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:items-center sm:p-4" @click.self="onBackdrop">
			<div
				ref="panelRef"
				role="dialog"
				aria-modal="true"
				aria-labelledby="booking-detail-title"
				class="my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900"
			>
				<!-- Đầu hộp: trạng thái, riêng tư, rồi tên lượt họp. -->
				<div class="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<span :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', statusCls]">
								<span v-if="booking.timing === 'ONGOING' && !cancelled" class="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
								{{ booking.statusLabel }}
							</span>
							<span
								v-if="booking.isPrivate"
								class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
							>
								<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
									<rect x="5" y="11" width="14" height="10" rx="2" />
									<path stroke-linecap="round" d="M8 11V7a4 4 0 118 0v4" />
								</svg>
								Riêng tư
							</span>
						</div>
						<h2
							id="booking-detail-title"
							:class="[
								'mt-2 text-lg font-semibold leading-snug [overflow-wrap:anywhere]',
								cancelled ? 'text-gray-500 line-through decoration-gray-400 dark:text-gray-400' : 'text-gray-900 dark:text-white',
							]"
						>
							{{ headerTitle }}
						</h2>
					</div>
					<button
						type="button"
						class="-mr-2 -mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:h-9 sm:w-9 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng chi tiết lượt họp"
						@click="close"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="flex-1 space-y-4 overflow-y-auto px-5 pb-5 text-sm">
					<div
						v-if="cancelled"
						role="status"
						class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
					>
						<p class="font-medium">
							Lượt này đã huỷ
							<!-- Không có người huỷ nghĩa là hệ thống tự huỷ, thường vì người chủ trì nghỉ việc. -->
							<template v-if="booking.cancelledBy"> bởi {{ booking.cancelledBy.fullName }}</template>
							<template v-else> tự động</template>
							<template v-if="booking.cancelledAt"> lúc {{ formatDateTime(booking.cancelledAt) }}</template>.
						</p>
						<p v-if="booking.cancelReason" class="mt-1">Lý do: {{ booking.cancelReason }}</p>
					</div>

					<!-- Khung giờ là thứ người mở hộp tìm đầu tiên nên to nhất; phòng nằm ngay dưới. -->
					<div class="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
						<div class="flex items-center gap-3 px-4 py-3">
							<span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400">
								<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<circle cx="12" cy="12" r="9" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2" />
								</svg>
							</span>
							<div class="min-w-0">
								<p class="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
									{{ vnTimeLabel(booking.startAt) }} – {{ vnTimeLabel(booking.endAt) }}
								</p>
								<p class="text-gray-600 dark:text-gray-300">
									{{ formatVnWeekdayDate(booking.startAt) }} · {{ bookingDurationLabel(booking.startAt, booking.endAt) }}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
							<span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400">
								<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7-6.1-7-11.5a7 7 0 1114 0C19 14.9 12 21 12 21z" />
									<circle cx="12" cy="9.5" r="2.5" />
								</svg>
							</span>
							<div class="min-w-0">
								<p class="font-semibold text-gray-900 dark:text-white">{{ booking.room.name }}</p>
								<p class="text-gray-600 dark:text-gray-300">{{ booking.officeSite.name }}</p>
							</div>
						</div>
					</div>

					<section aria-labelledby="booking-detail-people">
						<h3 id="booking-detail-people" :class="sectionLabelCls">
							Người tham gia<template v-if="booking.detailsVisible"> · {{ people.length }}</template>
						</h3>
						<ul class="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
							<li v-for="entry in people" :key="entry.person.id" class="flex items-center gap-3 py-2">
								<span
									:class="[
										'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold',
										entry.person.isActive
											? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
											: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
									]"
									aria-hidden="true"
								>
									{{ personInitials(entry.person.fullName) }}
								</span>
								<span class="min-w-0 flex-1">
									<span :class="entry.person.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'">
										{{ entry.person.fullName }}
									</span>
									<!--
										Ghi rõ ai đã nghỉ việc: không ghi thì người xem thấy một cái tên không còn trong công
										ty mà không hiểu vì sao, và cũng không biết là phải tìm người khác chủ trì.
									-->
									<span v-if="!entry.person.isActive" class="ml-1 text-xs text-gray-500 dark:text-gray-400">(đã nghỉ việc)</span>
								</span>
								<span
									v-if="entry.role"
									class="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
								>
									{{ entry.role }}
								</span>
							</li>
						</ul>
						<p v-if="bookedOnBehalf" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Đặt hộ bởi <span class="font-medium text-gray-700 dark:text-gray-300">{{ booking.createdBy.fullName }}</span>
						</p>
						<p
							v-if="!booking.detailsVisible"
							class="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
						>
							Đây là lượt riêng tư, nên bạn chỉ thấy khung giờ bận và người đặt.
						</p>
					</section>

					<section v-if="booking.detailsVisible && booking.note" aria-labelledby="booking-detail-note">
						<h3 id="booking-detail-note" :class="sectionLabelCls">Ghi chú</h3>
						<p class="mt-2 whitespace-pre-line rounded-lg border-l-4 border-gray-200 bg-gray-50 px-3 py-2 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
							{{ booking.note }}
						</p>
					</section>

					<div v-if="showCancelForm" class="space-y-1 rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-800 dark:bg-rose-900/10">
						<label for="booking-cancel-reason" class="block text-sm font-medium text-gray-800 dark:text-gray-200">
							Lý do huỷ
							<span v-if="reasonRequired" class="text-red-500">*</span>
						</label>
						<input
							id="booking-cancel-reason"
							ref="reasonRef"
							v-model="reason"
							type="text"
							maxlength="500"
							:class="inputCls"
							:aria-invalid="!!reasonError"
							:aria-describedby="reasonError ? 'booking-cancel-reason-error' : undefined"
							placeholder="VD: Họp ban giám đốc dùng phòng này"
							@keydown.enter.prevent="cancel"
						/>
						<p v-if="reasonError" id="booking-cancel-reason-error" class="text-xs text-red-600 dark:text-red-400">{{ reasonError }}</p>
						<p v-else-if="reasonRequired" class="text-xs text-gray-600 dark:text-gray-400">
							Người trong lượt nhận thông báo kèm lý do này.
						</p>
						<p v-else class="text-xs text-gray-600 dark:text-gray-400">Lượt này của bạn nên lý do không bắt buộc.</p>
					</div>
				</div>

				<!-- Chân hộp: huỷ tách sang trái, việc chính bên phải. -->
				<div
					class="flex flex-col-reverse gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 sm:flex-row sm:items-center dark:border-gray-700 dark:bg-gray-900"
				>
					<template v-if="showCancelForm">
						<CommonAppButton variant="ghost" class="min-h-11 sm:min-h-0 sm:mr-auto" :disabled="working" @click="closeCancelForm">
							Không huỷ nữa
						</CommonAppButton>
						<CommonAppButton variant="danger" class="min-h-11 sm:min-h-0" :loading="working" @click="cancel">
							Xác nhận huỷ
						</CommonAppButton>
					</template>
					<template v-else>
						<!--
							Nút Huỷ đi theo `canCancel`, không theo `canEdit`: khi phân hệ hết hạn và chuyển sang
							chỉ xem thì không ai sửa được lượt nữa, nhưng người đã đặt vẫn phải huỷ được để
							nhường phòng cho người khác.
						-->
						<CommonAppButton
							v-if="booking.canCancel && !cancelled"
							variant="danger_outline"
							class="min-h-11 sm:min-h-0 sm:mr-auto"
							@click="openCancelForm"
						>
							Huỷ lượt
						</CommonAppButton>
						<CommonAppButton variant="secondary" class="min-h-11 sm:ml-auto sm:min-h-0" @click="close">Đóng</CommonAppButton>
						<CommonAppButton
							v-if="booking.canEdit && !cancelled"
							variant="primary"
							class="min-h-11 sm:min-h-0"
							@click="emit('edit')"
						>
							Sửa, dời giờ
						</CommonAppButton>
					</template>
				</div>
			</div>
		</div>
	</Teleport>
</template>
