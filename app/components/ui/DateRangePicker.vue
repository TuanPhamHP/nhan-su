<template>
	<div :class="$style.wrapper" ref="wrapperRef">
		<!-- Trigger input -->
		<div :class="[$style.trigger, isOpen && $style.triggerOpen]" @click="toggleOpen">
			<span v-if="displayText" :class="$style.triggerText">{{ displayText }}</span>
			<span v-else :class="$style.placeholder">{{ placeholder }}</span>
			<Icon name="mdi:calendar-outline" size="16" :class="$style.calIcon" />
		</div>

		<!-- Dropdown (teleported to body for z-index above modal) -->
		<Teleport to="body">
			<div v-if="isOpen" ref="dropdownRef" :class="$style.dropdown" :style="dropdownStyle">
				<!-- Presets sidebar -->
				<div :class="$style.presets">
					<button
						v-for="p in presets"
						:key="p.key"
						:class="[$style.presetBtn, activePreset === p.key && $style.presetActive]"
						type="button"
						@click="applyPreset(p)"
					>
						{{ p.label }}
					</button>
				</div>

				<!-- Calendars -->
				<div :class="$style.calendars">
					<!-- Left calendar -->
					<div :class="$style.calendarPanel">
						<div :class="$style.calHeader">
							<div :class="$style.calNav">
								<button type="button" :class="$style.navBtn" @click="leftMonth -= 12">«</button>
								<button type="button" :class="$style.navBtn" @click="leftMonth--">‹</button>
							</div>
							<span :class="$style.calTitle">{{ leftYear }} - {{ MONTHS[leftMonthIndex] }}</span>
							<div :class="$style.calNav">
								<button type="button" :class="$style.navBtn" @click="leftMonth++">›</button>
								<button type="button" :class="$style.navBtn" @click="leftMonth += 12">»</button>
							</div>
						</div>
						<div :class="$style.dayHeaders">
							<div v-for="d in DAY_NAMES" :key="d" :class="$style.dayHeader">{{ d }}</div>
						</div>
						<div :class="$style.dayGrid">
							<div
								v-for="(cell, i) in leftCells"
								:key="i"
								:class="$style.dayCell"
								@click="cell.isCurrentMonth && onDateSelect(cell.dateStr)"
								@mouseenter="cell.isCurrentMonth && onDateHover(cell.dateStr)"
							>
								<div
									:class="[
										$style.day,
										!cell.isCurrentMonth && $style.dayOutside,
										isSelected(cell.dateStr) && $style.daySelected,
										isInRange(cell.dateStr) && $style.dayInRange,
										isToday(cell.dateStr) && !isSelected(cell.dateStr) && $style.dayToday,
									]"
								>
									{{ cell.day }}
								</div>
							</div>
						</div>
					</div>

					<!-- Right calendar -->
					<div :class="$style.calendarPanel">
						<div :class="$style.calHeader">
							<div :class="$style.calNav">
								<button type="button" :class="$style.navBtn" @click="rightMonth -= 12">«</button>
								<button type="button" :class="$style.navBtn" @click="rightMonth--">‹</button>
							</div>
							<span :class="$style.calTitle">{{ rightYear }} - {{ MONTHS[rightMonthIndex] }}</span>
							<div :class="$style.calNav">
								<button type="button" :class="$style.navBtn" @click="rightMonth++">›</button>
								<button type="button" :class="$style.navBtn" @click="rightMonth += 12">»</button>
							</div>
						</div>
						<div :class="$style.dayHeaders">
							<div v-for="d in DAY_NAMES" :key="d" :class="$style.dayHeader">{{ d }}</div>
						</div>
						<div :class="$style.dayGrid">
							<div
								v-for="(cell, i) in rightCells"
								:key="i"
								:class="$style.dayCell"
								@click="cell.isCurrentMonth && onDateSelect(cell.dateStr)"
								@mouseenter="cell.isCurrentMonth && onDateHover(cell.dateStr)"
							>
								<div
									:class="[
										$style.day,
										!cell.isCurrentMonth && $style.dayOutside,
										isSelected(cell.dateStr) && $style.daySelected,
										isInRange(cell.dateStr) && $style.dayInRange,
										isToday(cell.dateStr) && !isSelected(cell.dateStr) && $style.dayToday,
									]"
								>
									{{ cell.day }}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>

