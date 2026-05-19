<template>
	<div :class="[$style.selectWrapper, isOpen && $style.selectWrapperOpen]" ref="wrapperRef">
		<!-- Trigger -->
		<div
			:class="[
				$style.selectTrigger,
				isOpen && $style.selectTriggerOpen,
				error && $style.selectTriggerError,
				disabled && $style.selectTriggerDisabled,
			]"
			tabindex="0"
			@click="!disabled && openDropdown()"
			@keydown.enter.prevent="!disabled && openDropdown()"
			@keydown.space.prevent="!disabled && openDropdown()"
		>
			<div :class="$style.triggerContent">
				<span v-if="selectedLabel && !isOpen" :class="$style.selectedLabel">{{ selectedLabel }}</span>
				<span v-else-if="!isOpen" :class="$style.placeholder">{{ placeholder }}</span>

				<!-- Search input (visible when open) -->
				<input
					v-if="isOpen"
					ref="searchInputRef"
					v-model="searchQuery"
					:class="[$style.searchInput, 'none-focus']"
					:placeholder="searchPlaceholder"
					@click.stop
					@keydown.esc.prevent="closeDropdown"
					@keydown.enter.prevent="selectHighlighted"
					@keydown.arrow-down.prevent="moveHighlight(1)"
					@keydown.arrow-up.prevent="moveHighlight(-1)"
				/>
			</div>
			<Icon
				v-if="!isOpen || !searchQuery"
				name="heroicons:chevron-down-20-solid"
				:class="[$style.arrow, isOpen && $style.arrowRotate]"
			/>
			<button v-if="isOpen && searchQuery" :class="$style.clearBtn" @click.stop="clearSearch" tabindex="-1">
				<Icon name="mdi:close" :class="$style.clearIcon" />
			</button>
		</div>

		<!-- Dropdown -->
		<transition name="fade">
			<div v-if="isOpen" :class="$style.dropdown">
				<!-- No results -->
				<div v-if="filteredOptions.length === 0" :class="$style.noResult">
					<Icon name="mdi:magnify-close" :class="$style.noResultIcon" />
					<span>Không tìm thấy kết quả</span>
				</div>

				<div
					v-for="(option, index) in filteredOptions"
					:key="option.value"
					:class="[
						$style.option,
						option.type === 'action' && $style.optionAction,
						modelValue === option.value && !option.type && $style.optionSelected,
						highlightedIndex === index && $style.optionHighlighted,
					]"
					@mouseenter="highlightedIndex = index"
					@mouseleave="highlightedIndex = -1"
					@click="selectOption(option.value, option.type)"
				>
					<!-- Highlighted label match -->
					<span :class="$style.optionLabel" v-html="highlightMatch(option.label)" />
					<Icon v-if="modelValue === option.value && !option.type" name="mdi:check" :class="$style.checkIcon" />
					<Icon v-if="option.type === 'action'" name="mdi:plus" :class="$style.actionIcon" />
				</div>
			</div>
		</transition>
	</div>
</template>

<script setup lang="ts">
	interface Option {
		label: string;
		value: string | number;
		type?: 'normal' | 'action';
	}

	interface Props {
		modelValue: string | number | null;
		options: Option[];
		placeholder?: string;
		searchPlaceholder?: string;
		error?: boolean;
		disabled?: boolean;
	}

	const props = withDefaults(defineProps<Props>(), {
		placeholder: 'Chọn...',
		searchPlaceholder: 'Tìm kiếm...',
	});

	const emit = defineEmits<{
		'update:modelValue': [value: string | number];
		action: [value: string | number];
	}>();

	const isOpen = ref(false);
	const searchQuery = ref('');
	const wrapperRef = ref<HTMLElement | null>(null);
	const searchInputRef = ref<HTMLInputElement | null>(null);
	const highlightedIndex = ref(-1);

	const selectedLabel = computed(() => {
		const option = props.options.find(o => String(o.value) === String(props.modelValue));
		return option ? option.label : '';
	});

	const filteredOptions = computed(() => {
		if (!searchQuery.value.trim()) return props.options;
		const q = searchQuery.value.trim().toLowerCase();
		return props.options.filter(o => o.label.toLowerCase().includes(q));
	});

	function highlightMatch(label: string): string {
		if (!searchQuery.value.trim()) return label;
		const q = searchQuery.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return label.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
	}

	function openDropdown() {
		isOpen.value = true;
		searchQuery.value = '';
		highlightedIndex.value = -1;
		nextTick(() => searchInputRef.value?.focus());
	}

	function closeDropdown() {
		isOpen.value = false;
		searchQuery.value = '';
		highlightedIndex.value = -1;
	}

	function toggleDropdown() {
		isOpen.value ? closeDropdown() : openDropdown();
	}

	function clearSearch() {
		searchQuery.value = '';
		searchInputRef.value?.focus();
	}

	function selectOption(value: string | number, type?: string) {
		if (props.disabled) return;
		if (type === 'action') {
			emit('action', value);
			closeDropdown();
		} else {
			emit('update:modelValue', value);
			closeDropdown();
		}
	}

	function moveHighlight(dir: 1 | -1) {
		const len = filteredOptions.value.length;
		if (len === 0) return;
		highlightedIndex.value = (highlightedIndex.value + dir + len) % len;
	}

	function selectHighlighted() {
		if (highlightedIndex.value >= 0 && filteredOptions.value[highlightedIndex.value]) {
			const opt = filteredOptions.value[highlightedIndex.value];
			selectOption(opt.value, opt.type);
		}
	}

	// Reset highlight when filter changes
	watch(searchQuery, () => {
		highlightedIndex.value = -1;
	});

	// Click outside
	const handleClickOutside = (event: MouseEvent) => {
		if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
			closeDropdown();
		}
	};

	onMounted(() => window.addEventListener('mousedown', handleClickOutside));
	onUnmounted(() => window.removeEventListener('mousedown', handleClickOutside));
