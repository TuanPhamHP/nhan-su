<script setup lang="ts">
	import { formatDate } from '~/utils/date';
	import { lockCountdown, monthLabel, periodProgress, supplyStatusMeta } from '~/utils/office.utils';
	import type { SupplyPeriod } from '~/types/office.types';

	/**
	 * Một kỳ trên trang Kỳ văn phòng phẩm: trạng thái, tiến độ đăng ký, còn bao lâu và người mở.
	 *
	 * Cả thẻ bấm được nhưng chỉ có MỘT liên kết là nút "Xem chi tiết": lớp `after:inset-0` của nó phủ
	 * kín thẻ, nên không phải lồng liên kết trong liên kết và bàn phím chỉ dừng ở một chỗ cho mỗi thẻ.
	 */
	const props = defineProps<{
		period: SupplyPeriod;
		now: Date;
	}>();

	const status = computed(() => supplyStatusMeta(props.period.status));
	const progress = computed(() => periodProgress(props.period));
	const hasProgress = computed(() => props.period.departmentsTotal != null);

	/** Tên kỳ thường đã là "Tháng 12/2026", nên chỉ nhắc lại tháng khi tiêu đề kỳ khác đi. */
	const monthSuffix = computed(() => {
		const label = monthLabel(props.period.month);
		return props.period.title.trim() === label ? '' : label;
	});

	/** Đếm ngược chỉ có nghĩa khi kỳ còn nhận đăng ký; qua giờ khoá mà máy chủ chưa khoá thì "Đã quá hạn". */
	const countdown = computed(() => {
		if (props.period.status !== 'OPEN') return null;
		const overdue = new Date(props.period.lockAt).getTime() <= props.now.getTime();
		return { text: overdue ? 'Đã quá hạn' : lockCountdown(props.period.lockAt, props.now), overdue };
	});

	/**
	 * Kỳ đã khoá thì nhãn của máy chủ nói bước đang chờ ("Đã cấp, chờ các phòng nhận"): đó là việc
	 * tiếp theo HCNS cần biết, chip chung "Đã khoá" không nói được.
	 */
	const nextStep = computed(() =>
		props.period.status === 'LOCKED' && props.period.statusLabel !== status.value.label ? props.period.statusLabel : '',
	);
</script>

<template>
	<article
		class="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-brand-500 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-700"
	>
		<div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
			<h3 class="min-w-0 font-semibold text-gray-900 [overflow-wrap:anywhere] dark:text-white">
				{{ period.title }}
				<span class="font-normal text-gray-500 dark:text-gray-400">
					<template v-if="monthSuffix"> · {{ monthSuffix }}</template>
					· {{ period.officeSite.name }}
				</span>
			</h3>
			<span :class="['inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', status.class]">
				{{ status.label }}
			</span>
		</div>

		<div v-if="hasProgress" class="mt-3 flex items-center gap-3">
			<div
				role="progressbar"
				:aria-valuenow="progress.done"
				aria-valuemin="0"
				:aria-valuemax="progress.total"
				:aria-valuetext="`${progress.done} trên ${progress.total} phòng đã đăng ký`"
				aria-label="Tiến độ đăng ký"
				class="h-2 w-full max-w-xs overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
			>
				<div class="h-full rounded-full bg-brand-500" :style="{ width: `${progress.percent}%` }" />
			</div>
			<span class="shrink-0 text-sm text-gray-700 dark:text-gray-300">
				<span class="font-semibold tabular-nums">{{ progress.done }}/{{ progress.total }}</span> phòng đã đăng ký
			</span>
		</div>

		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			Hạn chót đăng ký {{ formatDate(period.deadline) }}
			<template v-if="countdown">
				·
				<span
					:class="[
						'font-medium',
						countdown.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400',
					]"
					>{{ countdown.text }}</span
				>
			</template>
			<template v-if="nextStep"> · {{ nextStep }}</template>
			<template v-if="period.closedAt"> · Đã đóng ngày {{ formatDate(period.closedAt) }}</template>
		</p>

		<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
			<p class="text-xs text-gray-500 dark:text-gray-400">
				<template v-if="period.createdBy">Mở bởi {{ period.createdBy.fullName }}</template>
			</p>
			<NuxtLink
				:to="`/management/office/supply-periods/${period.id}`"
				class="rounded text-sm font-medium text-brand-600 after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline focus:outline-none dark:text-brand-400"
			>
				Xem chi tiết →
				<span class="sr-only">{{ period.title }}, {{ period.officeSite.name }}</span>
			</NuxtLink>
		</div>
	</article>
</template>
