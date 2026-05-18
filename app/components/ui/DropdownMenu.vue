<script setup lang="ts">
export interface DropdownMenuItem {
	label: string;
	icon: string;
	action: () => void;
	variant?: 'danger';
	hidden?: boolean;
}

const props = defineProps<{
	items: DropdownMenuItem[];
}>();

const isOpen = ref(false);
const triggerRef = ref<HTMLElement>();
const menuRef = ref<HTMLElement>();
const menuStyle = ref<Record<string, string>>({});

const visibleItems = computed(() => props.items.filter(i => !i.hidden));

function toggle() {
	if (isOpen.value) close();
	else open();
}

function open() {
	updatePosition();
	isOpen.value = true;
}

function close() {
	isOpen.value = false;
}

function handleItemClick(item: DropdownMenuItem) {
	item.action();
	close();
}

function updatePosition() {
	if (!triggerRef.value) return;
	const rect = triggerRef.value.getBoundingClientRect();
	const MENU_W = 192;
	// Align right edge of menu to right edge of trigger; clamp to viewport
	const left = Math.max(8, rect.right - MENU_W);
	menuStyle.value = {
		position: 'fixed',
		top: `${rect.bottom + 4}px`,
		left: `${left}px`,
		zIndex: '9999',
	};
}

function handleClickOutside(e: MouseEvent) {
	const t = e.target as Node;
	if (!triggerRef.value?.contains(t) && !menuRef.value?.contains(t)) {
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
	<div ref="triggerRef" class="relative inline-block">
		<!-- Kebab trigger -->
		<button
			type="button"
			:class="[
				'p-1.5 rounded-lg transition-colors',
				isOpen
					? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
					: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
			]"
			@click="toggle"
		>
			<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
				<circle cx="12" cy="5" r="1.5" />
				<circle cx="12" cy="12" r="1.5" />
				<circle cx="12" cy="19" r="1.5" />
			</svg>
		</button>

		<!-- Dropdown menu -->
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
					ref="menuRef"
					:style="menuStyle"
					class="w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 overflow-hidden"
				>
					<button
						v-for="item in visibleItems"
						:key="item.label"
						type="button"
						:class="[
							'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left',
							item.variant === 'danger'
								? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
								: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50',
						]"
						@click="handleItemClick(item)"
					>
						<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
							<path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
						</svg>
						{{ item.label }}
					</button>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>
