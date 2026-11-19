<script setup lang="ts">
	import BookingDetailModal from '~/components/modules/office/BookingDetailModal.vue';
	import BookingFormModal from '~/components/modules/office/BookingFormModal.vue';
	import { useOfficeService } from '~/services/office.service';
	import {
		bookingBar,
		isHourPast,
		officeErrorMessage,
		roomNowLabel,
		slotStartHhmm,
		sortMyBookings,
		vnMinutesOfDay,
		vnTimeLabel,
	} from '~/utils/office.utils';
	import { formatDate, todayYmd, vnCalendarDate } from '~/utils/date';
	import { OFFICE_PERMISSIONS } from '~/utils/permission';
	import type { MeetingRoom, OfficeSite, RoomBooking, RoomGrid } from '~/types/office.types';

	/**
	 * Đặt phòng họp (UI-04): lưới phòng × giờ của một ngày, cộng tab Lịch của tôi.
	 *
	 * Lưới tự vẽ bằng một dải giờ và các thanh đặt theo phần trăm, không thêm thư viện lịch: một
	 * thư viện lịch mang theo cách hiểu múi giờ riêng của nó, mà cả module này chạy theo giờ Việt
	 * Nam, nên tự vẽ vừa nhẹ hơn vừa không có chỗ cho lệch giờ lọt vào.
	 */
	definePageMeta({ title: 'Đặt phòng họp' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useOfficeService();
	const { user } = useAuth();
	const { canWrite } = useModuleAccess();

	/**
	 * Phân hệ còn ghi được hay chỉ xem.
	 *
	 * Hết hạn thì máy chủ trả `canEdit: false` cho từng lượt, nhưng nút "Đặt phòng" và các ô trống
	 * trên lịch không thuộc lượt nào nên phải tự ẩn: để nguyên thì người dùng gõ xong cả biểu mẫu
	 * mới nhận câu từ chối, đúng như giám đốc gặp ở đợt UAT.
	 */
	const canBook = computed(() => canWrite('OFFICE'));

	/** Người có quyền cài đặt hành chính: dùng để chỉ đường khi công ty chưa có văn phòng nào. */
	const { hasPermission } = usePermissions();
	const canSetUpOffice = computed(() => hasPermission(OFFICE_PERMISSIONS.manage) && canWrite('OFFICE'));

	/** Khung giờ mặc định: 7h tới 20h phủ hết giờ làm việc mà vẫn đọc được trên một màn hình. */
	const DEFAULT_START_HOUR = 7;
	const DEFAULT_END_HOUR = 20;

	/** Văn phòng chọn lần trước, để người dùng không phải chọn lại mỗi lần vào trang. */
	const SITE_KEY = 'office.rooms.site';

	type RoomTab = 'grid' | 'mine';
	const activeTab = ref<RoomTab>('grid');

	const sites = ref<OfficeSite[]>([]);
	const siteId = ref<number | undefined>(undefined);
	const date = ref(todayYmd());
	const grid = ref<RoomGrid | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);

	const myBookings = ref<RoomBooking[]>([]);
	const loadingMine = ref(false);
	const mineError = ref<string | null>(null);

	/** Mốc thời gian để biết ô giờ nào đã qua; nhịp một phút là đủ cho một lưới theo giờ. */
	const now = ref(new Date());
	let ticker: ReturnType<typeof setInterval> | null = null;

	/** Khung lưới, để tự cuộn tới giờ hiện tại trên điện thoại. */
	const gridScrollRef = ref<HTMLElement | null>(null);

	const formOpen = ref(false);
	const formRoomId = ref<number | undefined>(undefined);
	const formStart = ref<string | undefined>(undefined);
	const editingBooking = ref<RoomBooking | null>(null);
	const detailBooking = ref<RoomBooking | null>(null);

	const siteOptions = computed(() => sites.value.map(s => ({ value: s.id, label: s.name })));

	const rooms = computed<MeetingRoom[]>(() => (grid.value?.rooms ?? []).map(r => r.room));

	/**
	 * Khung giờ thật của lịch: mặc định 7h–20h, nhưng nới ra nếu hôm đó có lượt sớm hơn hoặc muộn
	 * hơn.
	 *
	 * Nếu để cứng 7h–20h thì một cuộc họp lúc 21h biến mất khỏi lịch, người xem tưởng phòng trống
	 * rồi đặt chồng lên và bị máy chủ từ chối mà không hiểu vì sao.
	 */
	const hourRange = computed(() => {
		let start = DEFAULT_START_HOUR;
		let end = DEFAULT_END_HOUR;
		for (const row of grid.value?.rooms ?? []) {
			for (const booking of row.bookings) {
				if (booking.status === 'CANCELLED') continue;
				const from = Math.floor(vnMinutesOfDay(booking.startAt) / 60);
				const rawEnd = vnMinutesOfDay(booking.endAt);
				// Lượt kết thúc đúng nửa đêm hoặc vắt sang hôm sau thì coi như chạy tới hết ngày.
				const to = rawEnd <= from * 60 ? 24 : Math.ceil(rawEnd / 60);
				start = Math.min(start, from);
				end = Math.max(end, to);
			}
		}
		return { start: Math.max(0, start), end: Math.min(24, Math.max(end, start + 1)) };
	});

	const HOURS = computed(() =>
		Array.from({ length: hourRange.value.end - hourRange.value.start }, (_, i) => hourRange.value.start + i),
	);

	/** Lượt do tôi đặt hoặc tôi chủ trì: dùng để biết huỷ có cần lý do hay không. */
	function isMine(booking: RoomBooking): boolean {
		const id = user.value?.id;
		return !!id && (booking.createdBy.id === id || booking.organizer.id === id);
	}

	function readSavedSite(): number | undefined {
		if (!import.meta.client) return undefined;
		try {
			const raw = localStorage.getItem(SITE_KEY);
			const parsed = raw ? Number(raw) : NaN;
			return Number.isFinite(parsed) ? parsed : undefined;
		} catch {
			// Chế độ ẩn danh hoặc site data bị chặn: coi như chưa từng chọn.
			return undefined;
		}
	}

	function rememberSite(id: number) {
		if (!import.meta.client) return;
		try {
			localStorage.setItem(SITE_KEY, String(id));
		} catch {
			// Không ghi được thì thôi, đây chỉ là tiện ích.
		}
	}

	async function loadSites() {
		try {
			sites.value = await service.findSites();
		} catch (e) {
			sites.value = [];
			loadError.value = officeErrorMessage(e, 'Chưa tải được danh sách văn phòng. Bạn tải lại trang.');
		}
	}

	async function loadGrid() {
		if (!siteId.value) {
			grid.value = null;
			loading.value = false;
			return;
		}
		loading.value = true;
		loadError.value = null;
		try {
			grid.value = await service.roomGrid(siteId.value, date.value);
		} catch (e) {
			grid.value = null;
			loadError.value = officeErrorMessage(e, 'Chưa tải được lịch phòng họp. Bạn bấm Thử lại.');
		} finally {
			loading.value = false;
		}
	}

	async function loadMine() {
		loadingMine.value = true;
		mineError.value = null;
		try {
			// Bảy ngày tới là khoảng người dùng thực sự cần nhìn; máy chủ cho tối đa ba tháng.
			const from = todayYmd();
			const to = vnCalendarDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
			myBookings.value = await service.myBookings({ from, to });
		} catch (e) {
			myBookings.value = [];
			mineError.value = officeErrorMessage(e, 'Chưa tải được lịch họp của bạn. Bạn bấm Thử lại.');
		} finally {
			loadingMine.value = false;
		}
	}

	/** Mở sẵn một lượt theo `?booking_id=` của thông báo. */
	async function openByQuery() {
		const raw = route.query.booking_id;
		if (!raw) return;
		const id = Number(raw);
		router.replace({ path: '/office/rooms' });
		if (!id || Number.isNaN(id)) {
			toast.error('Đường dẫn thông báo không mang đúng mã lượt họp.');
			return;
		}
		try {
			const booking = await service.findBooking(id);
			detailBooking.value = booking;
			// Lượt ở ngày khác thì đưa lưới về đúng ngày của nó, để đóng hộp ra là thấy ngay.
			const bookingDate = vnCalendarDate(booking.startAt);
			if (bookingDate !== date.value) date.value = bookingDate;
			if (booking.officeSite.id !== siteId.value) siteId.value = booking.officeSite.id;
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa mở được lượt họp này. Có thể lượt đã bị xoá.'));
		}
	}

	/**
	 * Cuộn lưới tới giờ hiện tại khi đang xem hôm nay.
	 *
	 * Trên điện thoại lưới rộng hơn màn hình nhiều lần, nên mở ra là thấy 7 giờ sáng và người dùng
	 * tưởng buổi chiều không có gì; đưa khung về giờ hiện tại thì cái họ cần nằm ngay trước mắt.
	 */
	function scrollToNow() {
		const box = gridScrollRef.value;
		if (!box || date.value !== todayYmd()) return;
		const span = (hourRange.value.end - hourRange.value.start) * 60;
		if (span <= 0) return;
		const passed = vnMinutesOfDay(now.value) - hourRange.value.start * 60;
		const ratio = Math.min(Math.max(passed / span, 0), 1);
		// Lùi lại một phần tư khung để giờ hiện tại không dính sát mép trái.
		box.scrollLeft = Math.max(ratio * box.scrollWidth - box.clientWidth / 4, 0);
	}

	onMounted(async () => {
		ticker = setInterval(() => (now.value = new Date()), 60_000);
		await loadSites();
		const saved = readSavedSite();
		siteId.value = sites.value.find(s => s.id === saved)?.id ?? sites.value[0]?.id;
		await loadGrid();
		await nextTick();
		scrollToNow();
		await openByQuery();
	});

	onUnmounted(() => {
		if (ticker) clearInterval(ticker);
	});

	watch(siteId, id => {
		if (id) rememberSite(id);
		loadGrid();
	});

	/**
	 * Ngày trống thì về hôm nay.
	 *
	 * Ô ngày cho xoá trắng, mà lịch không có ngày thì máy chủ trả "Ngày không được để trống" và cả
	 * trang chỉ còn một hộp lỗi với nút Thử lại, không còn đường nào đặt phòng nữa.
	 */
	watch(date, value => {
		if (!value) {
			date.value = todayYmd();
			return;
		}
		loadGrid();
	});

	watch(activeTab, tab => {
		if (tab === 'mine' && !myBookings.value.length && !loadingMine.value) loadMine();
	});

	function openCreate(roomId: number, hour: number) {
		editingBooking.value = null;
		formRoomId.value = roomId;
		// Bấm ô của giờ đang chạy thì đầu giờ đã là quá khứ, nên điền mốc năm phút kế tiếp.
		formStart.value = slotStartHhmm(date.value, hour, now.value);
		formOpen.value = true;
	}

	/** Ngày đang xem đã qua: không còn giờ nào đặt được nên các ô giờ chỉ để xem. */
	const pastDate = computed(() => date.value < todayYmd());

	function slotPast(hour: number): boolean {
		return isHourPast(date.value, hour, now.value);
	}

	/** Lượt của tôi: sắp tới và đang họp lên trước, lượt đã kết thúc xuống cuối. */
	const sortedMine = computed(() => sortMyBookings(myBookings.value));

	/**
	 * Đặt phòng mà không bấm vào ô giờ nào.
	 *
	 * Lịch chỉ vẽ từ 7 giờ tới 20 giờ, nên họp sớm hay họp tối không có ô nào để bấm; nút này mở
	 * thẳng hộp đặt phòng với giờ tròn kế tiếp, rồi người dùng tự chọn giờ trong hộp.
	 */
	function openCreateAnyHour() {
		// Ngày đã qua thì không mở hộp với giờ của hôm nay: ngày trong hộp phải là ngày đặt được.
		if (pastDate.value) date.value = todayYmd();
		openCreate(rooms.value[0]?.id ?? 0, defaultCreateHour());
	}

	/**
	 * Giờ điền sẵn cho nút "Đặt phòng": luôn là một giờ NẰM TRONG lịch đang vẽ.
	 *
	 * Lấy "giờ hiện tại cộng một" như trước thì người bấm lúc một giờ đêm nhận giờ 02:00, một giờ
	 * không có trên lịch và cũng không ai họp. Hôm nay thì bắt đầu từ giờ hiện tại, ngày khác thì
	 * từ giờ làm việc đầu tiên của lịch.
	 */
	function defaultCreateHour(): number {
		const { start, end } = hourRange.value;
		if (date.value !== todayYmd()) return start;
		const nowHour = Math.floor(vnMinutesOfDay(now.value) / 60);
		return Math.min(Math.max(nowHour, start), Math.max(end - 1, start));
	}

	function openEdit(booking: RoomBooking) {
		detailBooking.value = null;
		editingBooking.value = booking;
		formRoomId.value = booking.room.id;
		formStart.value = undefined;
		formOpen.value = true;
	}

	async function onSaved() {
		formOpen.value = false;
		editingBooking.value = null;
		await loadGrid();
		if (activeTab.value === 'mine') await loadMine();
	}

	async function onFormClosed() {
		formOpen.value = false;
		editingBooking.value = null;
		// Tải lại lịch khi đóng hộp: trong lúc hộp mở, người khác có thể đã giữ phòng.
		await loadGrid();
	}

	async function onCancelled() {
		detailBooking.value = null;
		await loadGrid();
		if (activeTab.value === 'mine') await loadMine();
	}

	/**
	 * Nhãn đầy đủ của một lượt, dùng cho `title` khi rê chuột và cho `aria-label`.
	 *
	 * Thanh trên lưới hẹp nên tiêu đề bị cắt; câu đầy đủ nằm ở đây, và chạm vào thanh thì mở hộp
	 * chi tiết — đó là đường của người dùng điện thoại, nơi không có chuột để rê.
	 */
	function barLabel(booking: RoomBooking): string {
		const time = `${vnTimeLabel(booking.startAt)}–${vnTimeLabel(booking.endAt)}`;
		const who = booking.organizer.id === booking.createdBy.id
			? booking.createdBy.fullName
			: `${booking.createdBy.fullName} đặt hộ ${booking.organizer.fullName}`;
		return booking.detailsVisible
			? `${time} · ${booking.title} · ${who}`
			: `${time} · Đã có người đặt · ${booking.createdBy.fullName}`;
	}

	/**
	 * Thanh để vẽ của một phòng: lượt đã huỷ bỏ hẳn, lượt nằm ngoài dải giờ cũng bỏ vì không có
	 * chỗ nào trên lưới để đặt chúng.
	 *
	 * Bề rộng đúng bằng thời lượng, KHÔNG có bề rộng tối thiểu. Đặt bề rộng tối thiểu như trước thì
	 * một lượt nửa tiếng phủ sang lượt kế tiếp và cả hai trông như trùng giờ, còn lượt mười phút
	 * thì bị thanh bên cạnh che kín không chạm được. Phần bấm được nới rộng hơn phần vẽ bằng một
	 * vùng trong suốt, nên lượt ngắn vẫn chạm trúng mà lưới không vẽ chồng lên nhau.
	 */
	function barsOf(bookings: RoomBooking[]): Array<{
		booking: RoomBooking;
		style: Record<string, string>;
		/** Chỗ nào đủ rộng để in gì: cả tiêu đề, chỉ giờ, hay không chữ nào. */
		showTitle: boolean;
		showTime: boolean;
	}> {
		const bars: Array<{
			booking: RoomBooking;
			style: Record<string, string>;
			showTitle: boolean;
			showTime: boolean;
		}> = [];
		for (const booking of bookings) {
			if (booking.status === 'CANCELLED') continue;
			const bar = bookingBar(booking.startAt, booking.endAt, {
				startHour: hourRange.value.start,
				endHour: hourRange.value.end,
			});
			if (!bar) continue;
			bars.push({
				booking,
				style: { left: `${bar.leftPercent}%`, width: `${bar.widthPercent}%` },
				// Chỉ in tiêu đề khi thanh dài từ khoảng hai giờ trở lên. Thanh một giờ rộng chừng
				// bốn mươi pixel, in tiêu đề vào đó chỉ ra "Giao ba…" — cắt ngang một cái tên thì
				// người đọc vừa không biết họp gì vừa tưởng tên phòng sai; thà in giờ bắt đầu cho
				// gọn, còn câu đầy đủ đã nằm ở `title` và ở hộp chi tiết khi bấm.
				showTitle: bar.widthPercent >= 15,
				showTime: bar.widthPercent >= 6,
			});
		}
		return bars;
	}
</script>

<template>
	<!-- `pb-24`: chừa chỗ cho nút trợ lý nổi ở góc dưới phải, nếu không nó đè lên dòng cuối trang. -->
	<div class="space-y-5 pb-24">
		<UiPageHeader
			title="Đặt phòng họp"
			description="Bạn bấm vào một khung giờ còn trống trên lịch để đặt phòng, hoặc bấm nút Đặt phòng rồi tự chọn giờ. Không có bước duyệt, nên đặt xong là phòng đã được giữ."
		>
			<CommonAppButton v-if="rooms.length && canBook" variant="primary" @click="openCreateAnyHour">
				Đặt phòng
			</CommonAppButton>
		</UiPageHeader>

		<CommonAppModuleNotice module="OFFICE" />

		<div class="border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex flex-wrap gap-1">
				<button
					v-for="tab in [
						{ id: 'grid' as RoomTab, label: 'Lịch phòng' },
						{ id: 'mine' as RoomTab, label: 'Lịch của tôi' },
					]"
					:key="tab.id"
					type="button"
					:class="[
						'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
						activeTab === tab.id
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
					]"
					@click="activeTab = tab.id"
				>
					{{ tab.label }}
				</button>
			</nav>
		</div>

		<template v-if="activeTab === 'grid'">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px] sm:items-end">
				<div>
					<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Văn phòng</p>
					<UiSelect v-model="siteId" :options="siteOptions" placeholder="Chọn văn phòng" />
				</div>
				<div>
					<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Ngày</p>
					<UiDatePicker v-model="date" />
				</div>
			</div>

			<div v-if="loading" class="space-y-3">
				<div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="loadError"
				class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
			>
				<p>{{ loadError }}</p>
				<CommonAppButton class="mt-3" size="sm" variant="outline" @click="loadGrid">Thử lại</CommonAppButton>
			</div>

			<!-- Người có quyền cài đặt tự tạo được văn phòng, nên chỉ đường thay vì bảo họ liên hệ HCNS. -->
			<div
				v-else-if="!sites.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				<p>Công ty chưa có văn phòng nào, nên chưa có phòng họp để đặt.</p>
				<p v-if="canSetUpOffice" class="mt-2">
					<!-- Dấu chấm dính liền thẻ đóng, nếu không thì xuống dòng thành "Cài đặt hành chính .". -->
					Bạn tạo văn phòng và phòng họp ở
					<NuxtLink to="/management/office/settings" class="text-brand-600 hover:underline dark:text-brand-400"
						>Cài đặt hành chính</NuxtLink
					>.
				</p>
				<p v-else class="mt-2">Bạn liên hệ HCNS để được thêm văn phòng và phòng họp.</p>
			</div>

			<p
				v-else-if="!grid || !grid.rooms.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Văn phòng này chưa có phòng họp nào đang dùng. Bạn liên hệ HCNS để thêm phòng.
			</p>

			<section
				v-else
				class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
					<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
						{{ grid.site.name }} · {{ formatDate(grid.date) }}
					</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Lịch hiện từ {{ hourRange.start }} giờ tới {{ hourRange.end }} giờ.
					</p>
				</div>

				<!--
					Lưới cuộn ngang TRONG khung của nó, không đẩy cả trang tràn ngang trên điện thoại.
					Cột tên phòng dính vào mép trái khi cuộn, nếu không thì người dùng cuộn tới buổi chiều
					là mất luôn tên phòng và không còn biết dòng nào của phòng nào.
				-->
				<div class="relative">
					<!--
						Đệm trái nằm TRONG ô tên phòng, không nằm ở khung cuộn: ô dính `left-0` dính vào mép
						khung cuộn, nên nếu khung có đệm trái thì khi cuộn, tên phòng trượt vào phần đệm đó
						và lệch đi mười sáu pixel so với lúc chưa cuộn.
					-->
					<div ref="gridScrollRef" class="overflow-x-auto">
						<div class="min-w-[760px] py-4 pr-4">
							<!-- Thước giờ -->
							<div class="flex items-end gap-3 pb-1">
								<div
									class="sticky left-0 z-20 w-32 flex-shrink-0 bg-white pl-4 text-xs text-gray-500 sm:w-52 dark:bg-gray-900 dark:text-gray-400"
								>
									Phòng
								</div>
								<div class="relative flex-1">
									<div class="flex">
										<div
											v-for="hour in HOURS"
											:key="hour"
											class="flex-1 border-l border-gray-100 pl-1 text-[11px] text-gray-400 dark:border-gray-800"
										>
											{{ String(hour).padStart(2, '0') }}:00
										</div>
									</div>
								</div>
							</div>

							<div class="space-y-2">
								<div v-for="row in grid.rooms" :key="row.room.id" class="flex items-stretch gap-3">
									<div class="sticky left-0 z-20 w-32 flex-shrink-0 bg-white pl-4 sm:w-52 dark:bg-gray-900">
										<!--
											Tên phòng XUỐNG DÒNG, không cắt bằng dấu ba chấm: cắt thì "Phòng họp tầng 3" và
											"Phòng họp tầng 5" đều ra "Phòng họ…", mà tên phòng chính là thứ phải đọc được để
											biết dòng nào của phòng nào.
										-->
										<p class="text-sm leading-tight font-medium break-words text-gray-900 dark:text-white">
											{{ row.room.name }}
										</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">
											<template v-if="row.room.capacity != null">{{ row.room.capacity }} người</template>
											<template v-if="row.room.equipment.length">
												<template v-if="row.room.capacity != null"> · </template>
												{{ row.room.equipment.join(', ') }}
											</template>
											<template v-if="row.now">
												<template v-if="row.room.capacity != null || row.room.equipment.length"> · </template>
												<span :class="row.now.busy ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
													{{ roomNowLabel(row.now) }}
												</span>
											</template>
										</p>
									</div>

									<div class="relative h-14 flex-1 rounded-lg bg-gray-50 dark:bg-gray-800/60">
										<!-- Lớp bấm: mỗi ô là một giờ, bấm vào mở hộp đặt phòng từ giờ đó. -->
										<div class="absolute inset-0 flex">
											<button
												v-for="hour in HOURS"
												:key="hour"
												type="button"
												:disabled="slotPast(hour) || !canBook"
												:class="[
													'flex-1 border-l border-gray-100 transition-colors first:border-l-0 dark:border-gray-800',
													slotPast(hour)
														? 'cursor-not-allowed bg-gray-100/80 dark:bg-gray-900/60'
														: !canBook
															? 'cursor-not-allowed'
															: 'hover:bg-brand-50 dark:hover:bg-brand-900/20',
												]"
												:aria-label="
													slotPast(hour)
														? `${String(hour).padStart(2, '0')} giờ đã qua`
														: `Đặt ${row.room.name} từ ${String(hour).padStart(2, '0')} giờ`
												"
												:title="
													slotPast(hour)
														? 'Giờ này đã qua nên không đặt được.'
														: !canBook
															? 'Hành chính văn phòng đang ở chế độ chỉ xem nên không đặt thêm được.'
															: `Đặt ${row.room.name} từ ${String(hour).padStart(2, '0')}:00`
												"
												@click="openCreate(row.room.id, hour)"
											/>
										</div>

										<!--
											Lớp lượt họp, đặt theo phần trăm của dải giờ.
											Thanh VẼ đúng thời lượng, nhưng vùng BẤM của thanh hẹp được nới mười pixel mỗi
											bên bằng `after:` (trong suốt, không vẽ gì), nên lượt năm, mười phút vẫn chạm
											trúng khoảng hai mươi lăm pixel mà lưới không có thanh nào phủ lên thanh khác.
											Thanh rộng thì không nới, để hai lượt sát nhau không giành nhau cú bấm.
										-->
										<button
											v-for="bar in barsOf(row.bookings)"
											:key="bar.booking.id"
											type="button"
											class="absolute top-1 bottom-1 overflow-hidden rounded-md text-left text-xs transition-colors"
											:class="[
												bar.booking.detailsVisible
													? 'bg-brand-500/90 text-white hover:bg-brand-600'
													: 'bg-gray-400/90 text-white hover:bg-gray-500',
												bar.showTime ? 'px-1.5' : 'px-0',
												bar.showTitle ? '' : 'after:absolute after:-inset-x-2.5 after:inset-y-0 after:content-[\'\']',
												bar.booking.timing === 'ENDED' ? 'opacity-60' : '',
											]"
											:style="bar.style"
											:title="barLabel(bar.booking)"
											:aria-label="barLabel(bar.booking)"
											@click.stop="detailBooking = bar.booking"
										>
											<template v-if="bar.showTitle">
												<span class="block truncate font-medium">
													{{ bar.booking.detailsVisible ? bar.booking.title : 'Đã có người đặt' }}
												</span>
												<span class="block truncate opacity-90">
													{{ vnTimeLabel(bar.booking.startAt) }}–{{ vnTimeLabel(bar.booking.endAt) }} ·
													{{ bar.booking.createdBy.fullName }}
												</span>
											</template>
											<span v-else-if="bar.showTime" class="block truncate font-medium">
												{{ vnTimeLabel(bar.booking.startAt) }}
											</span>
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Bóng mờ ở mép phải: dấu hiệu lưới còn nội dung bên phải, cho người dùng điện thoại. -->
					<div
						class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent sm:hidden dark:from-gray-900"
					/>
				</div>
			</section>
		</template>

		<!-- ── Lịch của tôi ────────────────────────────────────────────────── -->
		<template v-else>
			<div v-if="loadingMine" class="space-y-3">
				<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="mineError"
				class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
			>
				<p>{{ mineError }}</p>
				<CommonAppButton class="mt-3" size="sm" variant="outline" @click="loadMine">Thử lại</CommonAppButton>
			</div>

			<p
				v-else-if="!myBookings.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Bảy ngày tới bạn không có lượt họp nào mà mình đặt, chủ trì hoặc được mời.
			</p>

			<div v-else class="space-y-3">
				<!-- Lượt đã kết thúc làm mờ và xếp cuối: không còn việc gì để làm với chúng nữa. -->
				<button
					v-for="booking in sortedMine"
					:key="booking.id"
					type="button"
					:class="[
						'block w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-300 dark:bg-gray-900 dark:hover:border-brand-700',
						booking.timing === 'ENDED'
							? 'border-gray-200 opacity-60 dark:border-gray-800'
							: 'border-gray-200 dark:border-gray-700',
					]"
					@click="detailBooking = booking"
				>
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div>
							<p class="font-medium text-gray-900 dark:text-white">
								{{ booking.detailsVisible ? booking.title : 'Lượt riêng tư' }}
							</p>
							<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
								{{ formatDate(booking.startAt) }} · {{ vnTimeLabel(booking.startAt) }}–{{ vnTimeLabel(booking.endAt) }}
								· {{ booking.room.name }}
							</p>
							<!-- Chủ trì đã nghỉ việc thì ghi rõ ngay ở dòng này: lượt đó cần người khác chủ trì. -->
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								Chủ trì {{ booking.organizer.fullName
								}}<template v-if="!booking.organizer.isActive"> (đã nghỉ việc)</template> · người đặt
								{{ booking.createdBy.fullName }}
							</p>
						</div>
						<!--
							Nhãn lấy thẳng `statusLabel` của máy chủ ("Đã đặt", "Đang họp", "Đã kết thúc",
							"Đã huỷ"); màu đi theo `timing` để ba trạng thái không cùng một màu xanh.
						-->
						<span
							:class="[
								'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
								booking.status === 'CANCELLED'
									? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
									: booking.timing === 'ENDED'
										? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
										: booking.timing === 'ONGOING'
											? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
											: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
							]"
						>
							{{ booking.statusLabel }}
						</span>
					</div>
				</button>
			</div>
		</template>

		<BookingFormModal
			v-if="formOpen"
			:date="date"
			:rooms="rooms"
			:room-id="formRoomId"
			:start-hhmm="formStart"
			:booking="editingBooking"
			@saved="onSaved"
			@reload="loadGrid"
			@close="onFormClosed"
		/>

		<BookingDetailModal
			v-if="detailBooking"
			:booking="detailBooking"
			:mine="isMine(detailBooking)"
			@cancelled="onCancelled"
			@edit="openEdit(detailBooking)"
			@close="detailBooking = null"
		/>
	</div>
</template>
