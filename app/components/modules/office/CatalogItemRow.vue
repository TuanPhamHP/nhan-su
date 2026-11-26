<script setup lang="ts">
	import CatalogPriceCell from '~/components/modules/office/CatalogPriceCell.vue';
	import type { SupplyItem } from '~/types/office.types';

	/**
	 * Một mặt hàng của danh mục: tên, đơn vị, đơn giá (sửa nhanh), trạng thái, nút Sửa và menu ⋯
	 * (ngừng dùng hoặc dùng lại, như ô "Đang dùng" của form sửa).
	 */
	const props = defineProps<{
		item: SupplyItem;
		canEdit: boolean;
		flashed: boolean;
		toggling: boolean;
		savePrice: (unitPrice: number) => Promise<string | null>;
	}>();

	const emit = defineEmits<{ edit: []; toggleActive: [] }>();

	const { open: menuOpen, root: menuRoot, above: menuAbove, alignEnd: menuAlignEnd, toggle: toggleMenu, close: closeMenu } = usePopover();

	function onToggleActive() {
		closeMenu();
		emit('toggleActive');
	}
</script>

<template>
	<div
		:class="[
			'flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 transition-colors duration-700',
			flashed ? 'bg-amber-100 dark:bg-amber-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
			item.isActive ? '' : 'opacity-70',
		]"
	>
		<p
			class="min-w-0 flex-1 basis-48 text-sm leading-snug text-gray-900 [overflow-wrap:anywhere] line-clamp-2 dark:text-white"
			:title="item.name"
		>
			{{ item.name }}
		</p>
		<span class="w-20 shrink-0 text-sm text-gray-600 dark:text-gray-300">{{ item.unit }}</span>
		<div class="w-40 shrink-0">
			<CatalogPriceCell :unit-price="item.unitPrice" :item-name="item.name" :can-edit="canEdit" :save="savePrice" />
		</div>
		<span class="w-24 shrink-0">
			<span
				v-if="!item.isActive"
				class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
			>
				Ngừng dùng
			</span>
		</span>
		<div class="flex w-24 shrink-0 items-center justify-end gap-1">
			<template v-if="canEdit">
				<button
					type="button"
					:aria-label="`Sửa ${item.name}`"
					class="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
					@click="emit('edit')"
				>
					Sửa
				</button>
				<div ref="menuRoot" class="relative">
					<button
						type="button"
						data-popover-trigger
						:aria-label="`Thêm việc với ${item.name}`"
						:aria-expanded="menuOpen"
						aria-haspopup="menu"
						class="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
						@click="toggleMenu()"
					>
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="5" cy="12" r="1.6" />
							<circle cx="12" cy="12" r="1.6" />
							<circle cx="19" cy="12" r="1.6" />
						</svg>
					</button>
					<div
						v-if="menuOpen"
						role="menu"
						:class="[
							'absolute z-40 w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900',
							menuAbove ? 'bottom-full mb-1' : 'top-full mt-1',
							menuAlignEnd ? 'right-0' : 'left-0',
						]"
					>
						<button
							type="button"
							role="menuitem"
							:disabled="toggling"
							class="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
							@click="onToggleActive"
						>
							{{ item.isActive ? 'Ngừng dùng' : 'Dùng lại' }}
						</button>
					</div>
				</div>
			</template>
		</div>
	</div>
</template>
