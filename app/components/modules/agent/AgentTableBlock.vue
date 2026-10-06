<script setup lang="ts">
	import type { AgentTable } from '~/types/agent.types';

	/**
	 * Bảng chi tiết do server dựng, đính kèm câu trả lời của trợ lý.
	 *
	 * Vẽ ĐÚNG những gì server gửi. Không đếm lại, không cộng, không làm tròn, không sắp
	 * xếp lại dòng, không thêm dòng tổng, không đổi `'—'` thành chữ khác. Mọi ô đã là
	 * chuỗi hoàn chỉnh do tool dựng từ dữ liệu thật; FE tự chế biến thêm là con số trên
	 * bảng khác con số trong câu trả lời, mà người xem không có cách nào biết bên nào đúng.
	 */
	defineProps<{ table: AgentTable }>();

	/**
	 * Thiếu khoá thì để TRỐNG, không in `undefined` và cũng không tự điền `'—'`.
	 *
	 * Theo contract thì mọi `columns[].key` đều có trong mỗi `rows[]`, nên nhánh này chỉ
	 * chạy khi server gửi sai. Tự điền `'—'` sẽ che mất lỗi đó — ô trống thật và ô thiếu
	 * dữ liệu phải phân biệt được khi đi dò.
	 */
	function cell(row: Record<string, string>, key: string): string {
		return row[key] ?? '';
	}

	const isNumberCol = (align?: 'text' | 'number'): boolean => align === 'number';
</script>

<template>
	<!--
		`w-full min-w-0`: cột chat dùng `items-start` nên khung co giãn theo NỘI DUNG. Không
		ép theo bề rộng cột thì bảng 5 cột đẩy cả bong bóng rộng ra ngoài mép màn hình và
		`overflow-x` bên trong không còn gì để cuộn. Cùng một cái bẫy đã sửa ở AgentChartBlock.
	-->
	<figure
		class="mt-3 w-full min-w-0 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
	>
		<figcaption class="mb-2">
			<p class="text-xs font-semibold text-gray-800 dark:text-gray-100">{{ table.title }}</p>
			<p v-if="table.source" class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
				{{ table.source }}
			</p>
		</figcaption>

		<!--
			`agent-table-wrap` là NHÃN cho bộ dò tràn ngang ở tests/e2e/agent-chart-shots.mjs
			(danh sách trắng các phần tử được phép cuộn ngang) — dùng đúng tên class mà bảng
			markdown đang dùng để không phải khai thêm ngoại lệ. Style thật vẫn là Tailwind.

			`max-h-*` + cuộn dọc: bảng một tháng tới ~30 dòng; để nó cao hết cỡ thì câu trả
			lời, nút sao chép và thanh đánh giá bị đẩy đi rất xa. CUỘN, không cắt dòng — cắt
			là người dùng tưởng mình chỉ đi muộn mấy hôm.
		-->
		<div class="agent-table-wrap max-h-[26rem] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
			<table class="w-max min-w-full border-collapse text-xs">
				<thead>
					<tr>
						<!--
							`sticky`: cuộn tới dòng thứ 20 mà mất tên cột thì không đọc được cột nào là
							giờ vào, cột nào là giờ ra.
						-->
						<th
							v-for="col in table.columns"
							:key="col.key"
							scope="col"
							:class="[
								'sticky top-0 z-10 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:border-gray-700 dark:bg-gray-700/70 dark:text-gray-300',
								isNumberCol(col.align) ? 'text-right' : 'text-left',
							]"
						>
							{{ col.label }}
						</th>
					</tr>
				</thead>
				<tbody>
					<!--
						`v-for` theo đúng thứ tự server gửi — KHÔNG sort, KHÔNG slice. Khoá theo chỉ
						số vì bảng là ảnh chụp một lần, không có dòng nào được thêm/bớt sau đó.
					-->
					<tr
						v-for="(row, r) in table.rows"
						:key="r"
						class="even:bg-gray-50/60 dark:even:bg-gray-700/25"
					>
						<td
							v-for="col in table.columns"
							:key="col.key"
							:class="[
								'border-b border-gray-100 px-2.5 py-1.5 whitespace-nowrap text-gray-700 dark:border-gray-700/60 dark:text-gray-200',
								isNumberCol(col.align) ? 'text-right tabular-nums' : 'text-left',
							]"
						>
							{{ cell(row, col.key) }}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</figure>
</template>