<script setup lang="ts">
	interface Props {
		fromDate: string;
		toDate: string;
		placeholder?: string;
	}

	const props = withDefaults(defineProps<Props>(), {
		placeholder: 'Chọn khoảng ngày',
	});

	const emit = defineEmits<{
		'update:fromDate': [value: string];
		'update:toDate': [value: string];
	}>();

	const MONTHS = [
		'Tháng 1',
		'Tháng 2',
		'Tháng 3',
		'Tháng 4',
		'Tháng 5',
		'Tháng 6',
		'Tháng 7',
		'Tháng 8',
		'Tháng 9',
		'Tháng 10',
		'Tháng 11',
		'Tháng 12',
	];
	const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

	const isOpen = ref(false);
	const wrapperRef = ref<HTMLElement | null>(null);
	const dropdownRef = ref<HTMLElement | null>(null);
	const hoverDate = ref<string | null>(null);
	const selectStep = ref<'start' | 'end'>('start');

	const rangeStart = ref(props.fromDate || '');
	const rangeEnd = ref(props.toDate || '');

	watch(
		() => props.fromDate,
		v => {
			rangeStart.value = v;
		},
	);
	watch(
		() => props.toDate,
		v => {
			rangeEnd.value = v;
		},
	);

	// Calendar navigation (encoded as absolute month index)
	const now = new Date();
	const leftMonth = ref(now.getFullYear() * 12 + now.getMonth());
	const rightMonth = ref(now.getFullYear() * 12 + now.getMonth() + 1);

	const leftYear = computed(() => Math.floor(leftMonth.value / 12));
	const leftMonthIndex = computed(() => ((leftMonth.value % 12) + 12) % 12);
	const rightYear = computed(() => Math.floor(rightMonth.value / 12));
	const rightMonthIndex = computed(() => ((rightMonth.value % 12) + 12) % 12);

	// --- Calendar cell generation ---
	interface DayCell {
		day: number;
		dateStr: string;
		isCurrentMonth: boolean;
	}

	function buildCells(year: number, month: number): DayCell[] {
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const result: DayCell[] = [];

		// Previous month padding
		const prevDays = new Date(year, month, 0).getDate();
		for (let i = firstDay - 1; i >= 0; i--) {
			const d = prevDays - i;
			const pm = month === 0 ? 11 : month - 1;
			const py = month === 0 ? year - 1 : year;
			result.push({ day: d, dateStr: toDateStr(py, pm, d), isCurrentMonth: false });
		}

		// Current month
		for (let d = 1; d <= daysInMonth; d++) {
			result.push({ day: d, dateStr: toDateStr(year, month, d), isCurrentMonth: true });
		}

		// Next month padding (fill to 42 cells = 6 rows)
		const remaining = 42 - result.length;
		for (let d = 1; d <= remaining; d++) {
			const nm = month === 11 ? 0 : month + 1;
			const ny = month === 11 ? year + 1 : year;
			result.push({ day: d, dateStr: toDateStr(ny, nm, d), isCurrentMonth: false });
		}

		return result;
	}

	function toDateStr(y: number, m: number, d: number): string {
		return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	}

	const leftCells = computed(() => buildCells(leftYear.value, leftMonthIndex.value));
	const rightCells = computed(() => buildCells(rightYear.value, rightMonthIndex.value));

	const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

	function isToday(dateStr: string): boolean {
		return dateStr === todayStr;
	}

	function isSelected(dateStr: string): boolean {
		return dateStr === rangeStart.value || dateStr === (rangeEnd.value || hoverDate.value);
	}

	function isInRange(dateStr: string): boolean {
		const start = rangeStart.value;
		const end = rangeEnd.value || hoverDate.value;
		if (!start || !end) return false;
		const lo = start < end ? start : end;
		const hi = start < end ? end : start;
		return dateStr > lo && dateStr < hi;
	}

	// --- Dropdown positioning ---
	const dropdownStyle = ref<Record<string, string>>({});

	function toggleOpen() {
		if (isOpen.value) {
			closeDropdown();
		} else {
			isOpen.value = true;
			nextTick(() => positionDropdown());
		}
	}

	function positionDropdown() {
		if (!wrapperRef.value) return;
		const rect = wrapperRef.value.getBoundingClientRect();
		const DROPDOWN_WIDTH = 700;
		const spaceRight = window.innerWidth - rect.left;
		const style: Record<string, string> = {
			position: 'fixed',
			top: `${rect.bottom + 4}px`,
			zIndex: '9999',
		};
		if (spaceRight >= DROPDOWN_WIDTH) {
			style.left = `${rect.left}px`;
		} else {
			style.right = `${window.innerWidth - rect.right}px`;
		}
		dropdownStyle.value = style;
	}

	// --- Presets ---
	const activePreset = ref('');

	interface Preset {
		key: string;
		label: string;
		from: () => string;
		to: () => string;
	}

	function fmtDate(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	const presets: Preset[] = [
		{ key: 'today', label: 'Hôm nay', from: () => fmtDate(new Date()), to: () => fmtDate(new Date()) },
		{
			key: 'yesterday',
			label: 'Hôm qua',
			from: () => {
				const d = new Date();
				d.setDate(d.getDate() - 1);
				return fmtDate(d);
			},
			to: () => {
				const d = new Date();
				d.setDate(d.getDate() - 1);
				return fmtDate(d);
			},
		},
		{
			key: 'this_week',
			label: 'Tuần này',
			from: () => {
				const d = new Date();
				const dow = d.getDay();
				d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
				return fmtDate(d);
			},
			to: () => {
				const d = new Date();
				const dow = d.getDay();
				d.setDate(d.getDate() + (dow === 0 ? 0 : 7 - dow)); // Sunday
				return fmtDate(d);
			},
		},
		{
			key: 'this_month',
			label: 'Tháng này',
			from: () => {
				const d = new Date();
				return fmtDate(new Date(d.getFullYear(), d.getMonth(), 1));
			},
			to: () => fmtDate(new Date()),
		},
		{
			key: 'this_year',
			label: 'Năm nay',
			from: () => fmtDate(new Date(new Date().getFullYear(), 0, 1)),
			to: () => fmtDate(new Date(new Date().getFullYear(), 11, 31)),
		},
		{
			key: 'next_year',
			label: 'Năm sau',
			from: () => fmtDate(new Date(new Date().getFullYear() + 1, 0, 1)),
			to: () => fmtDate(new Date(new Date().getFullYear() + 1, 11, 31)),
		},
		{ key: 'all', label: 'Tất cả', from: () => '', to: () => '' },
	];

	function applyPreset(p: Preset) {
		activePreset.value = p.key;
		const from = p.from();
		const to = p.to();
		rangeStart.value = from;
		rangeEnd.value = to;
		selectStep.value = 'start';
		emit('update:fromDate', from);
		emit('update:toDate', to);
		isOpen.value = false;
	}

	// --- Date selection ---
	function onDateSelect(dateStr: string) {
		activePreset.value = '';
		if (selectStep.value === 'start') {
			rangeStart.value = dateStr;
			rangeEnd.value = '';
			selectStep.value = 'end';
		} else {
			if (dateStr < rangeStart.value) {
				rangeEnd.value = rangeStart.value;
				rangeStart.value = dateStr;
			} else {
				rangeEnd.value = dateStr;
			}
			selectStep.value = 'start';
			emit('update:fromDate', rangeStart.value);
			emit('update:toDate', rangeEnd.value);
			isOpen.value = false;
		}
	}

	function onDateHover(dateStr: string) {
		if (selectStep.value === 'end') {
			hoverDate.value = dateStr;
		}
	}

	// --- Display ---
	const displayText = computed(() => {
		if (!rangeStart.value && !rangeEnd.value) return '';
		if (rangeStart.value && !rangeEnd.value) return rangeStart.value;
		return `${rangeStart.value} ~ ${rangeEnd.value}`;
	});

	// --- Close dropdown, emit from if only start was picked ---
	function closeDropdown() {
		if (selectStep.value === 'end' && rangeStart.value) {
			emit('update:fromDate', rangeStart.value);
		}
		isOpen.value = false;
	}

	// --- Click outside (handles teleported dropdown) ---
	function handleClickOutside(e: MouseEvent) {
		const target = e.target as Node;
		if (wrapperRef.value?.contains(target)) return;
		if (dropdownRef.value?.contains(target)) return;
		closeDropdown();
	}

	onMounted(() => window.addEventListener('mousedown', handleClickOutside));
	onUnmounted(() => window.removeEventListener('mousedown', handleClickOutside));
</script>

<style module lang="scss">
	.wrapper {
		position: relative;
		width: 100%;
	}

	.trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0.5rem 0.75rem;
		border: 1px solid $color-border;
		border-radius: $radius-md;
		background: #fff;
		font-size: $font-size-sm;
		cursor: pointer;
		height: 40px;
		transition: border-color 150ms ease;

		&:hover {
			border-color: $color-primary;
		}
	}

	.triggerOpen {
		border-color: $color-primary;
		box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
	}

	.triggerText {
		flex: 1;
		color: $color-text-primary;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.placeholder {
		flex: 1;
		color: #9ca3af;
	}

	.calIcon {
		color: #6b7280;
		flex-shrink: 0;
	}

	.dropdown {
		background: #fff;
		border: 1px solid $color-border;
		border-radius: $radius-lg;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
		display: flex;
		overflow: hidden;
	}

	.presets {
		display: flex;
		flex-direction: column;
		padding: 8px;
		border-right: 1px solid $color-border;
		min-width: 100px;
	}

	.presetBtn {
		padding: 8px 12px;
		border: none;
		background: none;
		font-size: 13px;
		color: $color-text-primary;
		cursor: pointer;
		border-radius: $radius-sm;
		text-align: left;
		white-space: nowrap;
		transition: background 150ms ease;

		&:hover {
			background: #f3f4f6;
		}
	}

	.presetActive {
		background: #eff6ff;
		color: #2563eb;
		font-weight: 600;
	}

	.calendars {
		display: flex;
		padding: 12px;
		gap: 16px;
	}

	.calendarPanel {
		width: 280px;
	}

	.calHeader {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 4px;
	}

	.calTitle {
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
	}

	.calNav {
		display: flex;
		gap: 4px;
	}

	.navBtn {
		border: none;
		background: none;
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 4px;
		color: #6b7280;
		font-size: 14px;
		line-height: 1;

		&:hover {
			background: #f3f4f6;
		}
	}

	.dayHeaders {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		text-align: center;
	}

	.dayHeader {
		padding: 4px 0;
		font-size: 12px;
		color: #6b7280;
	}

	.dayGrid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		text-align: center;
	}

	.dayCell {
		padding: 2px;
		cursor: pointer;
	}

	.day {
		width: 32px;
		height: 32px;
		line-height: 32px;
		margin: auto;
		border-radius: 6px;
		font-size: 13px;
		color: #1f2937;
		transition: background 0.15s ease;

		&:hover {
			background: #f3f4f6;
		}
	}

	.dayOutside {
		color: #d1d5db;
		cursor: default;

		&:hover {
			background: transparent;
		}
	}

	.daySelected {
		background: #3b82f6 !important;
		color: white !important;
		font-weight: 600;
	}

	.dayInRange {
		background: #eff6ff;
		color: #1e40af;
	}

	.dayToday {
		border: 1px solid #3b82f6;
		font-weight: 600;
	}
</style>
