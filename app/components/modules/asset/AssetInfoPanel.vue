<script setup lang="ts">
	import { formatAssetMoney } from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import type { Asset } from '~/types/asset.types';

	const props = defineProps<{ asset: Asset }>();

	interface Row {
		label: string;
		value: string;
		/** Hiện dưới dạng link ngoài. */
		href?: string | null;
	}

	const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

	const generalRows = computed<Row[]>(() => {
		const a = props.asset;
		return [
			{ label: 'Mã tài sản', value: a.code },
			{ label: 'Loại hình', value: a.kindLabel },
			{ label: 'Nhóm → Loại', value: `${a.category.groupName} → ${a.category.name}` },
			{ label: 'Đơn vị sở hữu', value: `${a.ownerUnit.name} (${a.ownerUnit.code})` },
			{ label: 'Nhà cung cấp', value: dash(a.vendor?.name) },
			{ label: 'Ngày mua', value: a.purchaseDate ? formatDate(a.purchaseDate) : '—' },
			{ label: 'Ghi chú', value: dash(a.note) },
		];
	});

	const valueRows = computed<Row[]>(() => {
		const a = props.asset;
		const rows: Row[] = [
			{ label: 'Nguyên giá', value: formatAssetMoney(a.cost, a.currency) },
		];
		if (a.currency !== 'VND') {
			rows.push({ label: 'Tỷ giá', value: a.exchangeRate != null ? String(a.exchangeRate) : '—' });
			rows.push({ label: 'Quy ra VND', value: formatAssetMoney(a.costVnd) });
		}
		if (a.kind === 'PHYSICAL') {
			rows.push({ label: 'Giá trị còn lại', value: formatAssetMoney(a.bookValue) });
		}
		return rows;
	});

	const physicalRows = computed<Row[]>(() => {
		const p = props.asset.physical;
		if (!p) return [];
		return [
			{ label: 'Hãng', value: dash(p.manufacturer) },
			{ label: 'Model', value: dash(p.model) },
			{ label: 'Số serial', value: dash(p.serialNumber) },
			{ label: 'Vị trí', value: dash(p.location) },
			{ label: 'Tình trạng', value: dash(p.conditionLabel) },
			{ label: 'Phân loại kế toán', value: dash(p.accountingClassLabel) },
			{ label: 'Bảo hành', value: p.warrantyMonths != null ? `${p.warrantyMonths} tháng` : '—' },
			{ label: 'Hết hạn bảo hành', value: p.warrantyEndDate ? formatDate(p.warrantyEndDate) : '—' },
			{ label: 'Bắt đầu khấu hao', value: p.depreciationStartDate ? formatDate(p.depreciationStartDate) : '—' },
			{ label: 'Số tháng khấu hao', value: p.depreciationMonths != null ? String(p.depreciationMonths) : '—' },
			{ label: 'Giá trị thu hồi', value: formatAssetMoney(p.salvageValue) },
			{ label: 'Dừng khấu hao', value: p.depreciationStopDate ? formatDate(p.depreciationStopDate) : '—' },
		];
	});

	const serviceRows = computed<Row[]>(() => {
		const s = props.asset.service;
		if (!s) return [];
		return [
			{ label: 'Gói', value: dash(s.plan) },
			{ label: 'Chu kỳ thanh toán', value: s.billingCycleLabel },
			{ label: 'Người phụ trách', value: `${s.owner.fullName} · ${s.owner.employeeCode}` },
			{ label: 'Hạn gia hạn', value: s.nextRenewalDate ? formatDate(s.nextRenewalDate) : '—' },
			{ label: 'Ngày neo', value: s.anchorDay != null ? `Ngày ${s.anchorDay}` : '—' },
			{
				label: 'Ghế',
				value: s.seatCount != null ? `${s.seatsUsed}/${s.seatCount}` : `${s.seatsUsed} (không giới hạn)`,
			},
			{ label: 'Đơn giá', value: formatAssetMoney(s.unitPrice, props.asset.currency) },
			{ label: 'Tính giá theo', value: s.pricingUnitLabel },
			{ label: 'Tự động gia hạn', value: s.autoRenew ? 'Có' : 'Không' },
			{ label: 'Tài khoản quản trị', value: dash(s.adminAccount) },
			{ label: 'Trang quản trị', value: dash(s.adminUrl), href: s.adminUrl },
			{ label: 'Password manager', value: dash(s.passwordManagerUrl), href: s.passwordManagerUrl },
			{ label: 'Ghi chú thanh toán', value: dash(s.paymentMethodNote) },
			{ label: 'Thông tin kỹ thuật', value: dash(s.technicalInfo) },
		];
	});
</script>

<template>
	<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
		<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
			<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Thông tin chung</h3>
			<dl class="divide-y divide-gray-100 dark:divide-gray-800">
				<div v-for="row in generalRows" :key="row.label" class="flex gap-4 py-2">
					<dt class="w-40 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">{{ row.label }}</dt>
					<dd class="min-w-0 flex-1 break-words text-sm text-gray-900 dark:text-gray-100">{{ row.value }}</dd>
				</div>
			</dl>
		</section>

		<section
			v-if="asset.canViewValue"
			class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
		>
			<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Giá trị</h3>
			<dl class="divide-y divide-gray-100 dark:divide-gray-800">
				<div v-for="row in valueRows" :key="row.label" class="flex gap-4 py-2">
					<dt class="w-40 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">{{ row.label }}</dt>
					<dd class="min-w-0 flex-1 text-sm tabular-nums text-gray-900 dark:text-gray-100">{{ row.value }}</dd>
				</div>
			</dl>
		</section>

		<section
			v-if="physicalRows.length"
			class="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2 dark:border-gray-700 dark:bg-gray-900"
		>
			<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Thông tin thiết bị</h3>
			<dl class="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
				<div v-for="row in physicalRows" :key="row.label" class="flex gap-4 border-b border-gray-100 py-2 dark:border-gray-800">
					<dt class="w-40 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">{{ row.label }}</dt>
					<dd class="min-w-0 flex-1 break-words text-sm text-gray-900 dark:text-gray-100">{{ row.value }}</dd>
				</div>
			</dl>
		</section>

		<section
			v-if="serviceRows.length"
			class="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2 dark:border-gray-700 dark:bg-gray-900"
		>
			<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Thông tin dịch vụ</h3>
			<dl class="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
				<div v-for="row in serviceRows" :key="row.label" class="flex gap-4 border-b border-gray-100 py-2 dark:border-gray-800">
					<dt class="w-40 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">{{ row.label }}</dt>
					<dd class="min-w-0 flex-1 break-words text-sm text-gray-900 dark:text-gray-100">
						<a
							v-if="row.href"
							:href="row.href"
							target="_blank"
							rel="noopener noreferrer"
							class="text-brand-600 hover:underline dark:text-brand-400"
						>
							{{ row.value }}
						</a>
						<template v-else>{{ row.value }}</template>
					</dd>
				</div>
			</dl>
		</section>
	</div>
</template>
