<script setup lang="ts">
	import PeriodNumberCell from '~/components/modules/office/PeriodNumberCell.vue';
	import type { SummaryInputColumn } from '~/composables/useSupplyPeriodDetail';
	import { isRowUnpriced, officeMoney, type SummaryRowGroup } from '~/utils/office.utils';
	import { vnSearchText } from '~/utils/vn-text';
	import type { SummaryDepartment, SummaryRow } from '~/types/office.types';

	/**
	 * Bảng tổng hợp mặt hàng của một kỳ: mỗi mặt hàng một dòng tổng, số của từng phòng nằm ở các dòng
	 * con mở ra khi cần.
	 *
	 * Bảng không có cột cho từng phòng, nên kỳ mười hay hai mươi phòng thì số cột vẫn như nhau. Dòng con
	 * chỉ liệt kê phòng có xin mặt hàng đó; mặt hàng chỉ một phòng xin thì ghi luôn tên phòng dưới tên mặt
	 * hàng, không cần mở. Trưởng phòng chỉ nhận về phòng mình nên không có dòng con.
	 */
	const props = defineProps<{
		groups: SummaryRowGroup[];
		departments: SummaryDepartment[];
		/** Phạm vi trưởng phòng: không có cột Dự trù, Cần mua. */
		departmentScope: boolean;
		canEdit: boolean;
		/** Lý do ô không sửa được (kỳ đã đóng); trống là không có lý do riêng. */
		lockedReason: string;
		reserveDraft: Record<number, number | undefined>;
		priceDraft: Record<number, number | undefined>;
		isDirty: (row: SummaryRow, column: SummaryInputColumn) => boolean;
		/** Bảng đang toàn màn hình: khung cuộn chiếm hết chỗ còn lại thay vì cao theo màn hình. */
		fill?: boolean;
	}>();

	const emit = defineEmits<{
		draft: [itemId: number, column: SummaryInputColumn, value: number | undefined, invalid: boolean];
	}>();

	interface DepartmentQty {
		departmentId: number;
		name: string;
		qty: number;
	}

	const tableRef = ref<HTMLElement | null>(null);
	const openKeys = ref(new Set<string>());

	/** Khoá ổn định qua lọc và qua lần tải lại sau khi lưu; dùng được làm id trong DOM. */
	function rowKey(row: SummaryRow): string {
		return row.itemId != null ? `i${row.itemId}` : `c${vnSearchText(row.name).replace(/[^a-z0-9]+/g, '-')}`;
	}

	/** Phòng có xin mặt hàng này, theo thứ tự phòng của kỳ. */
	function rowDepartments(row: SummaryRow): DepartmentQty[] {
		return props.departments
			.map(dept => ({
				departmentId: dept.departmentId,
				name: dept.name,
				qty: row.cells.find(c => c.departmentId === dept.departmentId)?.qty ?? 0,
			}))
			.filter(dept => dept.qty > 0);
	}

	const splitByDepartment = computed(() => !props.departmentScope && props.departments.length > 1);

	function canExpand(row: SummaryRow): boolean {
		return splitByDepartment.value && rowDepartments(row).length > 1;
	}

	function isOpen(row: SummaryRow): boolean {
		return openKeys.value.has(rowKey(row));
	}

	function toggle(row: SummaryRow) {
		const next = new Set(openKeys.value);
		const key = rowKey(row);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		openKeys.value = next;
	}

	const expandableRows = computed(() => props.groups.flatMap(group => group.rows.filter(canExpand)));
	const allOpen = computed(() => expandableRows.value.length > 0 && expandableRows.value.every(isOpen));

	function setAllOpen(open: boolean) {
		const next = new Set(openKeys.value);
		for (const row of expandableRows.value) {
			if (open) next.add(rowKey(row));
			else next.delete(rowKey(row));
		}
		openKeys.value = next;
	}

	/** Dòng phụ dưới tên mặt hàng: tên phòng khi chỉ một phòng xin, số phòng khi nhiều phòng. */
	function departmentHint(row: SummaryRow): string {
		if (!splitByDepartment.value) return '';
		const depts = rowDepartments(row);
		if (depts.length === 1) return depts[0]?.name ?? '';
		return depts.length > 1 ? `${depts.length} phòng` : '';
	}

	/** Enter trong một ô: xuống ô cùng cột ở dòng kế, bỏ qua dòng nhóm, dòng con và dòng không có ô nhập. */
	function focusNext(column: SummaryInputColumn, from: EventTarget | null) {
		const inputs = [...(tableRef.value?.querySelectorAll<HTMLInputElement>(`input[data-cell-col="${column}"]`) ?? [])];
		const index = inputs.findIndex(input => input === document.activeElement || input === from);
		inputs[index + 1]?.focus();
	}

	const numericColumns = computed(() => (props.departmentScope ? 3 : 5));
	const totalColumns = computed(() => 2 + numericColumns.value + 1);

	const headCls =
		'sticky top-0 z-20 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-600 last:border-r-0 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300';
	// Đường dọc đậm hơn đường ngang một nấc để mắt dóng cột khi bảng dài.
	const cellCls =
		'border-b border-r border-gray-100 border-r-gray-200 px-2 py-1.5 last:border-r-0 dark:border-gray-800 dark:border-r-gray-700';
