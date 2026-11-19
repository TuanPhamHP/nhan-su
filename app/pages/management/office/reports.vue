<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import {
		downloadOfficeFile,
		monthLabel,
		monthValue,
		officeErrorCode,
		officeErrorMessage,
		officeMoney,
	} from '~/utils/office.utils';
	import type { SupplyCostQueryParams, SupplyCostReport, SupplyGroup } from '~/types/office.types';

	/**
	 * Báo cáo chi phí văn phòng phẩm (UI-10).
	 *
	 * Chi phí tính theo SỐ THỰC NHẬN nhân đơn giá thực của kỳ, nên con số ở đây là tiền đã chi chứ
	 * không phải tiền phòng xin. Dòng chưa có đơn giá không vào tổng tiền, và trang nói rõ còn bao
	 * nhiêu dòng như vậy để người đọc không tưởng tổng đã đủ.
	 *
	 * Trưởng phòng mở trang này chỉ nhận về phòng mình, do máy chủ lọc theo phạm vi.
	 */
	definePageMeta({ title: 'Chi phí văn phòng phẩm' });

	const toast = useToast();
	const service = useOfficeService();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	/** Mặc định xem đúng tháng này, vì đó là tháng người đọc đang theo dõi chi phí. */
	const thisMonth = monthValue();

	const monthFrom = ref(thisMonth);
	const monthTo = ref(thisMonth);
	const departmentId = ref<number | undefined>(undefined);
	const groupId = ref<number | undefined>(undefined);

	const report = ref<SupplyCostReport | null>(null);
	const groups = ref<SupplyGroup[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const rangeError = ref('');
	const exporting = ref(false);

	/**
	 * Mười tám tháng đã qua và mười hai tháng tới.
	 *
	 * Phần tương lai phải đủ rộng vì kỳ đăng ký mở trước được mười tháng: danh sách ngắn hơn thì
	 * có kỳ đã chốt xong mà báo cáo không chọn được tháng của nó.
	 */
	const monthOptions = computed(() => {
		const now = new Date();
		const options: Array<{ value: string; label: string }> = [];
		for (let offset = -18; offset <= 12; offset++) {
			const at = new Date(now.getFullYear(), now.getMonth() + offset, 1);
			const value = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
			options.push({ value, label: monthLabel(value) });
		}
		return options;
	});

	/**
	 * Ô Phòng ban: trưởng phòng chỉ có một lựa chọn, là phòng của mình.
	 *
	 * Máy chủ luôn lọc về phòng họ dù query gửi gì, nên để họ chọn phòng khác là mời họ bấm vào một
	 * cái bẫy: trước đây chọn phòng khác thì trang nhận 403 kèm nút "Thử lại" không bao giờ chạy.
	 */
	const departmentLocked = computed(() => report.value?.scope === 'DEPARTMENT');

	const departmentOptions = computed(() => {
		if (departmentLocked.value) {
			const id = report.value?.departmentId ?? undefined;
			const name = departments.value.find(d => d.id === id)?.name ?? report.value?.rows[0]?.departmentName;
			return [{ value: id, label: name ?? 'Phòng của bạn' }];
		}
		return [
			{ value: undefined, label: 'Mọi phòng ban' },
			...departments.value.map(d => ({ value: d.id, label: d.name })),
		];
	});

	const groupOptions = computed(() => [
		{ value: undefined, label: 'Mọi nhóm' },
		...groups.value.map(g => ({ value: g.id, label: g.name })),
	]);

	function query(): SupplyCostQueryParams {
		return {
			monthFrom: monthFrom.value,
			monthTo: monthTo.value || undefined,
			departmentId: departmentId.value,
			groupId: groupId.value,
		};
	}

	async function load() {
		loading.value = true;
		loadError.value = null;
		rangeError.value = '';
		try {
			report.value = await service.supplyCostReport(query());
			// Trưởng phòng: ô lọc phải khớp phòng máy chủ đã lọc, không để trống ở "Mọi phòng ban".
			if (report.value.scope === 'DEPARTMENT' && report.value.departmentId != null) {
				departmentId.value = report.value.departmentId;
			}
		} catch (e) {
			report.value = null;
			if (officeErrorCode(e) === 'OFFICE_REPORT_RANGE_INVALID') {
				rangeError.value = officeErrorMessage(e, 'Tháng kết thúc phải từ tháng bắt đầu trở đi.');
			} else {
				loadError.value = officeErrorMessage(e, 'Chưa tải được báo cáo chi phí. Bạn bấm Thử lại.');
			}
		} finally {
			loading.value = false;
		}
	}

	/**
	 * Tháng gần nhất đã có chi phí, để trang mở ra là có số thay vì một bảng trống.
	 *
	 * Chi phí chỉ có sau khi kỳ được khoá và chốt, nên tháng này thường chưa có gì: HCNS mở báo cáo
	 * thấy trống rồi phải tự đổi tháng mới biết hệ thống có số.
	 */
	async function latestMonthWithData(): Promise<string | null> {
		const now = new Date();
		const from = monthValue(new Date(now.getFullYear(), now.getMonth() - 11, 1));
		// Quét cả mười hai tháng tới: kỳ đăng ký mở trước nhiều tháng, nên tháng có chi phí gần
		// nhất hoàn toàn có thể nằm ở tương lai, và đó mới là tháng người đọc đang theo dõi.
		const to = monthValue(new Date(now.getFullYear(), now.getMonth() + 12, 1));
		try {
			const probe = await service.supplyCostReport({ monthFrom: from, monthTo: to });
			const months = probe.rows.map(row => row.month).sort();
			return months.length ? (months[months.length - 1] as string) : null;
		} catch {
			// Không đọc được thì cứ mở tháng này, người dùng tự đổi.
			return null;
		}
	}

	/** Cờ để lần đặt tháng mặc định không gây thêm một lượt gọi API của watcher. */
	let suppressFilterWatch = false;

	onMounted(async () => {
		directoryStore.load().catch(() => {
			// Thiếu phòng ban thì chỉ mất ô lọc, bảng vẫn đọc được.
		});
		try {
			groups.value = await service.findSupplyGroups();
		} catch {
			groups.value = [];
		}
		const latest = await latestMonthWithData();
		if (latest && latest !== monthFrom.value) {
			suppressFilterWatch = true;
			monthFrom.value = latest;
			monthTo.value = latest;
			await nextTick();
			suppressFilterWatch = false;
		}
		await load();
	});

	watch([monthFrom, monthTo, departmentId, groupId], () => {
		if (suppressFilterWatch) return;
		load();
	});

	/** "Đến tháng" không bao giờ đứng trước "Từ tháng": kéo theo thay vì báo lỗi khoảng tháng. */
	watch(monthFrom, value => {
		if (monthTo.value && monthTo.value < value) monthTo.value = value;
	});

	// Đổi tháng là người dùng đang sửa khoảng, nên câu lỗi khoảng tháng cũ hết đúng; để treo lại
	// thì hai ô đã cùng tháng mà màn hình vẫn đỏ.
	watch([monthFrom, monthTo], () => {
		rangeError.value = '';
	});

	async function exportExcel() {
		if (exporting.value) return;
		exporting.value = true;
		try {
			const file = await service.exportSupplyCostReport(query());
			// Máy chủ đặt tên theo khoảng tháng; tên dự phòng chỉ dùng khi header không tới nơi.
			const name = file.fileName || `chi-phi-van-phong-pham-${monthFrom.value}.xlsx`;
			downloadOfficeFile(file.blob, name);
			toast.success(`Đã tải file ${name}.`);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa xuất được file Excel. Bạn thử lại sau ít phút.'));
		} finally {
			exporting.value = false;
		}
	}

	const unpricedTotal = computed(() => (report.value?.rows ?? []).reduce((sum, row) => sum + row.unpricedLines, 0));
</script>

<template>
	<div class="space-y-5">
		<UiPageHeader
			title="Chi phí văn phòng phẩm"
			description="Chi phí mỗi tháng của từng phòng, tính theo số thực nhận và đơn giá thực của kỳ."
		>
			<CommonAppButton variant="outline" :loading="exporting" :disabled="!report" @click="exportExcel">
				Xuất Excel
			</CommonAppButton>
		</UiPageHeader>

		<CommonAppModuleNotice module="OFFICE" />

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Từ tháng</p>
				<UiSelect v-model="monthFrom" :options="monthOptions" />
			</div>
			<div>
				<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Đến tháng</p>
				<UiSelect v-model="monthTo" :options="monthOptions" :error="rangeError" />
			</div>
			<div>
				<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Phòng ban</p>
				<UiSelect v-model="departmentId" :options="departmentOptions" :disabled="departmentLocked" />
				<p v-if="departmentLocked" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Bạn xem được chi phí của phòng mình.
				</p>
			</div>
			<div>
				<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Nhóm văn phòng phẩm</p>
				<UiSelect v-model="groupId" :options="groupOptions" />
			</div>
		</div>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
		>
			<p>{{ loadError }}</p>
			<CommonAppButton class="mt-3" size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<template v-else-if="report">
			<p
				v-if="unpricedTotal > 0"
				class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
			>
				Còn {{ unpricedTotal }} mặt hàng chưa có đơn giá nên chưa được tính vào tổng tiền. Bạn nhập đơn giá thực ở
				trang bảng tổng hợp của kỳ tương ứng.
			</p>

			<p
				v-if="!report.rows.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Khoảng tháng này chưa có chi phí văn phòng phẩm nào.
			</p>

			<section
				v-else
				class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<!--
					Điện thoại: mỗi dòng báo cáo là một thẻ, không phải một hàng của bảng năm cột.
					Bảng rộng 640 pixel trong màn 390 thì cột Chi phí nằm ngoài màn hình và dòng tổng cũng
					vậy, nên người đọc cuộn xuống hết trang mà không thấy một con số tiền nào.
				-->
				<div class="divide-y divide-gray-100 sm:hidden dark:divide-gray-800">
					<div v-for="row in report.rows" :key="`card-${row.month}-${row.departmentId}-${row.officeSiteName}`" class="p-4">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="font-medium text-gray-900 dark:text-white">{{ row.departmentName }}</p>
								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									{{ monthLabel(row.month) }} · {{ row.officeSiteName }}
								</p>
								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									{{ row.lineCount }} mặt hàng
									<span v-if="row.unpricedLines > 0" class="text-amber-600 dark:text-amber-400">
										· {{ row.unpricedLines }} chưa có giá
									</span>
								</p>
							</div>
							<p class="flex-shrink-0 font-semibold text-gray-900 dark:text-white">{{ officeMoney(row.amount) }}</p>
						</div>
					</div>
					<div class="flex items-center justify-between gap-3 bg-gray-50 p-4 dark:bg-gray-800/60">
						<p class="font-medium text-gray-700 dark:text-gray-200">Tổng chi phí</p>
						<p class="font-semibold text-gray-900 dark:text-white">{{ officeMoney(report.totalAmount) }}</p>
					</div>
				</div>

				<div class="hidden overflow-x-auto sm:block">
					<table class="w-full min-w-[640px] text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
								<th class="px-4 py-3">Tháng</th>
								<th class="px-4 py-3">Phòng ban</th>
								<th class="px-4 py-3">Văn phòng</th>
								<!-- Tên cột giống hệt file Excel: "Số mặt hàng", không phải "Số dòng". -->
								<th class="px-4 py-3 text-right">Số mặt hàng</th>
								<th class="px-4 py-3 text-right">Chi phí</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr
								v-for="row in report.rows"
								:key="`${row.month}-${row.departmentId}-${row.officeSiteName}`"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/40"
							>
								<td class="px-4 py-3 text-gray-900 dark:text-white">{{ monthLabel(row.month) }}</td>
								<td class="px-4 py-3 text-gray-900 dark:text-white">{{ row.departmentName }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.officeSiteName }}</td>
								<td class="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
									{{ row.lineCount }}
									<span v-if="row.unpricedLines > 0" class="text-xs text-amber-600 dark:text-amber-400">
										({{ row.unpricedLines }} chưa có giá)
									</span>
								</td>
								<td class="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
									{{ officeMoney(row.amount) }}
								</td>
							</tr>
						</tbody>
						<tfoot>
							<tr class="border-t border-gray-200 dark:border-gray-700">
								<td class="px-4 py-3 font-medium text-gray-700 dark:text-gray-200" colspan="4">Tổng chi phí</td>
								<td class="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
									{{ officeMoney(report.totalAmount) }}
								</td>
							</tr>
						</tfoot>
					</table>
				</div>

				<!--
					Cơ sở tính nằm ngay dưới bảng, không chỉ trong câu mô tả sau dấu hỏi: người đọc báo cáo
					tiền luôn hỏi "số này gồm những gì", và nếu không trả lời thì họ tự đoán.
				-->
				<p class="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
					Chi phí tính theo số các phòng thực nhận, phòng chưa nhận thì lấy số đã chốt, nhân đơn giá của kỳ. Số
					này chưa gồm phần dự trù HCNS mua thêm, và kỳ chưa khoá thì chưa có số.
				</p>
			</section>
		</template>
	</div>
</template>
