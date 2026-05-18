<script setup lang="ts">
export interface SelectOption {
	value: string | number | undefined;
	label: string;
}

const props = withDefaults(
	defineProps<{
		modelValue?: string | number;
		options: SelectOption[];
		placeholder?: string;
		disabled?: boolean;
		label?: string;
		error?: string;
		hint?: string;
		id?: string;
	}>(),
	{ placeholder: 'Chọn...' },
);

const emit = defineEmits<{
	'update:modelValue': [value: string | number | undefined];
	blur: [];
}>();

const isOpen = ref(false);
const triggerRef = ref<HTMLElement>();
const listRef = ref<HTMLElement>();
const dropdownStyle = ref<Record<string, string>>({});
const inputId = computed(() => props.id ?? `ui-select-${Math.random().toString(36).slice(2)}`);

// ─── Matching helpers ─────────────────────────────────────────────────────────

function isEmpty(v: unknown): boolean {
	return v === undefined || v === null || v === '';
}

function optionMatches(optVal: string | number | undefined, modelVal: string | number | undefined): boolean {
	if (isEmpty(optVal) && isEmpty(modelVal)) return true;
	if (isEmpty(optVal) || isEmpty(modelVal)) return false;
	return String(optVal) === String(modelVal);
}

const selectedLabel = computed(() => {
	const matched = props.options.find(o => optionMatches(o.value, props.modelValue));
	return matched?.label ?? null;
});

// ─── Dropdown control ─────────────────────────────────────────────────────────

function open() {
	if (props.disabled) return;
	updatePosition();
	isOpen.value = true;
}

function close() {
	isOpen.value = false;
	emit('blur');
}

function updatePosition() {
	if (!triggerRef.value) return;
	const rect = triggerRef.value.getBoundingClientRect();
	dropdownStyle.value = {
		position: 'fixed',
		top: `${rect.bottom + 4}px`,
		left: `${rect.left}px`,
		width: `${rect.width}px`,
		zIndex: '9999',
	};
}

function select(value: string | number | undefined) {
	emit('update:modelValue', value);
	close();
}

function handleClickOutside(e: MouseEvent) {
	const t = e.target as Node;
	if (!triggerRef.value?.contains(t) && !listRef.value?.contains(t)) {
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
</script>

<template>
	<div class="flex flex-col gap-1">
		<label v-if="label" :for="inputId" class="text-sm font-medium text-gray-700 dark:text-gray-300">
			{{ label }}
		</label>

		<!-- Trigger button -->
		<div ref="triggerRef">
			<button
				:id="inputId"
				type="button"
				:disabled="disabled"
				:class="[
					'flex items-center justify-between w-full rounded-lg border px-3 py-2.5 text-sm text-left transition-colors',
					'focus:outline-none focus:ring-2 focus:ring-offset-0',
					'disabled:opacity-50 disabled:cursor-not-allowed',
					error
						? 'border-red-400 focus:ring-red-300 bg-white dark:bg-gray-800'
						: isOpen
							? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-800 bg-white dark:bg-gray-800'
							: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500',
					selectedLabel ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500',
				]"
				@click="open"
			>
				<span class="truncate">{{ selectedLabel ?? placeholder }}</span>
				<svg
					:class="[
						'w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform duration-150',
						isOpen ? 'rotate-180' : '',
					]"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
		</div>

		<!-- Dropdown list (Teleported to body to avoid z-index issues) -->
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
					ref="listRef"
					:style="dropdownStyle"
					class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto"
				>
					<button
						v-for="opt in options"
						:key="String(opt.value)"
						type="button"
						:class="[
							'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2',
							optionMatches(opt.value, modelValue)
								? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium'
								: isEmpty(opt.value)
									? 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
									: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50',
						]"
						@click="select(opt.value)"
					>
						<svg
							v-if="optionMatches(opt.value, modelValue)"
							class="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
						<span v-else class="w-3.5 flex-shrink-0" />
						{{ opt.label }}
					</button>
				</div>
			</Transition>
		</Teleport>

		<p v-if="error" class="text-xs text-red-500 dark:text-red-400">{{ error }}</p>
		<p v-else-if="hint" class="text-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
	</div>
</template>