</script>

<style module lang="scss">
	.selectWrapper {
		position: relative;
		width: 100%;
		z-index: 1;
	}

	.selectWrapperOpen {
		z-index: 50;
	}

	.selectTrigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		border: 1px solid $color-border;
		border-radius: $radius-md;
		background: #fff;
		font-size: $font-size-sm;
		color: $color-text-primary;
		cursor: pointer;
		transition: all $transition-fast;
		height: 38px;
		user-select: none;
		position: relative;
		z-index: 2;

		&:focus {
			outline: none;
		}

		&:hover:not(.selectTriggerDisabled) {
			border-color: $color-primary;
		}
	}

	.selectTriggerOpen {
		border-color: $color-primary;
		box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
	}

	.selectTriggerError {
		border-color: $color-error;
		&:hover {
			border-color: $color-error;
		}
	}

	.selectTriggerDisabled {
		background-color: #f9fafb;
		color: $color-text-secondary;
		cursor: not-allowed;
		opacity: 0.7;
	}

	.triggerContent {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
	}

	.selectedLabel {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.placeholder {
		color: #9ca3af;
	}

	.searchInput {
		flex: 1;
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		font-size: $font-size-sm;
		color: $color-text-primary;
		cursor: text;

		&::placeholder {
			color: #9ca3af;
			font-weight: 400;
		}
	}

	.arrow {
		width: 1.25rem;
		height: 1.25rem;
		color: #6b7280;
		transition: transform $transition-fast;
		margin-left: 0.5rem;
		flex-shrink: 0;
	}

	.arrowRotate {
		transform: rotate(180deg);
	}

	.clearBtn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		padding: 0;
		margin-left: 0.5rem;
		cursor: pointer;
		flex-shrink: 0;
		color: #9ca3af;
		transition: color $transition-fast;

		&:hover {
			color: $color-text-primary;
		}
	}

	.clearIcon {
		width: 1rem;
		height: 1rem;
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: #fff;
		border: 1px solid $color-border;
		border-radius: $radius-md;
		box-shadow: $shadow-lg;
		z-index: 100;
		max-height: 240px;
		overflow-y: auto;
		padding: 4px;
	}

	.noResult {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		font-size: $font-size-sm;
		color: #9ca3af;
		justify-content: center;
	}

	.noResultIcon {
		width: 1rem;
		height: 1rem;
	}

	.option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		font-size: $font-size-sm;
		color: $color-text-primary;
		border-radius: $radius-sm;
		cursor: pointer;
		transition: all $transition-fast;

		&:hover {
			background: #f3f4f6;
			color: $color-primary-dark;
		}
	}

	.optionSelected {
		background: #f0fdf4;
		color: $color-primary-dark;
		font-weight: $font-weight-bold;
	}

	.optionHighlighted {
		background: #f3f4f6;
		color: $color-primary-dark;
	}

	.optionLabel {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		:global(mark) {
			background: #fef08a;
			color: inherit;
			border-radius: 2px;
			padding: 0 1px;
			font-weight: 600;
		}
	}

	.checkIcon {
		color: $color-primary;
		width: 16px;
		height: 16px;
		margin-left: 8px;
	}

	.optionAction {
		border-top: 1px solid $color-border;
		margin-top: 4px;
		padding-top: 0.625rem;
		color: #14b8a6;
		font-weight: 600;

		&:hover {
			background: #f0fdfa;
			color: #0d9488;
		}
	}

	.actionIcon {
		color: #14b8a6;
		width: 16px;
		height: 16px;
		margin-left: 8px;
	}
</style>

<style scoped>
	.fade-enter-active,
	.fade-leave-active {
		transition:
			opacity 0.15s ease,
			transform 0.15s ease;
	}

	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
		transform: translateY(-4px);
	}
</style>
