<script setup lang="ts">
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import { useOfficeService } from '~/services/office.service';
	import {
		addMinutesToHhmm,
		officeErrorCode,
		officeErrorMessage,
		vnDateTimeToIso,
		vnDateYmd,
		vnTimeLabel,
	} from '~/utils/office.utils';
	import { formatDate } from '~/utils/date';
	import type { MeetingRoom, RoomBooking } from '~/types/office.types';

	/**
	 * Đặt phòng họp, và sửa một lượt đã đặt (dời giờ, đổi phòng, đổi người dự).
	 *
	 * Giờ gửi lên máy chủ là ISO UTC dựng từ ngày và giờ VIỆT NAM đang chọn, không qua múi giờ của
	 * máy: người đặt lịch ở máy đặt sai múi giờ vẫn phải ra đúng khung giờ mà cả phòng nhìn thấy.
	 *
	 * Giờ kết thúc mặc định là giờ bắt đầu cộng 60 phút, vì phần lớn cuộc họp dài một tiếng.
	 */
	const props = defineProps<{
		/** Ngày đang xem trên lưới, dạng `YYYY-MM-DD` giờ Việt Nam. */
		date: string;
		rooms: MeetingRoom[];
		/** Phòng và giờ người dùng vừa bấm trên lưới. */
		roomId?: number;
		startHhmm?: string;
		/** Lượt đang sửa; bỏ trống là đặt mới. */
		booking?: RoomBooking | null;
	}>();

	const emit = defineEmits<{
		saved: [booking: RoomBooking];
		/** Trùng giờ: hộp ở lại, nhưng lịch phía sau phải tải lại để thấy ai vừa giữ phòng. */
		reload: [];
		close: [];
	}>();

	const toast = useToast();
	const service = useOfficeService();
	const { user } = useAuth();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const editing = computed(() => !!props.booking);

	/**
	 * Lượt riêng tư mà người đang sửa không được thấy nội dung (kể cả HCNS, theo Q3).
	 *
	 * Form lúc đó chỉ còn phòng và giờ: gửi kèm tiêu đề, ghi chú, chủ trì hay người dự thì máy chủ
	 * trả 403, mà đó cũng đúng tinh thần — người không được đọc nội dung thì không sửa nội dung.
	 */
	const restricted = computed(() => editing.value && props.booking?.detailsVisible === false);

	/** Lượt đang diễn ra chỉ đổi được giờ kết thúc, giờ bắt đầu phải giữ nguyên. */
	const inProgress = computed(() => {
		const booking = props.booking;
		if (!booking) return false;
		const now = Date.now();
		return new Date(booking.startAt).getTime() <= now && new Date(booking.endAt).getTime() > now;
	});

	const roomId = ref<number | undefined>(props.booking?.room.id ?? props.roomId ?? props.rooms[0]?.id);
	/**
	 * Ngày của lượt đang sửa, KHÔNG phải ngày đang xem trên lịch.
	 *
	 * Lấy ngày của lịch là lỗi nặng nhất của đợt UAT: người dùng mở một lượt của ngày mai từ Lịch
	 * của tôi, chỉ đổi giờ kết thúc rồi Lưu, và cuộc họp nhảy về hôm nay vì ô Ngày đã điền sẵn hôm
	 * nay; người dự nhận thông báo ghi ngày sai mà không ai kịp nhận ra.
	 */
	const date = ref(props.booking ? vnDateYmd(props.booking.startAt) : props.date);
	const startHhmm = ref(props.booking ? vnTimeLabel(props.booking.startAt) : (props.startHhmm ?? '09:00'));
	const endHhmm = ref(
		props.booking
			? vnTimeLabel(props.booking.endAt)
			: addMinutesToHhmm(props.startHhmm ?? '09:00', 60),
	);
	const title = ref(props.booking?.title ?? '');
	const note = ref(props.booking?.note ?? '');
	const isPrivate = ref(props.booking?.isPrivate ?? false);
	// Khi sửa thì luôn điền sẵn chủ trì hiện tại, kể cả khi đó là chính mình: người sửa cần thấy ai
	// đang chủ trì trước khi đổi. Khi đặt mới thì để trống nghĩa là "tôi chủ trì".
	const organizerIds = ref<number[]>(props.booking ? [props.booking.organizer.id] : []);
	const attendeeIds = ref<number[]>(props.booking?.attendees.map(a => a.id) ?? []);

	const timeError = ref('');
	const titleError = ref('');
	const saving = ref(false);

	/**
	 * Ô chọn phòng nói luôn sức chứa và thiết bị.
	 *
	 * Người đặt phòng chọn theo "có máy chiếu không" và "đủ chỗ cho mấy người", mà hai thứ đó máy
	 * chủ đã gửi kèm; không hiện ra thì họ phải mở trang cài đặt hoặc đi hỏi HCNS.
	 */
	const roomOptions = computed(() =>
		props.rooms.map(room => {
			const parts = [room.name];
			if (room.capacity != null) parts.push(`${room.capacity} người`);
			if (room.equipment?.length) parts.push(room.equipment.join(', '));
			return { value: room.id, label: parts.join(' · ') };
		}),
	);

	/**
	 * Người chọn được: nhân viên đang làm, cộng những người đã có trong lượt.
	 *
	 * Người đã nghỉ việc vẫn phải hiện tên kèm "(đã nghỉ việc)", nếu không ô chọn sẽ ghi "Không rõ
	 * tên người này" ở chính lượt họp mà họ đang là chủ trì.
	 */
	const people = computed<PickablePerson[]>(() => {
		const list: PickablePerson[] = employees.value
			.filter(e => e.status === 'ACTIVE')
			.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode }));
		const byId = new Map(list.map(person => [person.id, person]));
		const inBooking = props.booking ? [props.booking.organizer, ...props.booking.attendees] : [];
		for (const person of inBooking) {
			// Người đã nghỉ việc phải ghi rõ ngay trên tên, kể cả khi họ vẫn còn trong danh sách
			// nhân viên đang tải: ô chọn chỉ hiện tên, nên "(đã nghỉ việc)" nằm ở chú thích thì
			// người sửa lượt họp không thấy và cứ tưởng mời lại được.
			if (person.isActive) {
				if (!byId.has(person.id)) {
					byId.set(person.id, { id: person.id, fullName: person.fullName, hint: null });
				}
				continue;
			}
			byId.set(person.id, {
				id: person.id,
				fullName: `${person.fullName} (đã nghỉ việc)`,
				hint: 'đã nghỉ việc nên không mời lại được',
			});
		}
		return [...byId.values()];
	});

	onMounted(() => {
		directoryStore.load().catch(() => {
			toast.error('Chưa tải được danh sách nhân viên, nên tạm thời chưa mời người dự được.');
		});
	});

	useEscapeKey(
		() => emit('close'),
		() => !saving.value,
	);

	/** Người dùng vừa sửa phòng, ngày hay giờ thì câu lỗi cũ hết đúng, nên bỏ đi. */
	watch([roomId, date, startHhmm, endHhmm], () => {
		timeError.value = '';
	});

	/** Giờ bắt đầu đổi thì giờ kết thúc chạy theo, trừ khi người dùng đã tự đặt giờ muộn hơn. */
	watch(startHhmm, (next, previous) => {
		if (endHhmm.value === addMinutesToHhmm(previous, 60) || endHhmm.value <= next) {
			endHhmm.value = addMinutesToHhmm(next, 60);
		}
	});

	/** Nút Lưu luôn bấm được: nút xám không nói thiếu gì thì người dùng chỉ biết là nó không chạy. */
	async function submit() {
		if (saving.value) return;
		titleError.value = '';
		if (!roomId.value) {
			timeError.value = 'Bạn chọn phòng họp.';
			return;
		}
		if (!restricted.value && !title.value.trim()) {
			titleError.value = 'Bạn ghi tiêu đề cuộc họp, ví dụ Họp giao ban.';
			return;
		}
		if (endHhmm.value <= startHhmm.value) {
			timeError.value = 'Giờ kết thúc phải sau giờ bắt đầu.';
			return;
		}
		saving.value = true;
		timeError.value = '';
		const startAt = vnDateTimeToIso(date.value, startHhmm.value);
		const endAt = vnDateTimeToIso(date.value, endHhmm.value);
		try {
			const saved = props.booking
				? await service.updateBooking(
						props.booking.id,
						restricted.value
							? // Lượt riêng tư người sửa không thấy nội dung: chỉ gửi phòng và giờ.
								{ roomId: roomId.value, startAt, endAt }
							: {
									roomId: roomId.value,
									startAt,
									endAt,
									title: title.value.trim(),
									// Chuỗi rỗng là xoá ghi chú, đúng như hợp đồng.
									note: note.value.trim(),
									isPrivate: isPrivate.value,
									organizerId: organizerIds.value[0],
									attendeeIds: attendeeIds.value,
								},
					)
				: await service.createBooking({
						roomId: roomId.value,
						startAt,
						endAt,
						title: title.value.trim(),
						note: note.value.trim() || undefined,
						isPrivate: isPrivate.value,
						organizerId: organizerIds.value[0],
						attendeeIds: attendeeIds.value.length ? attendeeIds.value : undefined,
					});
			// Câu phải có NGÀY: dời giờ một lượt của ngày khác mà toast chỉ nói "từ 09:00 đến 10:00"
			// thì người dùng không có cách nào thấy lượt vừa lưu đúng ngày hay không.
			const when = `từ ${vnTimeLabel(saved.startAt)} đến ${vnTimeLabel(saved.endAt)} ngày ${formatDate(saved.startAt)}`;
			toast.success(
				editing.value
					? `Đã lưu lượt họp ở ${saved.room.name}, ${when}.`
					: `Đã đặt ${saved.room.name} ${when}.`,
			);
			emit('saved', saved);
		} catch (e) {
			const code = officeErrorCode(e);
			// Lỗi về giờ thì để ngay dưới ô giờ và GIỮ HỘP MỞ với mọi thứ người dùng đã gõ. Đóng
			// hộp như trước là bắt họ nhập lại tiêu đề, người dự, ghi chú chỉ vì chọn sai một khung
			// giờ; lịch phía sau vẫn được tải lại để họ thấy ai đang giữ phòng.
			if (code === 'OFFICE_ROOM_BOOKING_INVALID_TIME' || code === 'OFFICE_ROOM_BOOKING_CONFLICT') {
				timeError.value = officeErrorMessage(e, 'Giờ này không đặt được.');
				if (code === 'OFFICE_ROOM_BOOKING_CONFLICT') emit('reload');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa đặt được phòng. Bạn thử lại sau ít phút.'));
				if (code === 'OFFICE_ROOM_INACTIVE') emit('close');
			}
		} finally {
			saving.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4"
			role="dialog"
			aria-modal="true"
			:aria-label="editing ? 'Sửa lượt đặt phòng họp' : 'Đặt phòng họp'"
		>
			<div class="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ editing ? 'Sửa lượt họp' : 'Đặt phòng họp' }}
						</h2>
						<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							Không có bước duyệt: lưu xong là phòng đã được giữ. Mỗi lượt dài tối đa 12 giờ và đặt trước tối đa
							180 ngày.
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp đặt phòng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-5 p-4 sm:p-6" @submit.prevent="submit">
					<p
						v-if="restricted"
						class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300"
					>
						Đây là lượt riêng tư nên bạn không xem được nội dung. Bạn chỉ đổi được phòng và giờ; tiêu đề, người
						chủ trì và người dự do người trong cuộc họp tự sửa.
					</p>

					<div v-if="!restricted" class="space-y-1">
						<label :class="labelCls">Tiêu đề <span class="text-red-500">*</span></label>
						<input
							v-model="title"
							type="text"
							maxlength="200"
							:class="inputCls"
							placeholder="VD: Họp giao ban"
							@input="titleError = ''"
						/>
						<p v-if="titleError" class="text-xs text-red-500">{{ titleError }}</p>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">Phòng <span class="text-red-500">*</span></label>
							<UiSelect v-model="roomId" :options="roomOptions" placeholder="Chọn phòng" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Ngày <span class="text-red-500">*</span></label>
							<UiDatePicker v-model="date" :disabled="inProgress" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Giờ bắt đầu <span class="text-red-500">*</span></label>
							<!-- Cuộc họp đang diễn ra không dời được giờ bắt đầu, chỉ kéo dài hay kết thúc sớm. -->
							<UiTimeInput v-model="startHhmm" :minute-step="5" :disabled="inProgress" />
							<p v-if="inProgress" class="text-xs text-gray-500 dark:text-gray-400">
								Cuộc họp đang diễn ra nên giờ bắt đầu giữ nguyên.
							</p>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Giờ kết thúc <span class="text-red-500">*</span></label>
							<UiTimeInput v-model="endHhmm" :minute-step="5" />
						</div>

						<!--
							Câu lỗi về giờ nằm ngang hết hai ô, không nhét dưới ô Giờ kết thúc: câu "Không
							đặt được giờ đã qua" hay câu trùng giờ của máy chủ nói về cả khung giờ, mà đặt
							dưới một ô thì người đọc đi sửa đúng ô đó.
						-->
						<p v-if="timeError" class="text-sm text-red-500 sm:col-span-2">{{ timeError }}</p>
					</div>

					<template v-if="!restricted">
						<div class="space-y-1">
							<label :class="labelCls">Ghi chú</label>
							<input v-model="note" type="text" maxlength="500" :class="inputCls" placeholder="VD: Chuẩn bị số liệu tháng 11" />
						</div>

						<EmployeePicker
							v-model="organizerIds"
							:people="people"
							label="Người chủ trì"
							single
							:placeholder="editing ? 'Gõ tên người chủ trì mới' : 'Gõ tên nếu bạn đặt hộ người khác'"
							:hint="
								editing
									? 'Đổi chủ trì thì chủ trì cũ và chủ trì mới đều nhận thông báo.'
									: 'Bỏ trống thì chính bạn là người chủ trì.'
							"
						/>

						<EmployeePicker
							v-model="attendeeIds"
							:people="people"
							label="Người dự"
							placeholder="Gõ tên để mời người dự"
							hint="Người dự nhận thông báo và thấy lượt này trong Lịch của tôi."
						/>

						<label class="flex items-start gap-2">
							<input v-model="isPrivate" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							<span class="text-sm text-gray-700 dark:text-gray-300">
								Lượt riêng tư — chỉ người đặt, người chủ trì và người dự thấy nội dung; người khác chỉ thấy khung
								giờ bận và tên người đặt.
							</span>
						</label>
					</template>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" @click="emit('close')">
							Đóng
						</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" class="min-h-11 sm:min-h-0" :loading="saving">
							{{ editing ? 'Lưu lượt họp' : 'Đặt phòng' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
