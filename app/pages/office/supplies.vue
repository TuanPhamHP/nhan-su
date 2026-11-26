<script setup lang="ts">
	import SupplyCatalogRow from '~/components/modules/office/SupplyCatalogRow.vue';
	import SupplyContactPicker from '~/components/modules/office/SupplyContactPicker.vue';
	import SupplyCustomItemModal from '~/components/modules/office/SupplyCustomItemModal.vue';
	import SupplyReceiveModal from '~/components/modules/office/SupplyReceiveModal.vue';
	import { useMySupplies } from '~/composables/useMySupplies';
	import { formatDate, formatDateTime } from '~/utils/date';
	import {
		SUPPLY_STATUS,
		lockCountdown,
		monthLabel,
		officeMoney,
		supplyLockLabel,
		supplySharesLabel,
		supplyStatusLabel,
		supplyStatusMeta,
		type SupplyCatalogRow as CatalogRow,
	} from '~/utils/office.utils';
	import { OFFICE_PERMISSIONS } from '~/utils/permission';
	import {
		officeSupplyContactTour,
		officeSupplyRegisterTour,
		type OfficeSuppliesTourContext,
	} from '~/tours/office-supplies';
	import type { SupplyRequest, SupplyRequestListItem } from '~/types/office.types';

	/**
	 * Văn phòng phẩm của phòng tôi (UI-01), trang dùng chung cho mọi nhân viên.
	 *
	 * Một form danh mục: mọi mặt hàng phòng được đặt hiện sẵn theo nhóm, mỗi người gõ phần của mình
	 * ngay trên dòng và số tự lưu. Cả phòng cùng nhập vào MỘT phiếu và không có nút nộp: phiếu tự khoá
	 * lúc `period.lockAt`. Logic nạp, lọc và lưu nằm ở `useMySupplies`; trang chỉ bày ra.
	 */
	definePageMeta({ title: 'Văn phòng phẩm' });

	const { user } = useAuth();
	const { hasPermission } = usePermissions();
	const supplies = useMySupplies();
	const {
		requests,
		loadingList,
		listError,
		current,
		loadingDetail,
		detailError,
		pendingRequestId,
		loadingItems,
		itemsError,
		contact,
		savingContact,
		copying,
		copySkipped,
		now,
		canEdit,
		filteredGroups,
		groupChips,
		totalRows,
		search,
		groupFilter,
		onlySelected,
		myCount,
		roomCount,
		saveStatus,
		rowState,
		savedFlash,
		undo,
		notices,
		highlighted,
		contactOptions,
		isDepartmentManager,
		lockPassed,
		readOnlyNotice,
		hasFinalQty,
		hasReceivedQty,
	} = supplies;

	/** Người có quyền mở và theo dõi kỳ: dùng để chỉ đường cho HCNS không thuộc phòng ban nào. */
	const canManagePeriods = computed(() => hasPermission(OFFICE_PERMISSIONS.supplyReport));

	const showReceive = ref(false);
	const contactOpen = ref(false);
	const customOpen = ref(false);
	const customName = ref('');
	/** Dòng chờ xoá cả dòng: hộp xác nhận nêu rõ phần của từng người sẽ mất. */
	const deleteTarget = ref<CatalogRow | null>(null);
	const deleting = ref(false);
	const collapsed = ref(new Set<string>());

	const period = computed(() => current.value?.period ?? null);

	/** Tên kỳ thường đã là "Tháng 12/2026", nên chỉ nhắc lại tháng khi tiêu đề kỳ khác đi. */
	const monthSuffix = computed(() => {
		const p = period.value;
		if (!p) return '';
		const label = monthLabel(p.month);
		return p.title.trim() === label ? '' : label;
	});

	const countdown = computed(() => {
		const p = period.value;
		if (!p || current.value?.status !== 'OPEN') return '';
		return lockPassed.value ? 'Đã quá hạn' : lockCountdown(p.lockAt, now.value);
	});

	function requestLabel(req: SupplyRequestListItem | SupplyRequest): string {
		const parts = [req.period.title, req.period.officeSite.name];
		if (req.isSupplement) parts.push(`bổ sung ${req.sequence}`);
		return parts.join(' · ');
	}

	// ─── Chọn phiếu ───────────────────────────────────────────────────────────

	/**
	 * Phòng có từ hai phiếu đang đăng ký trở lên (hai văn phòng, phiếu bổ sung) thì các phiếu đó hiện
	 * thành thẻ, để thấy ngay mình đang sửa phiếu nào. Phiếu các kỳ trước nằm trong một menu: vẫn phải
	 * mở được để xem số đã chốt và bấm Đã nhận, nhưng không cần chiếm chỗ đầu trang.
	 */
	const openTabs = computed(() => requests.value.filter(r => r.status === 'OPEN'));
	const showTabs = computed(() => openTabs.value.length >= 2);
	const otherRequests = computed(() => requests.value.filter(r => !(showTabs.value && r.status === 'OPEN')));
	const showOtherMenu = computed(() => otherRequests.value.some(r => r.id !== current.value?.id));

	const otherMenuOpen = ref(false);
	const {
		root: otherMenuRoot,
		above: otherMenuAbove,
		alignEnd: otherMenuAlignEnd,
		toggle: toggleOtherMenu,
		close: closeOtherMenu,
	} = usePopover(otherMenuOpen);

	async function pickRequest(id: number) {
		closeOtherMenu();
		await supplies.selectRequest(id);
	}

	// ─── Danh mục ─────────────────────────────────────────────────────────────

	const searching = computed(() => !!search.value.trim());
	const noResults = computed(() => searching.value && !filteredGroups.value.length);

	/** Thanh công cụ dính; tiêu đề nhóm dính ngay dưới mép của nó (`useStickyBottom`). */
	const toolbarRef = ref<HTMLElement | null>(null);
	const { bottom: toolbarBottom } = useStickyBottom(toolbarRef);

	const listRef = ref<HTMLElement | null>(null);

	/** Enter, ↑ và ↓ trong ô số chuyển sang ô của dòng kề bên; ô cuối thì dừng. */
	function moveFocus(direction: 1 | -1) {
		const inputs = [...(listRef.value?.querySelectorAll<HTMLInputElement>('input[data-supply-qty]:not(:disabled)') ?? [])];
		const index = inputs.findIndex(input => input === document.activeElement);
		inputs[index + direction]?.focus();
	}

	function toggleGroup(name: string) {
		const next = new Set(collapsed.value);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		collapsed.value = next;
	}

	function openCustom(name = '') {
		customName.value = name;
		customOpen.value = true;
	}

	async function confirmDelete() {
		const row = deleteTarget.value;
		if (!row || deleting.value) return;
		deleting.value = true;
		if (await supplies.deleteLine(row)) deleteTarget.value = null;
		deleting.value = false;
	}

	function onReceived(updated: SupplyRequest) {
		showReceive.value = false;
		supplies.apply(updated);
	}

	onMounted(() => supplies.init());

	/** Rời trang khi còn số chưa lưu thì lưu trước, không để số biến mất lặng lẽ. */
	onBeforeRouteLeave(async () => {
		await supplies.flush();
	});

	// ─── Hướng dẫn theo tính năng ─────────────────────────────────────────────
	// Mở từ nút Hướng dẫn nổi bên phải, không tự hiện.
	const tourContext: OfficeSuppliesTourContext = {
		hasRequests: () => requests.value.length > 0,
		hasOtherRequests: () => showTabs.value || showOtherMenu.value,
		canEdit: () => canEdit.value,
		hasRows: () => filteredGroups.value.length > 0,
		hasContact: () => !!contact.value,
		isDepartmentManager: () => isDepartmentManager.value,
		isContactFormOpen: () => contactOpen.value,
		closeContactForm: () => (contactOpen.value = false),
	};
	useGuideTour('office-supply-register', () => officeSupplyRegisterTour(tourContext));
	useGuideTour('office-supply-contact', () => officeSupplyContactTour(tourContext));
