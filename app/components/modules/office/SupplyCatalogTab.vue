<script setup lang="ts">
	import CatalogItemRow from '~/components/modules/office/CatalogItemRow.vue';
	import SupplyGroupFormDialog from '~/components/modules/office/SupplyGroupFormDialog.vue';
	import SupplyImportDrawer from '~/components/modules/office/SupplyImportDrawer.vue';
	import SupplyItemFormDialog from '~/components/modules/office/SupplyItemFormDialog.vue';
	import { useInjectedSupplyCatalog } from '~/composables/useSupplyCatalog';
	import type { SupplyItem } from '~/types/office.types';

	/**
	 * Thẻ "Văn phòng phẩm" của Cài đặt hành chính: danh mục lên đầu, nhập Excel vào ngăn kéo.
	 *
	 * Xem và sửa danh mục là việc thường ngày, nhập Excel là việc một lần; nên danh sách mặt hàng nằm
	 * ngay dưới tiêu đề với thanh tìm, lọc dính trên cùng, còn khối nhập file chỉ mở khi cần.
	 */
	const {
		canEdit,
		groups,
		items,
		loadingSupplies,
		loadError,
		loadSupplies,
		groupOptions,
		unitSuggestions,
		search,
		filterGroupId,
		onlyUnpriced,
		showInactive,
		hasFilter,
		clearFilters,
		catalog,
		unpricedCount,
		inactiveCount,
		isGroupOpen,
		setGroupOpen,
		setAllOpen,
		showGroupForm,
		openGroupCreate,
		openGroupEdit,
		showItemForm,
		openItemCreate,
		openItemEdit,
		inlineGroupId,
		inlineItem,
		savingInline,
		inlineNameError,
		toggleInlineAdd,
		saveInlineItem,
		flashed,
		savePrice,
		togglingItemId,
		toggleItemActive,
		importOpen,
		openImport,
	} = useInjectedSupplyCatalog();

	/** Danh sách nhóm thu gọn mặc định: ít khi sửa, mở ra khi cần. */
	const groupsOpen = ref(false);

	const toolbarRef = ref<HTMLElement | null>(null);
	const { bottom: toolbarBottom } = useStickyBottom(toolbarRef);

	const hrOnlyCount = computed(() => groups.value.filter(g => g.hrOnly).length);
	const canAddItem = computed(() => canEdit.value && groupOptions.value.length > 0);
	const allOpen = computed(() => catalog.value.sections.every(section => isGroupOpen(section.group.id)));

	const inlineInputCls =
		'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const HR_ONLY_HINT = 'Nhóm chỉ HCNS đặt không hiện trong ô chọn của nhân viên phòng ban, chỉ HCNS thêm được khi làm phiếu bổ sung.';

	function savePriceOf(item: SupplyItem) {
		return (unitPrice: number) => savePrice(item, unitPrice);
	}

	function chipCls(active: boolean): string {
		return [
			'inline-flex max-w-[18rem] shrink-0 items-center gap-1 truncate rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
			active
				? 'border-brand-500 bg-brand-600 text-white'
				: 'border-gray-300 bg-white text-gray-700 hover:border-brand-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
		].join(' ');
	}
</script>

