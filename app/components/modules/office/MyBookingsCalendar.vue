<script setup lang="ts">
	import {
		addDaysYmd,
		addMonthsYmd,
		bookingHourRange,
		isHourPast,
		layoutDayEvents,
		monthGridDaysYmd,
		splitBookingsByDay,
		vnMinutesOfDay,
		vnTimeLabel,
		weekDaysYmd,
		weekRangeLabel,
	} from '~/utils/office.utils';
	import { formatDate, todayYmd } from '~/utils/date';
	import type { RoomBooking } from '~/types/office.types';

	/**
	 * Lịch của tôi theo kiểu Google Calendar: chế độ Ngày và Tuần là lưới giờ dọc, chế độ Tháng là
	 * lưới ô ngày.
	 *
	 * Component chỉ vẽ và báo lên: khoảng ngày đang xem đổi thì phát `range` để trang tải lượt của
	 * khoảng đó, bấm lượt thì phát `open`, bấm chỗ trống thì phát `create`. Trang giữ việc gọi máy
	 * chủ và các hộp đặt phòng, xem chi tiết.
	 */
	const props = defineProps<{
		bookings: RoomBooking[];
		loading: boolean;
		/** Còn đặt được phòng: phân hệ ghi được và văn phòng có phòng họp. */
		canBook: boolean;
		now: Date;
	}>();

	const emit = defineEmits<{
		range: [from: string, to: string];
		open: [booking: RoomBooking];
		create: [day: string, hour: number];
	}>();

	type MineView = 'day' | 'week' | 'month';
	const VIEWS: Array<{ id: MineView; label: string }> = [
		{ id: 'day', label: 'Ngày' },
		{ id: 'week', label: 'Tuần' },
		{ id: 'month', label: 'Tháng' },
	];
	const VIEW_KEY = 'office.rooms.mineView';
	const NAV_LABELS: Record<MineView, { prev: string; current: string; next: string }> = {
		day: { prev: 'Ngày trước', current: 'Hôm nay', next: 'Ngày sau' },
		week: { prev: 'Tuần trước', current: 'Tuần này', next: 'Tuần sau' },
		month: { prev: 'Tháng trước', current: 'Tháng này', next: 'Tháng sau' },
	};
	const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
	/** Chiều cao một giờ trên lưới giờ: 48 pixel thì lượt nửa tiếng vẫn đủ chỗ cho một dòng chữ. */
	const HOUR_PX = 48;
	/** Ô ngày của chế độ Tháng in tối đa ngần này lượt, phần còn lại gom thành "+N khác". */
	const MONTH_CHIPS = 3;
	const DEFAULT_HOURS = { startHour: 7, endHour: 20 };

	const view = ref<MineView>('week');
	const anchor = ref(todayYmd());

	const today = computed(() => todayYmd());

	/** Các ngày đang vẽ: một ngày, bảy ngày, hoặc bốn tới sáu tuần trọn của tháng. */
	const days = computed(() => {
		if (view.value === 'day') return [anchor.value];
		if (view.value === 'week') return weekDaysYmd(anchor.value);
		return monthGridDaysYmd(anchor.value);
	});

	const anchorMonth = computed(() => anchor.value.slice(0, 7));

	/** Lượt của từng ngày đang vẽ, đã bỏ lượt huỷ và xếp theo giờ bắt đầu. */
	const perDay = computed(() => {
		const split = splitBookingsByDay(props.bookings, days.value);
		return days.value.map((day, i) => ({ day, bookings: split[i] ?? [] }));
	});

	const shownCount = computed(() => perDay.value.reduce((sum, d) => sum + d.bookings.length, 0));

	const rangeLabel = computed(() => {
		if (view.value === 'day') return formatDate(anchor.value, 'EEEE, dd/MM/yyyy');
		if (view.value === 'week') return weekRangeLabel(days.value);
		return formatDate(anchor.value, 'MMMM, yyyy');
	});

	/** Dải giờ của lưới giờ: 7h tới 20h, nới ra khi có lượt sớm hơn hay muộn hơn. */
	const hourRange = computed(() =>
		bookingHourRange(
			perDay.value.flatMap(d => d.bookings),
			DEFAULT_HOURS,
		),
	);

	const hours = computed(() =>
		Array.from({ length: hourRange.value.end - hourRange.value.start }, (_, i) => hourRange.value.start + i),
	);

	/** Cột của lưới giờ, mỗi lượt đã có vị trí dọc và cột con khi chồng giờ. */
	const timeColumns = computed(() =>
		perDay.value.map(d => ({
			day: d.day,
			events: layoutDayEvents(d.bookings).map(slot => {
				// Lượt rất ngắn vẫn cao tối thiểu 20 pixel để bấm trúng và đọc được giờ.
				const height = Math.max(((slot.endMin - slot.startMin) / 60) * HOUR_PX - 2, 20);
				return {
					...slot,
					style: {
						top: `${((slot.startMin - hourRange.value.start * 60) / 60) * HOUR_PX}px`,
						height: `${height}px`,
						left: `calc(${(slot.column / slot.columns) * 100}% + 2px)`,
						width: `calc(${100 / slot.columns}% - 4px)`,
					},
					lines: eventLines(height),
				};
			}),
		})),
	);

	/** Vạch giờ hiện tại trong cột hôm nay, tính bằng pixel từ mép trên; `null` là không vẽ. */
	const nowTop = computed(() => {
		const minutes = vnMinutesOfDay(props.now) - hourRange.value.start * 60;
		const span = (hourRange.value.end - hourRange.value.start) * 60;
		if (minutes < 0 || minutes > span) return null;
		return (minutes / 60) * HOUR_PX;
	});

	/** Ô ngày của chế độ Tháng, chia theo tuần để mỗi tuần là một dòng. */
	const monthWeeks = computed(() => {
		const weeks: Array<typeof perDay.value> = [];
		for (let i = 0; i < perDay.value.length; i += 7) weeks.push(perDay.value.slice(i, i + 7));
		return weeks;
	});

	function readSavedView(): MineView | null {
		if (!import.meta.client) return null;
		try {
			const saved = localStorage.getItem(VIEW_KEY);
			return saved === 'day' || saved === 'week' || saved === 'month' ? saved : null;
		} catch {
			// Chế độ ẩn danh hoặc site data bị chặn: dùng chế độ mặc định.
			return null;
		}
	}

	function rememberView(value: MineView) {
		if (!import.meta.client) return;
		try {
			localStorage.setItem(VIEW_KEY, value);
		} catch {
			// Không ghi được thì thôi, đây chỉ là tiện ích.
		}
	}

	function shift(direction: 1 | -1) {
		if (view.value === 'month') anchor.value = addMonthsYmd(anchor.value, direction);
		else anchor.value = addDaysYmd(anchor.value, direction * (view.value === 'week' ? 7 : 1));
	}

	/** Bấm số ngày ở chế độ Tuần hay Tháng thì mở ngày đó theo từng giờ, như Google Calendar. */
	function openDay(day: string) {
		anchor.value = day;
		view.value = 'day';
	}

	/**
	 * Số dòng chữ một khối lượt in được mà không bị cắt ngang, mỗi dòng 16 pixel cộng đệm trên.
	 *
	 * Chia theo chiều cao thật chứ không theo thời lượng ước chừng: lượt một tiếng chỉ cao 46 pixel,
	 * in đủ ba dòng tiêu đề, giờ, phòng thì dòng phòng bị cắt đôi. Ít chỗ thì gộp giờ và phòng vào
	 * một dòng, ít hơn nữa thì chỉ còn tiêu đề và giờ bắt đầu.
	 */
	function eventLines(height: number): 1 | 2 | 3 {
		if (height >= 54) return 3;
		if (height >= 36) return 2;
		return 1;
	}

	function hourLabel(hour: number): string {
		return `${String(hour).padStart(2, '0')}:00`;
	}

	function bookingTitle(booking: RoomBooking): string {
		return booking.detailsVisible ? (booking.title ?? '') : 'Lượt riêng tư';
	}

	function bookingLabel(booking: RoomBooking): string {
		return `${vnTimeLabel(booking.startAt)}–${vnTimeLabel(booking.endAt)} · ${bookingTitle(booking)} · ${booking.room.name}`;
	}

	/** Màu một lượt: đang họp màu hổ phách, lượt riêng tư màu xám, còn lại màu thương hiệu. */
	function eventClass(booking: RoomBooking): string {
		const tone = !booking.detailsVisible
			? 'border-gray-600 bg-gray-400/90 hover:bg-gray-500'
			: booking.timing === 'ONGOING'
				? 'border-amber-700 bg-amber-500/90 hover:bg-amber-600'
				: 'border-brand-700 bg-brand-500/90 hover:bg-brand-600 dark:border-brand-300';
		return `${tone} ${booking.timing === 'ENDED' ? 'opacity-60' : ''}`;
	}

	function dotClass(booking: RoomBooking): string {
		if (!booking.detailsVisible) return 'bg-gray-400';
		return booking.timing === 'ONGOING' ? 'bg-amber-500' : 'bg-brand-500';
	}

	/** Ngày còn đặt được: chưa qua, và hôm nay thì chưa qua giờ cuối của lịch. */
	function dayOpen(day: string): boolean {
		return props.canBook && !isHourPast(day, hourRange.value.end - 1, props.now);
	}

	/** Bấm chỗ trống trên cột ngày của lưới giờ: mở hộp đặt phòng đúng giờ vừa bấm. */
	function onColumnClick(day: string, event: MouseEvent) {
		if (!props.canBook) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const hour = hourRange.value.start + Math.floor((event.clientY - rect.top) / HOUR_PX);
		if (hour >= hourRange.value.end || isHourPast(day, hour, props.now)) return;
		emit('create', day, hour);
	}

	/**
	 * Bấm ô ngày của chế độ Tháng thì mở tuần chứa ngày đó: ô tháng chỉ in được vài dòng, còn lưới
	 * tuần cho thấy cả giờ lẫn những ngày quanh nó. Bấm thẳng vào một cuộc họp thì chỉ mở hộp chi
	 * tiết, không đổi chế độ xem.
	 */
	function openWeek(day: string) {
		anchor.value = day;
		view.value = 'week';
	}

	onMounted(() => {
		const saved = readSavedView();
		if (saved) view.value = saved;
	});

	watch(view, rememberView);

	watch(
		() => `${days.value[0]}|${days.value[days.value.length - 1]}`,
		() => {
			const first = days.value[0];
			const last = days.value[days.value.length - 1];
			if (first && last) emit('range', first, last);
		},
		{ immediate: true },
	);
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
		<!-- Thanh điều hướng: cùng bố cục với khung Lịch phòng để hai thẻ đọc như một trang. -->
		<div class="space-y-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<h2 class="text-base font-semibold text-gray-900 first-letter:uppercase dark:text-white">
						{{ rangeLabel }}
					</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Cuộc họp bạn đặt, chủ trì hoặc được mời ·
						<template v-if="loading">đang tải…</template>
						<template v-else-if="shownCount">{{ shownCount }} cuộc họp</template>
						<template v-else>chưa có cuộc họp nào</template>
					</p>
				</div>

				<div class="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700" role="group" aria-label="Chế độ xem">
					<button
						v-for="option in VIEWS"
						:key="option.id"
						type="button"
						:aria-pressed="view === option.id"
						:class="[
							'rounded-md px-3 py-1 text-sm font-medium transition-colors',
							view === option.id
								? 'bg-brand-600 text-white dark:bg-brand-500'
								: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
						]"
						@click="view = option.id"
					>
						{{ option.label }}
					</button>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2">
				<button
					type="button"
					class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
					:aria-label="NAV_LABELS[view].prev"
					:title="NAV_LABELS[view].prev"
					@click="shift(-1)"
				>
					<Icon name="heroicons:chevron-left" class="h-5 w-5" />
				</button>
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center rounded-lg bg-brand-600 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
					@click="anchor = today"
				>
					{{ NAV_LABELS[view].current }}
				</button>
				<button
					type="button"
					class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
					:aria-label="NAV_LABELS[view].next"
					:title="NAV_LABELS[view].next"
					@click="shift(1)"
				>
					<Icon name="heroicons:chevron-right" class="h-5 w-5" />
				</button>
			</div>
		</div>

		<!-- ── Ngày và Tuần: lưới giờ dọc ── -->
		<div v-if="view !== 'month'" :class="['overflow-x-auto transition-opacity', loading ? 'opacity-60' : '']">
			<div :class="['pr-2 pb-3', view === 'week' ? 'min-w-[720px]' : '']">
				<!-- Tên ngày. Bấm vào ở chế độ Tuần thì mở ngày đó. -->
				<div class="flex border-b border-gray-200 py-2 dark:border-gray-700">
					<div class="w-14 flex-shrink-0" />
					<div class="grid flex-1" :style="{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }">
						<button
							v-for="day in days"
							:key="day"
							type="button"
							:disabled="view === 'day'"
							class="group flex flex-col items-center rounded-lg py-1 transition-colors enabled:hover:bg-gray-50 disabled:cursor-default dark:enabled:hover:bg-gray-800"
							:title="view === 'week' ? `Xem ${formatDate(day, 'EEEE, dd/MM/yyyy')} theo từng giờ` : undefined"
							@click="openDay(day)"
						>
							<span
								:class="[
									'text-[11px] font-medium uppercase',
									day === today ? 'text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400',
								]"
							>
								{{ formatDate(day, 'EEE') }}
							</span>
							<span
								:class="[
									'mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold',
									day === today
										? 'bg-brand-600 text-white dark:bg-brand-500'
										: day < today
											? 'text-gray-400 dark:text-gray-500'
											: 'text-gray-800 dark:text-gray-100',
								]"
							>
								{{ formatDate(day, 'd') }}
							</span>
						</button>
					</div>
				</div>

				<div class="flex pt-2">
					<!-- Cột giờ: nhãn nằm ngang vạch đầu giờ, như Google Calendar. -->
					<div class="relative w-14 flex-shrink-0" :style="{ height: `${hours.length * HOUR_PX}px` }">
						<span
							v-for="(hour, i) in hours"
							:key="hour"
							class="absolute right-2 -translate-y-1/2 text-[11px] text-gray-400 dark:text-gray-500"
							:style="{ top: `${i * HOUR_PX}px` }"
						>
							{{ hourLabel(hour) }}
						</span>
					</div>

					<div class="relative flex-1" :style="{ height: `${hours.length * HOUR_PX}px` }">
						<!-- Vạch đầu giờ, nằm dưới các cột ngày. -->
						<div
							v-for="(hour, i) in hours"
							:key="hour"
							class="absolute inset-x-0 border-t border-gray-100 dark:border-gray-800"
							:style="{ top: `${i * HOUR_PX}px` }"
						/>

						<div class="absolute inset-0 grid" :style="{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }">
							<!-- Bấm chỗ trống trong cột thì mở hộp đặt phòng đúng giờ vừa bấm. -->
							<div
								v-for="col in timeColumns"
								:key="col.day"
								:class="[
									'relative border-l border-gray-100 dark:border-gray-800',
									col.day === today ? 'bg-brand-50/40 dark:bg-brand-900/10' : '',
									dayOpen(col.day) ? 'cursor-pointer' : '',
								]"
								:title="dayOpen(col.day) ? 'Bấm vào một giờ trống để đặt phòng' : undefined"
								@click="onColumnClick(col.day, $event)"
							>
								<button
									v-for="ev in col.events"
									:key="ev.booking.id"
									type="button"
									:class="[
										'absolute z-10 overflow-hidden rounded-md border-l-[3px] px-1.5 text-left text-xs leading-4 text-white shadow-sm transition-colors',
										eventClass(ev.booking),
									]"
									:style="ev.style"
									:title="bookingLabel(ev.booking)"
									:aria-label="bookingLabel(ev.booking)"
									@click.stop="emit('open', ev.booking)"
								>
									<span v-if="ev.lines === 1" class="block truncate pt-0.5">
										<span class="font-semibold">{{ bookingTitle(ev.booking) }}</span>,
										{{ vnTimeLabel(ev.booking.startAt) }}
									</span>
									<template v-else>
										<span class="block truncate pt-1 font-semibold">{{ bookingTitle(ev.booking) }}</span>
										<span class="block truncate opacity-90">
											{{ vnTimeLabel(ev.booking.startAt) }}–{{ vnTimeLabel(ev.booking.endAt) }}
											<template v-if="ev.lines === 2"> · {{ ev.booking.room.name }}</template>
										</span>
										<span v-if="ev.lines === 3" class="block truncate opacity-90">{{ ev.booking.room.name }}</span>
									</template>
								</button>

								<!-- Vạch giờ hiện tại, chỉ trong cột hôm nay. -->
								<div
									v-if="col.day === today && nowTop !== null"
									class="pointer-events-none absolute inset-x-0 z-20 flex items-center"
									:style="{ top: `${nowTop}px` }"
								>
									<span class="-ml-1.5 h-3 w-3 rounded-full bg-rose-500" />
									<span class="h-0.5 flex-1 bg-rose-500" />
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- ── Tháng: lưới ô ngày ── -->
		<div v-else :class="['transition-opacity', loading ? 'opacity-60' : '']">
			<div class="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
				<p
					v-for="name in WEEKDAY_NAMES"
					:key="name"
					class="py-2 text-center text-[11px] font-medium text-gray-500 uppercase dark:text-gray-400"
				>
					{{ name }}
				</p>
			</div>

			<div v-for="(week, w) in monthWeeks" :key="w" class="grid grid-cols-7">
				<!-- `select-none`: bấm liền hai lần vào ô không bôi đen số ngày. -->
				<div
					v-for="cell in week"
					:key="cell.day"
					role="button"
					tabindex="0"
					:class="[
						'relative min-h-[76px] cursor-pointer border-b border-l border-gray-100 p-1 select-none first:border-l-0 hover:bg-brand-50/40 sm:min-h-[112px] dark:border-gray-800 dark:hover:bg-brand-900/10',
						cell.day.slice(0, 7) === anchorMonth ? '' : 'bg-gray-50/70 dark:bg-gray-800/30',
					]"
					:title="`Xem tuần có ngày ${formatDate(cell.day)}`"
					:aria-label="`Xem tuần có ngày ${formatDate(cell.day)}`"
					@click="openWeek(cell.day)"
					@keydown.enter.self="openWeek(cell.day)"
				>
					<div class="flex justify-center">
						<span
							:class="[
								'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-semibold',
								cell.day === today
									? 'bg-brand-600 text-white dark:bg-brand-500'
									: cell.day.slice(0, 7) === anchorMonth
										? 'text-gray-800 dark:text-gray-100'
										: 'text-gray-400 dark:text-gray-500',
							]"
						>
							{{ formatDate(cell.day, 'd') }}
						</span>
					</div>

					<!-- Màn rộng: mỗi lượt một dòng giờ và tiêu đề. -->
					<div class="mt-1 hidden space-y-0.5 sm:block">
						<button
							v-for="booking in cell.bookings.slice(0, MONTH_CHIPS)"
							:key="booking.id"
							type="button"
							:class="[
								'flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-4 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
								booking.timing === 'ENDED' ? 'opacity-60' : '',
							]"
							:title="bookingLabel(booking)"
							:aria-label="bookingLabel(booking)"
							@click.stop="emit('open', booking)"
						>
							<span :class="['h-2 w-2 flex-shrink-0 rounded-full', dotClass(booking)]" />
							<span class="flex-shrink-0">{{ vnTimeLabel(booking.startAt) }}</span>
							<span class="truncate font-medium">{{ bookingTitle(booking) }}</span>
						</button>
						<!-- Không có cú bấm riêng: bấm vào thì rơi xuống ô và mở tuần, nơi thấy đủ các lượt. -->
						<p
							v-if="cell.bookings.length > MONTH_CHIPS"
							class="px-1 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300"
						>
							+{{ cell.bookings.length - MONTH_CHIPS }} khác
						</p>
					</div>

					<!-- Điện thoại: ô quá hẹp cho chữ, chỉ còn chấm; chạm ô để mở tuần đó. -->
					<div v-if="cell.bookings.length" class="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden">
						<span
							v-for="booking in cell.bookings.slice(0, 4)"
							:key="booking.id"
							:class="['h-1.5 w-1.5 rounded-full', dotClass(booking)]"
						/>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