</script>

<template>
	<!--
		Khung cuộn riêng cao vừa màn hình: tiêu đề cột dính trong khung, thanh tổng ở đáy trang không che
		dòng cuối. Màn hẹp vẫn cuộn ngang trong khung, cột tên dính trái.
	-->
	<div ref="tableRef" :class="['overflow-auto', fill ? 'min-h-0 flex-1' : 'max-h-[calc(100dvh-13rem)] min-h-[16rem]']">
		<table class="min-w-full border-separate border-spacing-0 text-sm">
			<thead>
				<tr>
					<th :class="[headCls, 'left-0 z-30 min-w-[15rem] text-left']" scope="col">
						<div class="flex items-center justify-between gap-2">
							<span>Mặt hàng</span>
							<button
								v-if="expandableRows.length"
								type="button"
								class="rounded px-1 font-medium text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400"
								@click="setAllOpen(!allOpen)"
							>
								{{ allOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả' }}
							</button>
						</div>
					</th>
					<th :class="[headCls, 'text-left']" scope="col">ĐVT</th>
					<th :class="[headCls, 'text-right']" scope="col">Tổng</th>
					<template v-if="!departmentScope">
						<th :class="[headCls, 'whitespace-nowrap text-right']" scope="col">Dự trù</th>
						<th :class="[headCls, 'whitespace-nowrap text-right']" scope="col">Cần mua</th>
					</template>
					<th :class="[headCls, 'whitespace-nowrap text-right']" scope="col">Đơn giá (đ)</th>
					<th :class="[headCls, 'whitespace-nowrap text-right']" scope="col">Thành tiền (đ)</th>
					<th :class="[headCls, 'min-w-[12rem] text-left']" scope="col">Ghi chú</th>
				</tr>
			</thead>
			<tbody>
				<template v-for="group in groups" :key="group.groupName">
					<tr>
						<td :colspan="totalColumns" class="border-b border-gray-200 bg-gray-100 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800/80">
							<!-- Chữ của dòng nhóm dính trái, để cuộn ngang vẫn đọc được tên nhóm. -->
							<span class="sticky left-3 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
								{{ group.numeral }}. {{ group.groupName }}
							</span>
						</td>
					</tr>
					<template v-for="row in group.rows" :key="rowKey(row)">
						<!--
							Rê chuột tô cả dòng; ô tên dính trái có nền riêng nên tô theo `group-hover` cho cùng màu.
						-->
						<tr
							:id="row.itemId != null ? `summary-row-${row.itemId}` : undefined"
							data-summary-item
							class="group scroll-mt-24 hover:bg-brand-100 dark:hover:bg-gray-800"
						>
							<th
								scope="row"
								:class="[
									cellCls,
									'sticky left-0 z-10 text-left font-normal text-gray-900 [overflow-wrap:anywhere] dark:text-white',
									row.overQuota
										? 'bg-amber-50 group-hover:bg-amber-100 dark:bg-amber-950 dark:group-hover:bg-amber-900'
										: 'bg-white group-hover:bg-brand-100 dark:bg-gray-900 dark:group-hover:bg-gray-800',
								]"
							>
								<div class="flex items-start gap-1">
									<button
										v-if="canExpand(row)"
										type="button"
										:aria-expanded="isOpen(row)"
										:aria-controls="rowDepartments(row).map(d => `summary-sub-${rowKey(row)}-${d.departmentId}`).join(' ')"
										:aria-label="`Số theo phòng của ${row.name}`"
										class="-ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-100"
										@click="toggle(row)"
									>
										<svg
											class="h-4 w-4 transition-transform"
											:class="{ 'rotate-90': isOpen(row) }"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
											aria-hidden="true"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
										</svg>
									</button>
									<span v-else-if="splitByDepartment" class="-ml-1 w-6 shrink-0" aria-hidden="true" />
									<div class="min-w-0">
										{{ row.name }}
										<span v-if="row.itemId == null" class="block text-xs text-gray-500 dark:text-gray-400">ngoài danh mục</span>
										<button
											v-if="canExpand(row)"
											type="button"
											tabindex="-1"
											aria-hidden="true"
											class="block text-xs text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
											@click="toggle(row)"
										>
											{{ departmentHint(row) }}
										</button>
										<span v-else-if="departmentHint(row)" class="block text-xs text-gray-500 dark:text-gray-400">
											{{ departmentHint(row) }}
										</span>
										<span v-if="row.overQuota" class="block text-xs font-medium text-amber-700 dark:text-amber-400">
											có phòng xin vượt định mức
										</span>
									</div>
								</div>
							</th>
							<td :class="[cellCls, 'text-gray-600 dark:text-gray-300']">{{ row.unit || '—' }}</td>
							<td :class="[cellCls, 'text-right tabular-nums']">
								<span v-if="row.totalQty" class="font-semibold text-gray-900 dark:text-white">{{ row.totalQty }}</span>
								<span v-else class="text-gray-300 dark:text-gray-600" aria-label="0">·</span>
							</td>
							<template v-if="!departmentScope">
								<td :class="[cellCls, 'min-w-[5.5rem]']">
									<PeriodNumberCell
										v-if="canEdit && row.itemId != null"
										:model-value="reserveDraft[row.itemId]"
										:label="`Dự trù, ${row.name}`"
										column="reserve"
										:max="100000"
										:dirty="isDirty(row, 'reserve')"
										@input="(value, bad) => row.itemId != null && emit('draft', row.itemId, 'reserve', value, bad)"
										@next="focusNext('reserve', null)"
									/>
									<span v-else class="block text-right tabular-nums text-gray-700 dark:text-gray-200" :title="lockedReason || undefined">
										{{ row.reserveQty ?? '—' }}
									</span>
								</td>
								<td :class="[cellCls, 'text-right tabular-nums']">
									<span v-if="row.purchaseQty" class="font-semibold text-gray-900 dark:text-white">{{ row.purchaseQty }}</span>
									<span v-else class="text-gray-300 dark:text-gray-600" aria-label="0">·</span>
								</td>
							</template>
							<td :id="row.itemId != null ? `price-cell-${row.itemId}` : undefined" :class="[cellCls, 'min-w-[8rem]']">
								<PeriodNumberCell
									v-if="canEdit && row.itemId != null"
									:model-value="priceDraft[row.itemId]"
									:label="`Đơn giá, ${row.name}`"
									column="price"
									:max="1000000000"
									:dirty="isDirty(row, 'price')"
									:warn="isRowUnpriced(row) && priceDraft[row.itemId] == null"
									@input="(value, bad) => row.itemId != null && emit('draft', row.itemId, 'price', value, bad)"
									@next="focusNext('price', null)"
								/>
								<span
									v-else
									class="block text-right tabular-nums text-gray-700 dark:text-gray-200"
									:title="row.itemId == null ? 'Đơn giá mặt hàng ngoài danh mục nhập khi chốt phiếu của phòng.' : lockedReason || undefined"
								>
									{{ officeMoney(row.unitPrice) }}
								</span>
							</td>
							<td :class="[cellCls, 'text-right tabular-nums']">
								<span v-if="row.amount != null" class="text-gray-900 dark:text-white">{{ officeMoney(row.amount) }}</span>
								<span
									v-else
									:class="isRowUnpriced(row) ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'"
									:title="isRowUnpriced(row) ? 'Chưa có đơn giá nên chưa tính vào tổng tiền' : undefined"
									>—</span
								>
							</td>
							<td :class="[cellCls, 'text-xs text-gray-600 dark:text-gray-300']">
								<p v-for="(note, idx) in row.notes" :key="idx">{{ note }}</p>
							</td>
						</tr>
						<template v-if="canExpand(row) && isOpen(row)">
							<tr
								v-for="dept in rowDepartments(row)"
								:id="`summary-sub-${rowKey(row)}-${dept.departmentId}`"
								:key="dept.departmentId"
								data-summary-department
								class="group bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800"
							>
								<th
									scope="row"
									:class="[
										cellCls,
										'sticky left-0 z-10 bg-gray-50 py-1 pl-9 text-left text-xs font-normal text-gray-600 group-hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:group-hover:bg-gray-700',
									]"
								>
									{{ dept.name }}
								</th>
								<td :class="[cellCls, 'py-1']" />
								<td :class="[cellCls, 'py-1 text-right text-xs tabular-nums text-gray-700 dark:text-gray-200']">{{ dept.qty }}</td>
								<!-- Từng ô trống thay vì một ô gộp, để đường kẻ dọc chạy liền qua dòng con. -->
								<td v-for="n in totalColumns - 3" :key="n" :class="[cellCls, 'py-1']" />
							</tr>
						</template>
					</template>
				</template>
			</tbody>
		</table>
	</div>
</template>