<template>
	<div class="space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-base font-semibold text-gray-900 dark:text-white">Văn phòng phẩm</h2>
			<CommonAppButton data-tour="supply-import" variant="outline" @click="openImport">Nhập từ Excel</CommonAppButton>
		</div>

		<div v-if="loadingSupplies" class="space-y-3" aria-busy="true">
			<div class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			role="alert"
			class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
		>
			<p>{{ loadError }}</p>
			<CommonAppButton class="mt-3" size="sm" variant="outline" @click="loadSupplies()">Thử lại</CommonAppButton>
		</div>

		<template v-else>
			<!-- Mặt hàng -->
			<section
				class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
				aria-labelledby="supply-items-title"
			>
				<!--
					Thanh tìm, lọc dính dưới đầu trang; `-top-4 lg:-top-6` bù phần đệm của `<main>` như trang Văn
					phòng phẩm của nhân viên, tiêu đề nhóm dính ngay dưới mép của nó (`useStickyBottom`).
				-->
				<div
					ref="toolbarRef"
					data-tour="supply-toolbar"
					class="sticky -top-4 z-20 space-y-2 rounded-t-xl border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:-top-6 dark:border-gray-700 dark:bg-gray-900/95"
				>
					<div class="flex flex-wrap items-center gap-3">
						<h3 id="supply-items-title" class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							Mặt hàng · <span class="tabular-nums">{{ catalog.total }}</span>
						</h3>
						<div class="relative min-w-0 max-w-sm flex-1">
							<svg class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
							</svg>
							<input
								v-model="search"
								type="search"
								aria-label="Tìm mặt hàng"
								placeholder="Tìm mặt hàng (gõ không dấu cũng được)"
								class="h-9 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>
						<div class="ml-auto flex flex-col items-end">
							<CommonAppButton
								v-if="canEdit"
								data-tour="supply-item-add"
								size="sm"
								variant="primary"
								:disabled="!canAddItem"
								:aria-describedby="canAddItem ? undefined : 'supply-add-item-hint'"
								@click="openItemCreate()"
							>
								+ Thêm mặt hàng
							</CommonAppButton>
							<span v-if="canEdit && !canAddItem" id="supply-add-item-hint" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								Tạo nhóm trước
							</span>
						</div>
					</div>

					<div class="-mb-1 flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Lọc theo nhóm">
						<button type="button" :aria-pressed="!filterGroupId" :class="chipCls(!filterGroupId)" @click="filterGroupId = undefined">
							Tất cả {{ catalog.total }}
						</button>
						<button
							v-for="chip in catalog.chips"
							:key="chip.group.id"
							type="button"
							:title="chip.group.name"
							:aria-pressed="filterGroupId === chip.group.id"
							:class="chipCls(filterGroupId === chip.group.id)"
							@click="filterGroupId = filterGroupId === chip.group.id ? undefined : chip.group.id"
						>
							<span class="truncate">{{ chip.group.name }}</span>
							<span v-if="chip.group.hrOnly" class="shrink-0 opacity-80">· HCNS</span>
							<span class="shrink-0 tabular-nums">{{ chip.count }}</span>
						</button>
					</div>

					<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
						<label class="inline-flex cursor-pointer items-center gap-2">
							<input v-model="onlyUnpriced" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							Thiếu đơn giá ({{ unpricedCount }})
						</label>
						<label v-if="inactiveCount > 0" class="inline-flex cursor-pointer items-center gap-2">
							<input v-model="showInactive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							Đã ngừng dùng
						</label>
						<button
							v-if="catalog.sections.length > 1 && !search.trim()"
							type="button"
							class="ml-auto rounded text-sm font-medium text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400"
							@click="setAllOpen(!allOpen)"
						>
							{{ allOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả' }}
						</button>
					</div>
				</div>

				<p v-if="!groups.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
					Chưa có nhóm nào. Bạn tạo nhóm ở khối Nhóm văn phòng phẩm bên dưới, hoặc
					<button type="button" class="font-medium text-brand-600 hover:underline dark:text-brand-400" @click="openImport">
						nhập từ Excel</button
					>.
				</p>
				<p v-else-if="!items.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
					Chưa có mặt hàng nào. Bạn
					<button v-if="canAddItem" type="button" class="font-medium text-brand-600 hover:underline dark:text-brand-400" @click="openItemCreate()">
						thêm mặt hàng</button
					><template v-else>thêm mặt hàng</template> hoặc
					<button type="button" class="font-medium text-brand-600 hover:underline dark:text-brand-400" @click="openImport">
						nhập từ Excel</button
					>.
				</p>
				<div v-else-if="!catalog.sections.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
					<p>Không có mặt hàng phù hợp.</p>
					<CommonAppButton v-if="hasFilter" class="mt-3" size="sm" variant="outline" @click="clearFilters">Xoá bộ lọc</CommonAppButton>
				</div>

				<div v-else data-catalog-list>
					<section
						v-for="(section, sectionIndex) in catalog.sections"
						:key="section.group.id"
						:aria-label="section.group.name"
					>
						<div
							class="sticky z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-50 pr-3 dark:border-gray-700 dark:bg-gray-800"
							:style="{ top: `${toolbarBottom}px` }"
						>
							<button
								type="button"
								class="flex min-w-0 flex-1 items-center gap-2 px-4 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
								:aria-expanded="isGroupOpen(section.group.id)"
								@click="setGroupOpen(section.group.id, !isGroupOpen(section.group.id))"
							>
								<svg
									:class="['h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform', isGroupOpen(section.group.id) ? 'rotate-90' : '']"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
									aria-hidden="true"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
								</svg>
								<span class="min-w-0 text-xs font-semibold uppercase tracking-wide text-gray-700 [overflow-wrap:anywhere] dark:text-gray-200">
									{{ section.group.name }}
								</span>
								<span class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">· {{ section.items.length }}</span>
								<span
									v-if="section.group.hrOnly"
									:title="HR_ONLY_HINT"
									class="inline-flex shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
								>
									Chỉ HCNS đặt
								</span>
								<span
									v-if="!section.group.isActive"
									class="inline-flex shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
								>
									Ngừng dùng
								</span>
							</button>
							<!-- Nhóm ngừng dùng không nhận mặt hàng mới, giống ô chọn nhóm của form chung. -->
							<button
								v-if="canEdit && section.group.isActive"
								type="button"
								:aria-label="`Thêm nhanh mặt hàng vào ${section.group.name}`"
								:aria-expanded="inlineGroupId === section.group.id"
								:class="[
									'inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
									inlineGroupId === section.group.id
										? 'bg-brand-600 text-white hover:bg-brand-700'
										: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50',
								]"
								@click="toggleInlineAdd(section.group.id)"
							>
								+ Thêm nhanh
							</button>
						</div>

						<div v-if="isGroupOpen(section.group.id)" class="divide-y divide-gray-100 dark:divide-gray-800">
							<!-- Enter là lưu, Esc là đóng dòng, để gõ liền một loạt mặt hàng không cần chuột. -->
							<div
								v-if="inlineGroupId === section.group.id"
								class="flex flex-wrap items-start gap-2 bg-brand-50/60 px-4 py-2 dark:bg-brand-900/10"
								@keydown.enter.prevent="saveInlineItem"
								@keydown.esc="inlineGroupId = null"
							>
								<div class="min-w-0 flex-1 basis-48">
									<input
										id="inline-item-name"
										v-model="inlineItem.name"
										type="text"
										maxlength="255"
										aria-label="Tên mặt hàng"
										:class="inlineInputCls"
										placeholder="Tên mặt hàng"
									/>
									<p v-if="inlineNameError" role="alert" class="mt-1 text-xs text-red-500">{{ inlineNameError }}</p>
								</div>
								<input
									v-model="inlineItem.unit"
									type="text"
									maxlength="50"
									list="supply-unit-suggestions-inline"
									aria-label="Đơn vị tính"
									:class="[inlineInputCls, 'w-28']"
									placeholder="Đơn vị"
								/>
								<div class="w-36">
									<UiNumberInput v-model="inlineItem.unitPrice" :min="0" :input-class="inlineInputCls" placeholder="Đơn giá" />
								</div>
								<div class="flex gap-2">
									<CommonAppButton size="sm" variant="ghost" @click="inlineGroupId = null">Huỷ</CommonAppButton>
									<CommonAppButton
										size="sm"
										variant="primary"
										:disabled="!inlineItem.name.trim() || !inlineItem.unit.trim()"
										:loading="savingInline"
										@click="saveInlineItem"
									>
										Lưu
									</CommonAppButton>
								</div>
							</div>

							<!-- Mốc của hướng dẫn chỉ ở dòng đầu: ô sáng ôm cả danh sách thì không chỉ được gì. -->
							<CatalogItemRow
								v-for="(item, itemIndex) in section.items"
								:key="item.id"
								:data-tour="sectionIndex === 0 && itemIndex === 0 ? 'supply-item-groups' : undefined"
								:item="item"
								:can-edit="canEdit"
								:flashed="flashed.has(item.id)"
								:toggling="togglingItemId === item.id"
								:save-price="savePriceOf(item)"
								@edit="openItemEdit(item)"
								@toggle-active="toggleItemActive(item)"
							/>

							<div
								v-if="!section.items.length && inlineGroupId !== section.group.id"
								class="flex flex-wrap items-center justify-center gap-2 px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
							>
								Nhóm này chưa có mặt hàng.
								<button
									v-if="canEdit && section.group.isActive"
									type="button"
									class="font-medium text-brand-600 hover:underline dark:text-brand-400"
									@click="openItemCreate(section.group.id)"
								>
									+ Thêm mặt hàng
								</button>
							</div>
						</div>
					</section>
				</div>
				<datalist id="supply-unit-suggestions-inline">
					<option v-for="unit in unitSuggestions" :key="unit" :value="unit" />
				</datalist>
			</section>

			<!-- Nhóm văn phòng phẩm: thu gọn mặc định, ít khi cần sửa. -->
			<section
				class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
				aria-labelledby="supply-groups-title"
			>
				<div class="flex flex-wrap items-center gap-2 px-4 py-2.5">
					<button
						type="button"
						:aria-expanded="groupsOpen"
						aria-controls="supply-groups-list"
						class="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
						@click="groupsOpen = !groupsOpen"
					>
						<svg :class="['h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform', groupsOpen ? 'rotate-90' : '']" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
						<h3 id="supply-groups-title" class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							Nhóm văn phòng phẩm
							<span class="font-normal text-gray-500 dark:text-gray-400">
								· {{ groups.length }} nhóm<template v-if="hrOnlyCount">, {{ hrOnlyCount }} nhóm chỉ HCNS đặt</template>
							</span>
						</h3>
					</button>
					<CommonAppButton v-if="canEdit" data-tour="supply-group-add" size="sm" variant="outline" @click="openGroupCreate">
						Thêm nhóm
					</CommonAppButton>
				</div>
				<div v-if="groupsOpen" id="supply-groups-list" class="border-t border-gray-200 dark:border-gray-700">
					<p v-if="!groups.length" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
						Chưa có nhóm nào. Bạn nhập file đăng ký, hoặc bấm Thêm nhóm.
					</p>
					<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
						<li v-for="group in groups" :key="group.id" class="flex min-h-10 flex-wrap items-center gap-2 px-4 py-1.5">
							<span class="min-w-0 flex-1 text-sm font-medium text-gray-900 [overflow-wrap:anywhere] dark:text-white">{{ group.name }}</span>
							<span
								v-if="group.hrOnly"
								data-testid="hr-only-badge"
								:title="HR_ONLY_HINT"
								class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
							>
								Chỉ HCNS đặt
							</span>
							<span
								v-if="!group.isActive"
								class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
							>
								Ngừng dùng
							</span>
							<button
								v-if="canEdit"
								type="button"
								:aria-label="`Sửa nhóm ${group.name}`"
								class="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
								@click="openGroupEdit(group)"
							>
								Sửa
							</button>
						</li>
					</ul>
				</div>
			</section>
		</template>

		<SupplyItemFormDialog v-if="showItemForm" />
		<SupplyGroupFormDialog v-if="showGroupForm" />
		<SupplyImportDrawer v-if="importOpen" />
	</div>
</template>
