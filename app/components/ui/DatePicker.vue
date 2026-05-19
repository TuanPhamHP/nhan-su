<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		modelValue?: string;
		placeholder?: string;
		disabled?: boolean;
		label?: string;
		error?: string;
		hint?: string;
		id?: string;
		min?: string;
		max?: string;
	}>(),
	{ placeholder: 'dd/mm/yyyy' },
);

const emit = defineEmits<{
	'update:modelValue': [value: string | undefined];
	blur: [];
}>();

// ─── Text input ───────────────────────────────────────────────────────────────

const wrapperRef = ref<HTMLElement>();
const inputRef = ref<HTMLInputElement>();
const calendarRef = ref<HTMLElement>();
const inputId = computed(() => props.id ?? `ui-datepicker-${Math.random().toString(36).slice(2)}`);

const textValue = ref('');

watch(
	() => props.modelValue,
	val => {
		if (val) {
			const [y, m, d] = val.split('-');
			textValue.value = `${d}/${m}/${y}`;
		} else {
			textValue.value = '';
		}
	},
	{ immediate: true },
);

function onTextInput(e: Event) {
	const raw = (e.target as HTMLInputElement).value;
	const digits = raw.replace(/\D/g, '').slice(0, 8);
	let formatted = '';
	if (digits.length <= 2) {
		formatted = digits;
	} else if (digits.length <= 4) {
		formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
	} else {
		formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
	}
	textValue.value = formatted;
}

function onTextKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter') {
		e.preventDefault();
		parseAndEmit();
		close();
	}
	if (e.key === 'Escape') close();
}

function onTextBlur() {
	parseAndEmit();
	emit('blur');
}

function parseAndEmit() {
	const val = textValue.value;
	if (!val) {
		emit('update:modelValue', undefined);
		return;
	}
	const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (match) {
		const d = Number(match[1]);
		const m = Number(match[2]);
		const y = Number(match[3]);
		const date = new Date(y, m - 1, d);
		if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
			const ymd = toYMD(date);
			emit('update:modelValue', ymd);
			currentMonth.value = y * 12 + (m - 1);
			return;
		}
	}
	// Invalid input — reset display to last valid modelValue
	if (props.modelValue) {
		const [y, m, d] = props.modelValue.split('-');
		textValue.value = `${d}/${m}/${y}`;
	} else {
		textValue.value = '';
	}
}

function clearValue() {
	textValue.value = '';
	emit('update:modelValue', undefined);
}

// ─── Calendar navigation ──────────────────────────────────────────────────────

const today = new Date();
const todayStr = toYMD(today);

const initMonth = () => {
	if (props.modelValue) {
		const [y, m] = props.modelValue.split('-').map(Number);
		return (y ?? today.getFullYear()) * 12 + ((m ?? today.getMonth() + 1) - 1);
	}
	return today.getFullYear() * 12 + today.getMonth();
};

const isOpen = ref(false);
const dropdownStyle = ref<Record<string, string>>({});
const currentMonth = ref(initMonth());
const currentYear = computed(() => Math.floor(currentMonth.value / 12));
const currentMonthIdx = computed(() => ((currentMonth.value % 12) + 12) % 12);

