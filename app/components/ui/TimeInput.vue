<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		modelValue?: string; // "HH:mm"
		placeholder?: string;
		disabled?: boolean;
		error?: string;
	}>(),
	{ placeholder: '--:--' },
);

const emit = defineEmits<{
	'update:modelValue': [value: string];
	blur: [];
}>();

const ITEM_H = 36;
const VISIBLE = 5;

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const isOpen = ref(false);
const triggerRef = ref<HTMLElement>();
const dropdownRef = ref<HTMLElement>();
const dropdownStyle = ref<Record<string, string>>({});
const hourListRef = ref<HTMLElement>();
const minuteListRef = ref<HTMLElement>();

const selectedHour = computed(() => props.modelValue?.split(':')[0] ?? '08');
const selectedMinute = computed(() => props.modelValue?.split(':')[1] ?? '00');

function updatePosition() {
	if (!triggerRef.value) return;
	const rect = triggerRef.value.getBoundingClientRect();
	dropdownStyle.value = {
		position: 'fixed',
		top: `${rect.bottom + 4}px`,
		left: `${rect.left}px`,
		width: `${Math.max(rect.width, 160)}px`,
		zIndex: '9999',
	};
}

function scrollToSelected() {
	const containerH = ITEM_H * VISIBLE;
	const hIdx = hours.indexOf(selectedHour.value);
	const mIdx = minutes.indexOf(selectedMinute.value);
	if (hourListRef.value) {
		hourListRef.value.scrollTop = Math.max(0, hIdx * ITEM_H - containerH / 2 + ITEM_H / 2);
	}
	if (minuteListRef.value) {
		minuteListRef.value.scrollTop = Math.max(0, mIdx * ITEM_H - containerH / 2 + ITEM_H / 2);
	}
}

function open() {
	if (props.disabled) return;
	updatePosition();
	isOpen.value = true;
	nextTick(scrollToSelected);
}

function selectHour(h: string) {
	emit('update:modelValue', `${h}:${selectedMinute.value}`);
	nextTick(() => {
		if (minuteListRef.value) minuteListRef.value.focus?.();
	});
}

function selectMinute(m: string) {
	emit('update:modelValue', `${selectedHour.value}:${m}`);
}

function handleClickOutside(e: MouseEvent) {
	const t = e.target as Node;
	if (!triggerRef.value?.contains(t) && !dropdownRef.value?.contains(t)) {
		isOpen.value = false;
		emit('blur');
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
</script>

<template>
	<!-- Trigger -->
	<div ref="triggerRef">
		<button
			type="button"
			:disabled="disabled"
			:class="[
				'flex items-center justify-between w-full rounded-lg border px-3 py-2.5 text-sm font-mono text-left transition-colors',
				'focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
				error
					? 'border-red-400 bg-white dark:bg-gray-800'
					: isOpen
						? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-800 bg-white dark:bg-gray-800'
						: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500',
				modelValue ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500',
			]"
			@click="open"
		>
			<span>{{ modelValue ?? placeholder }}</span>
			<svg
				class="w-4 h-4 text-gray-400 flex-shrink-0"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
		</button>
	</div>

	<!-- Dropdown -->
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-100"
			enter-from-class="opacity-0 translate-y-1"
			enter-to-class="opacity-100 translate-y-0"
			leave-active-class="transition ease-in duration-75"
			leave-from-class="opacity-100 translate-y-0"
			leave-to-class="opacity-0 translate-y-1"
		>
			<div
				v-if="isOpen"
				ref="dropdownRef"
				:style="dropdownStyle"
				class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden select-none"
			>
				<!-- Header: live preview of selected time -->
				<div
					class="flex items-center justify-center gap-1 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700"
				>
					<span class="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white leading-none">
						{{ selectedHour }}
					</span>
					<span class="text-2xl font-bold text-gray-400 dark:text-gray-500 leading-none -mt-px">:</span>
					<span class="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white leading-none">
						{{ selectedMinute }}
					</span>
				</div>

				<!-- Column labels -->
				<div class="flex border-b border-gray-100 dark:border-gray-700">
					<div class="flex-1 text-center py-1 text-[11px] font-medium text-gray-400 dark:text-gray-500 tracking-wide">
						GIỜ
					</div>
					<div class="w-px bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
					<div class="flex-1 text-center py-1 text-[11px] font-medium text-gray-400 dark:text-gray-500 tracking-wide">
						PHÚT
					</div>
				</div>

				<!-- Scroll columns -->
				<div class="flex" :style="`height: ${ITEM_H * VISIBLE}px`">
					<!-- Hours: 00–23 -->
					<div
						ref="hourListRef"
						class="flex-1 overflow-y-auto overscroll-contain"
						style="scrollbar-width: thin; scrollbar-color: #e5e7eb transparent;"
					>
						<button
							v-for="h in hours"
							:key="h"
							type="button"
							:style="`height: ${ITEM_H}px`"
							:class="[
								'w-full flex items-center justify-center font-mono text-sm transition-colors',
								h === selectedHour
									? 'bg-brand-600 text-white font-semibold'
									: 'text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-gray-700/50 hover:text-brand-700 dark:hover:text-brand-300',
							]"
							@click="selectHour(h)"
						>
							{{ h }}
						</button>
					</div>

					<!-- Divider -->
					<div class="w-px bg-gray-100 dark:bg-gray-700 flex-shrink-0" />

					<!-- Minutes: 00–59 -->
					<div
						ref="minuteListRef"
						class="flex-1 overflow-y-auto overscroll-contain"
						style="scrollbar-width: thin; scrollbar-color: #e5e7eb transparent;"
					>
						<button
							v-for="m in minutes"
							:key="m"
							type="button"
							:style="`height: ${ITEM_H}px`"
							:class="[
								'w-full flex items-center justify-center font-mono text-sm transition-colors',
								m === selectedMinute
									? 'bg-brand-600 text-white font-semibold'
									: 'text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-gray-700/50 hover:text-brand-700 dark:hover:text-brand-300',
							]"
							@click="selectMinute(m)"
						>
							{{ m }}
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