</script>

<template>
	<div class="space-y-3">
		<UiPageHeader
			title="Văn phòng phẩm của phòng"
			description="Mọi mặt hàng phòng được đặt hiện sẵn theo nhóm. Bạn gõ số mình cần vào ô của mặt hàng rồi bấm Enter, hoặc bấm + và −, số tự lưu. Cả phòng cùng nhập vào một phiếu: ô là phần của bạn, còn Phòng là tổng cả phòng. Không có nút nộp, tới hạn chót phiếu tự khoá."
		/>

		<CommonAppModuleNotice module="OFFICE" />

		<div v-if="loadingList" class="space-y-3" aria-busy="true">
			<div class="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="listError"
			class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
		>
			<p>{{ listError }}</p>
			<CommonAppButton class="mt-3" size="sm" variant="outline" @click="supplies.loadList()">Thử lại</CommonAppButton>
		</div>

		<!--
			Người không thuộc phòng ban nào (giám đốc, nhân sự ở một số công ty) không bao giờ có phiếu,
			nên câu "chờ HCNS mở kỳ" là lời hứa sai: họ chờ mãi cũng không thấy gì.
		-->
		<p
			v-else-if="!requests.length"
			class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
		>
			<template v-if="!user?.department">
				Bạn chưa thuộc phòng ban nào nên không có phiếu văn phòng phẩm.
				<template v-if="canManagePeriods">
					Bạn mở và theo dõi kỳ đăng ký của các phòng ở
					<NuxtLink to="/management/office/supply-periods" class="text-brand-600 hover:underline dark:text-brand-400"
						>Kỳ văn phòng phẩm</NuxtLink
					>.
				</template>
				<template v-else>Cần gì bạn báo HCNS.</template>
			</template>
			<template v-else>
				Phòng bạn chưa có kỳ đăng ký nào. Khi HCNS mở kỳ, bạn sẽ nhận thông báo và phiếu hiện ở đây.
			</template>
		</p>

		<template v-else>
			<!-- Thẻ các phiếu đang đăng ký, chỉ khi có từ hai phiếu trở lên. -->
			<div v-if="showTabs" data-tour="supply-request-tabs" role="tablist" class="flex flex-wrap gap-2">
				<button
					v-for="req in openTabs"
					:key="req.id"
					type="button"
					role="tab"
					:aria-selected="current?.id === req.id"
					:class="[
						'rounded-lg border px-3 py-1.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
						current?.id === req.id
							? 'border-brand-500 bg-brand-50 font-medium text-brand-800 dark:border-brand-500 dark:bg-brand-900/20 dark:text-brand-200'
							: 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
					]"
					@click="supplies.selectRequest(req.id)"
				>
					{{ requestLabel(req) }}
					<span class="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">{{ req.lineCount }} dòng</span>
				</button>
			</div>

			<!-- Thanh kỳ: một khối cho kỳ, hạn chót, mốc khoá, đầu mối và các nút của phiếu. -->
			<section
				data-tour="supply-period-bar"
				class="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<div v-if="loadingDetail" class="space-y-2" aria-busy="true">
					<div class="h-5 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
					<div class="h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
					<div class="h-4 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
				</div>

				<div v-else-if="detailError" class="text-sm text-rose-700 dark:text-rose-300">
					<p>{{ detailError }}</p>
					<CommonAppButton
						v-if="pendingRequestId"
						class="mt-2"
						size="sm"
						variant="outline"
						@click="supplies.openRequest(pendingRequestId)"
					>
						Thử lại
					</CommonAppButton>
				</div>

				<p v-else-if="!current" class="text-sm text-gray-500 dark:text-gray-400">Bạn chọn một phiếu để xem.</p>

				<template v-else>
					<div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
						<div class="min-w-0">
							<h2 class="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-gray-900 dark:text-white">
								<span>
									{{ current.period.title }}
									<span class="font-normal text-gray-500 dark:text-gray-400">
										· {{ current.period.officeSite.name }}
										<template v-if="monthSuffix"> · {{ monthSuffix }}</template>
										<template v-if="current.isSupplement"> · phiếu bổ sung {{ current.sequence }}</template>
									</span>
								</span>
								<span
									:class="[
										'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
										supplyStatusMeta(current.status).class,
									]"
								>
									{{ supplyStatusLabel(current.status, current.lines.length) }}
								</span>
								<span
									v-if="current.period.status === 'CLOSED'"
									:class="['inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', SUPPLY_STATUS.CLOSED.class]"
								>
									Kỳ {{ SUPPLY_STATUS.CLOSED.label.toLocaleLowerCase('vi') }}
								</span>
							</h2>
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
								Hạn chót {{ formatDate(current.period.deadline) }}
								<template v-if="countdown">
									· <span class="font-medium text-amber-600 dark:text-amber-400">{{ countdown }}</span>
									· Phiếu tự khoá lúc {{ supplyLockLabel(current.period.lockAt) }}
								</template>
							</p>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							<div v-if="showOtherMenu" ref="otherMenuRoot" class="relative" :data-tour="showTabs ? undefined : 'supply-request-tabs'">
								<CommonAppButton
									size="sm"
									variant="ghost"
									data-popover-trigger
									:aria-expanded="otherMenuOpen"
									@click="toggleOtherMenu()"
								>
									Phiếu khác
								</CommonAppButton>
								<ul
									v-if="otherMenuOpen"
									role="menu"
									:class="[
										'absolute z-40 max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900',
										otherMenuAbove ? 'bottom-full mb-1' : 'top-full mt-1',
										otherMenuAlignEnd ? 'right-0' : 'left-0',
									]"
								>
									<li v-for="req in otherRequests" :key="req.id">
										<button
											type="button"
											role="menuitem"
											:aria-current="current.id === req.id ? 'true' : undefined"
											:class="[
												'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:hover:bg-gray-800 dark:focus:bg-gray-800',
												current.id === req.id ? 'bg-brand-50 dark:bg-brand-900/20' : '',
											]"
											@click="pickRequest(req.id)"
										>
											<span class="block font-medium text-gray-900 dark:text-white">{{ requestLabel(req) }}</span>
											<span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
												{{ supplyStatusLabel(req.status, req.lineCount) }} · {{ req.lineCount }} dòng
												<template v-if="current.id === req.id"> · đang xem</template>
											</span>
										</button>
									</li>
								</ul>
							</div>
							<CommonAppButton
								v-if="canEdit"
								data-tour="supply-copy-previous"
								size="sm"
								variant="outline"
								:loading="copying"
								@click="supplies.copyPrevious()"
							>
								Lấy số tháng trước
							</CommonAppButton>
							<CommonAppButton v-if="current.canReceive" size="sm" variant="primary" @click="showReceive = true">
								Đã nhận
							</CommonAppButton>
						</div>
					</div>

					<div v-if="contact" class="mt-1.5">
						<SupplyContactPicker
							v-model:open="contactOpen"
							:contact="contact"
							:options="contactOptions"
							:is-manager="isDepartmentManager"
							:saving="savingContact"
							:save="supplies.saveContact"
						/>
					</div>

					<p v-if="current.note" class="mt-1.5 text-sm text-gray-700 dark:text-gray-300">Ghi chú phiếu: {{ current.note }}</p>
					<p v-if="current.receivedAt" class="mt-1.5 text-sm text-emerald-600 dark:text-emerald-400">
						{{ current.receivedByProxy ? 'HCNS ghi đã giao' : 'Phòng đã nhận' }} lúc
						{{ formatDateTime(current.receivedAt) }}
						<template v-if="current.receiverName"> cho {{ current.receiverName }}</template>
						<template v-else-if="current.receivedBy"> bởi {{ current.receivedBy.fullName }}</template>.
					</p>
				</template>
			</section>

			<template v-if="current && !loadingDetail">
				<!-- Phiếu chỉ xem: nói rõ vì sao, vì hạn chót ghi ở trên có khi vẫn là ngày cũ. -->
				<div
					v-if="readOnlyNotice"
					role="status"
					class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
				>
					<p class="font-medium">Phiếu đã khoá, chỉ xem</p>
					<p class="mt-0.5">{{ readOnlyNotice }}</p>
				</div>

				<!-- Dòng kỳ trước không chép được: người dùng phải tự nhập lại nên danh sách ở lại trên màn. -->
				<div
					v-if="copySkipped.length"
					class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20"
				>
					<div class="flex items-start justify-between gap-3">
						<p class="font-medium text-amber-800 dark:text-amber-300">
							{{ copySkipped.length }} dòng của kỳ trước chưa được thêm, bạn nhập lại nếu còn cần:
						</p>
						<button
							type="button"
							class="px-2 py-1 text-xs text-amber-700 hover:underline dark:text-amber-400"
							@click="copySkipped = []"
						>
							Ẩn
						</button>
					</div>
					<ul class="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
						<li v-for="item in copySkipped" :key="item.name">{{ item.name }} — {{ item.reason }}</li>
					</ul>
				</div>

				<div
					v-if="itemsError"
					class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
				>
					<span>{{ itemsError }} Các dòng phòng đã đăng ký vẫn sửa được.</span>
					<CommonAppButton size="sm" variant="outline" :loading="loadingItems" @click="supplies.loadItems()">
						Thử lại
					</CommonAppButton>
				</div>

				<!--
					Thanh công cụ dính dưới đầu trang: tìm, lọc nhóm, chỉ đã chọn. `-top-4 lg:-top-6` bù phần
					đệm của `<main>`, nếu không dòng danh mục lọt qua khe phía trên thanh khi cuộn. Chip nhóm
					nằm một hàng và cuộn ngang khi chật, để thanh luôn cao hai dòng ở mọi khổ màn.
				-->
				<div
					ref="toolbarRef"
					data-tour="supply-toolbar"
					class="sticky -top-4 z-20 -mx-4 space-y-2 bg-gray-50/95 px-4 py-2 backdrop-blur lg:-top-6 lg:-mx-6 lg:px-6 dark:bg-gray-950/95"
				>
					<div class="flex items-center gap-3">
						<div class="relative min-w-0 max-w-md flex-1">
							<svg
								class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
								aria-hidden="true"
							>
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
	
						<label class="ml-auto inline-flex shrink-0 cursor-pointer select-none items-center gap-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
							<input v-model="onlySelected" type="checkbox" class="peer sr-only" />
							<span
								class="relative h-5 w-9 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 dark:bg-gray-600"
								aria-hidden="true"
							/>
							Chỉ đã chọn ({{ myCount }})
						</label>
					</div>

					<div class="-mb-1 flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Lọc theo nhóm">
						<button
							type="button"
							:aria-pressed="!groupFilter"
							:class="[
								'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
								!groupFilter
									? 'border-brand-500 bg-brand-600 text-white'
									: 'border-gray-300 bg-white text-gray-700 hover:border-brand-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
							]"
							@click="groupFilter = null"
						>
							Tất cả {{ totalRows }}
						</button>
						<button
							v-for="chip in groupChips"
							:key="chip.name"
							type="button"
							:title="chip.name"
							:aria-pressed="groupFilter === chip.name"
							:class="[
								'max-w-[18rem] shrink-0 truncate rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
								groupFilter === chip.name
									? 'border-brand-500 bg-brand-600 text-white'
									: 'border-gray-300 bg-white text-gray-700 hover:border-brand-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
							]"
							@click="groupFilter = groupFilter === chip.name ? null : chip.name"
						>
							{{ chip.name }} {{ chip.count }}
						</button>
					</div>
				</div>

				<p v-if="!canEdit && filteredGroups.length" class="text-xs text-gray-500 dark:text-gray-400">
					Ô số là phần của bạn, Phòng là tổng cả phòng đã xin.
				</p>

				<!-- Danh mục -->
				<div ref="listRef" class="space-y-3">
					<template v-if="loadingItems && !filteredGroups.length">
						<div v-for="i in 6" :key="i" class="h-11 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
					</template>

					<section
						v-for="(group, groupIndex) in filteredGroups"
						:key="group.name"
						class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
					>
						<h3
							class="sticky z-10 rounded-t-xl border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
							:style="{ top: `${toolbarBottom}px` }"
						>
							<button
								type="button"
								:aria-expanded="searching || !collapsed.has(group.name)"
								class="flex w-full items-center gap-2 px-4 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
								@click="toggleGroup(group.name)"
							>
								<svg
									:class="[
										'h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform',
										searching || !collapsed.has(group.name) ? 'rotate-90' : '',
									]"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
									aria-hidden="true"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
								</svg>
								<span class="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
									{{ group.name }}
								</span>
								<span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
									<template v-if="canEdit">{{ group.selected }}/{{ group.total }} đã chọn</template>
									<template v-else>{{ group.total }} dòng</template>
								</span>
							</button>
						</h3>
						<div v-show="searching || !collapsed.has(group.name)" class="divide-y divide-gray-100 dark:divide-gray-800">
							<SupplyCatalogRow
								v-for="(row, rowIndex) in group.rows"
								:key="row.key"
								:data-tour="groupIndex === 0 && rowIndex === 0 ? 'supply-lines' : undefined"
								:row="row"
								:state="rowState[row.key]"
								:qty="supplies.shownQty(row)"
								:can-edit="canEdit"
								:can-edit-all-shares="current.canEditAllShares"
								:saved="!!savedFlash[row.key]"
								:undoable="!!undo[row.key]"
								:highlighted="highlighted.has(row.key)"
								:show-final="hasFinalQty"
								:show-received="hasReceivedQty"
								:notice="notices[row.key]"
								:save-note="note => supplies.saveNote(row, note)"
								:save-share="(employeeId, qty) => supplies.saveShare(row, employeeId, qty)"
								@input="(value, invalid) => supplies.setDraft(row, value, invalid)"
								@commit="supplies.commit(row.key)"
								@bump="supplies.bump(row, $event)"
								@move="moveFocus"
								@reason="supplies.setReason(row, $event)"
								@retry="supplies.retry(row.key)"
								@restore="supplies.restore(row.key)"
								@delete="deleteTarget = row"
							/>
						</div>
					</section>

					<!-- Tìm không ra: mời thêm ngoài danh mục với tên đã gõ. -->
					<div
						v-if="noResults"
						class="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400"
					>
						<p>Không có mặt hàng nào khớp “{{ search.trim() }}”.</p>
						<button
							v-if="canEdit"
							type="button"
							class="mt-2 font-medium text-brand-600 hover:underline dark:text-brand-400"
							@click="openCustom(search.trim())"
						>
							Không thấy “{{ search.trim() }}”? Thêm mặt hàng ngoài danh mục
						</button>
					</div>

					<p
						v-else-if="!filteredGroups.length && !loadingItems && !onlySelected && !groupFilter"
						class="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
					>
						<template v-if="canEdit">
							Danh mục chưa có mặt hàng nào phòng bạn đặt được. Cần gì bạn báo HCNS, hoặc thêm mặt hàng ngoài danh mục.
						</template>
						<template v-else>Phiếu này không có dòng nào.</template>
					</p>

					<p
						v-else-if="!filteredGroups.length && onlySelected && !loadingItems"
						class="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
					>
						Bạn chưa chọn mặt hàng nào. Tắt "Chỉ đã chọn" để xem cả danh mục.
					</p>

					<div
						v-if="canEdit && !noResults"
						data-tour="supply-custom"
						class="flex flex-wrap items-center gap-2 px-1 text-sm text-gray-500 dark:text-gray-400"
					>
						Không thấy mặt hàng cần?
						<button
							type="button"
							class="rounded font-medium text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400"
							@click="openCustom()"
						>
							+ Thêm mặt hàng ngoài danh mục
						</button>
					</div>

					<p v-if="current.totalAmount != null" class="text-right text-sm font-semibold text-gray-900 dark:text-white">
						Tổng tiền phiếu: {{ officeMoney(current.totalAmount) }}
					</p>
				</div>

				<!--
					Thanh dưới dính đáy: không cộng tổng số lượng vì mỗi mặt hàng một đơn vị (chiếc, hộp, ram).
					`pr-24` chừa chỗ cho nút trợ lý nổi ở góc dưới phải; `-bottom-4 lg:-bottom-6` bù phần đệm
					của `<main>` như thanh công cụ.
				-->
				<div
					data-tour="supply-footer"
					class="sticky -bottom-4 z-20 -mx-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-gray-200 bg-white/95 py-2.5 pl-4 pr-24 text-sm backdrop-blur lg:-bottom-6 lg:-mx-6 lg:pl-6 dark:border-gray-700 dark:bg-gray-900/95"
				>
					<p class="text-gray-700 dark:text-gray-300">
						Bạn đã chọn <span class="font-semibold">{{ myCount }}</span> mặt hàng · Cả phòng
						<span class="font-semibold">{{ roomCount }}</span> mặt hàng
					</p>
					<p role="status" aria-live="polite" class="flex min-h-[1.25rem] items-center gap-2">
						<template v-if="saveStatus.tone === 'saving'">
							<span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" aria-hidden="true" />
							<span class="text-gray-600 dark:text-gray-300">{{ saveStatus.text }}</span>
						</template>
						<template v-else-if="saveStatus.tone === 'error'">
							<span class="font-medium text-rose-600 dark:text-rose-400">{{ saveStatus.text }}</span>
							<button
								type="button"
								class="font-medium text-rose-600 underline hover:no-underline dark:text-rose-400"
								@click="supplies.retryAll()"
							>
								Thử lại
							</button>
						</template>
						<span v-else-if="saveStatus.tone === 'saved'" class="text-emerald-600 dark:text-emerald-400">
							✓ {{ saveStatus.text }}
						</span>
					</p>
				</div>
			</template>
		</template>

		<SupplyReceiveModal v-if="showReceive && current" :request="current" @received="onReceived" @close="showReceive = false" />

		<SupplyCustomItemModal
			v-if="customOpen"
			:initial-name="customName"
			:submit="supplies.addCustom"
			@close="customOpen = false"
		/>

		<!--
			Xoá cả dòng là xoá luôn phần của từng người trên dòng đó, nên hỏi lại và kể ra ai mất bao nhiêu.
			Bỏ phần của mình thì chỉ cần đưa ô về 0, không qua hộp này.
		-->
		<Teleport to="body">
			<div
				v-if="deleteTarget?.line"
				class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
				role="dialog"
				aria-modal="true"
				aria-labelledby="supply-delete-title"
				@click.self="deleteTarget = null"
			>
				<div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
					<h3 id="supply-delete-title" class="font-semibold text-gray-900 dark:text-white">Xoá cả dòng khỏi phiếu</h3>
					<p class="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
						Bạn xoá {{ deleteTarget.name }}, phòng đang xin {{ deleteTarget.line.requestedQty }}
						{{ deleteTarget.unit || '' }}.
						<template v-if="deleteTarget.line.shares.length">
							Mỗi người có phần riêng trên dòng này, xoá dòng là xoá luôn phần của mọi người:
							{{ supplySharesLabel(deleteTarget.line) }}.
						</template>
						Dòng đã xoá thì không lấy lại được, nhưng từng người vẫn đăng ký lại được khi kỳ còn mở.
					</p>
					<div class="mt-6 flex justify-end gap-3">
						<CommonAppButton variant="outline" @click="deleteTarget = null">Thôi</CommonAppButton>
						<CommonAppButton variant="danger" :loading="deleting" @click="confirmDelete">Xoá cả dòng</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