const MONTHS = [
	'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
	'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const monthLabel = computed(() => `${MONTHS[currentMonthIdx.value]}, ${currentYear.value}`);

// ─── Calendar grid ────────────────────────────────────────────────────────────

interface DayCell {
	day: number;
	dateStr: string;
	isCurrentMonth: boolean;
	isDisabled: boolean;
}

const cells = computed<DayCell[]>(() => {
	const year = currentYear.value;
	const month = currentMonthIdx.value;
	const firstDay = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const result: DayCell[] = [];

	const prevDaysInMonth = new Date(year, month, 0).getDate();
	for (let i = firstDay - 1; i >= 0; i--) {
		const d = prevDaysInMonth - i;
		const pm = month === 0 ? 11 : month - 1;
		const py = month === 0 ? year - 1 : year;
		result.push({ day: d, dateStr: toYMD(new Date(py, pm, d)), isCurrentMonth: false, isDisabled: true });
	}
	for (let d = 1; d <= daysInMonth; d++) {
		const ds = toYMD(new Date(year, month, d));
		const isDisabled = (!!props.min && ds < props.min) || (!!props.max && ds > props.max);
		result.push({ day: d, dateStr: ds, isCurrentMonth: true, isDisabled });
	}
	const remaining = 42 - result.length;
	for (let d = 1; d <= remaining; d++) {
		const nm = month === 11 ? 0 : month + 1;
		const ny = month === 11 ? year + 1 : year;
		result.push({ day: d, dateStr: toYMD(new Date(ny, nm, d)), isCurrentMonth: false, isDisabled: true });
	}
	return result;
});

// ─── Selection ────────────────────────────────────────────────────────────────

function isSelected(ds: string) {
	return ds === props.modelValue;
}

function isToday(ds: string) {
	return ds === todayStr;
}

function onSelect(ds: string) {
	emit('update:modelValue', ds);
	const [y, m, d] = ds.split('-');
	textValue.value = `${d}/${m}/${y}`;
	close();
}

function goToToday() {
	currentMonth.value = today.getFullYear() * 12 + today.getMonth();
	onSelect(todayStr);
}

// ─── Open / close ─────────────────────────────────────────────────────────────

function openCalendar() {
	if (props.disabled) return;
	currentMonth.value = initMonth();
	updatePosition();
	isOpen.value = true;
}

function close() {
	isOpen.value = false;
}

const DROPDOWN_W = 294;
const DROPDOWN_H = 330;

function updatePosition() {
	if (!wrapperRef.value) return;
	const rect = wrapperRef.value.getBoundingClientRect();
	const style: Record<string, string> = { position: 'fixed', zIndex: '9999' };

	// Flip upward when not enough space below
	const spaceBelow = window.innerHeight - rect.bottom - 4;
	if (spaceBelow < DROPDOWN_H && rect.top >= DROPDOWN_H) {
		style.bottom = `${window.innerHeight - rect.top + 4}px`;
	} else {
		style.top = `${rect.bottom + 4}px`;
	}

	// Prefer align-left, flip right if overflows
	if (window.innerWidth - rect.left >= DROPDOWN_W) {
		style.left = `${rect.left}px`;
	} else {
		style.right = `${window.innerWidth - rect.right}px`;
	}

	dropdownStyle.value = style;
}

function handleClickOutside(e: MouseEvent) {
	const t = e.target as Node;
	if (!wrapperRef.value?.contains(t) && !calendarRef.value?.contains(t)) {
		isOpen.value = false;
	}
}

onMounted(() => {
	document.addEventListener('mousedown', handleClickOutside);
	window.addEventListener('scroll', updatePosition, true);
	window.addEventListener('resize', updatePosition);
});

onUnmounted(() => {
	document.removeEventListener('mousedown', handleClickOutside);
	window.removeEventListener('scroll', updatePosition, true);
	window.removeEventListener('resize', updatePosition);
});

// ─── Util ─────────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
</script>

<template>
	<div class="flex flex-col gap-1">
		<label v-if="label" :for="inputId" class="text-sm font-medium text-gray-700 dark:text-gray-300">
			{{ label }}
		</label>

		<!-- Input + calendar icon trigger -->
		<div
			ref="wrapperRef"
			:class="[
				'flex items-center w-full rounded-lg border transition-colors',
				'bg-white dark:bg-gray-800',
				disabled ? 'opacity-50 cursor-not-allowed' : '',
				error
					? 'border-red-400 focus-within:ring-2 focus-within:ring-red-300'
					: isOpen
						? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-800'
						: 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200 dark:focus-within:ring-brand-800',
			]"
		>
			<!-- Calendar icon button -->
			<button
				type="button"
				tabindex="-1"
				:disabled="disabled"
				class="pl-3 pr-2 py-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
				@click="openCalendar"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
			</button>

			<!-- Text input -->
			<input
				:id="inputId"
				ref="inputRef"
				v-model="textValue"
				type="text"
				inputmode="numeric"
				:placeholder="placeholder"
				:disabled="disabled"
				class="flex-1 py-2.5 pr-2 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none min-w-0"
				@input="onTextInput"
				@keydown="onTextKeydown"
				@blur="onTextBlur"
				@focus="openCalendar"
			/>

			<!-- Clear button -->
			<button
				v-if="modelValue || textValue"
				type="button"
				tabindex="-1"
				class="pr-3 pl-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
				@click.stop="clearValue"
			>
				<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Calendar popup -->
		<Teleport to="body">
			<Transition
				enter-active-class="transition ease-out duration-100"
				enter-from-class="opacity-0 scale-95"
				enter-to-class="opacity-100 scale-100"
				leave-active-class="transition ease-in duration-75"
				leave-from-class="opacity-100 scale-100"
				leave-to-class="opacity-0 scale-95"
			>
				<div
					v-if="isOpen"
					ref="calendarRef"
					:style="dropdownStyle"
					class="w-[294px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
				>
					<!-- Month header -->
					<div class="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
						<div class="flex items-center gap-0.5">
							<button
								type="button"
								class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs font-bold"
								@click="currentMonth -= 12"
							>
								«
							</button>
							<button
								type="button"
								class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								@click="currentMonth--"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
								</svg>
							</button>
						</div>

						<span class="text-sm font-semibold text-gray-900 dark:text-white select-none">
							{{ monthLabel }}
						</span>

						<div class="flex items-center gap-0.5">
							<button
								type="button"
								class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								@click="currentMonth++"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
								</svg>
							</button>
							<button
								type="button"
								class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs font-bold"
								@click="currentMonth += 12"
							>
								»
							</button>
						</div>
					</div>

					<div class="p-2">
						<!-- Weekday headers -->
						<div class="grid grid-cols-7 mb-1">
							<div
								v-for="d in WEEKDAYS"
								:key="d"
								class="h-8 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-gray-500"
							>
								{{ d }}
							</div>
						</div>

						<!-- Day grid -->
						<div class="grid grid-cols-7">
							<button
								v-for="(cell, i) in cells"
								:key="i"
								type="button"
								:disabled="!cell.isCurrentMonth || cell.isDisabled"
								:class="[
									'h-9 w-full flex items-center justify-center rounded-lg text-sm transition-colors',
									!cell.isCurrentMonth
										? 'text-gray-200 dark:text-gray-700 pointer-events-none'
										: cell.isDisabled
											? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
											: isSelected(cell.dateStr)
												? 'bg-brand-600 text-white font-semibold'
												: isToday(cell.dateStr)
													? 'border border-brand-400 text-brand-700 dark:text-brand-300 font-semibold hover:bg-brand-50 dark:hover:bg-brand-900/20'
													: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
								]"
								@click="onSelect(cell.dateStr)"
							>
								{{ cell.day }}
							</button>
						</div>
					</div>

					<!-- Footer -->
					<div class="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex justify-center">
						<button
							type="button"
							class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
							@click="goToToday"
						>
							Hôm nay
						</button>
					</div>
				</div>
			</Transition>
		</Teleport>

		<p v-if="error" class="text-xs text-red-500 dark:text-red-400">{{ error }}</p>
		<p v-else-if="hint" class="text-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
	</div>
</template>
