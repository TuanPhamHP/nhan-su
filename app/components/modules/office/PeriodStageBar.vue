<script setup lang="ts">
	import { formatDate } from '~/utils/date';
	import { SUPPLY_STATUS, lockCountdown, periodStageSteps, supplyLockLabel } from '~/utils/office.utils';
	import type { SupplyPeriod } from '~/types/office.types';

	/**
	 * Kỳ đang ở bước nào của vòng đời OPEN → LOCKED → CLOSED, kèm hạn chót, giờ khoá, còn bao lâu và
	 * người mở; từ khi khoá thì thêm tiến độ chốt, cấp, nhận của các phiếu.
	 */
	const props = defineProps<{
		period: SupplyPeriod;
		now: Date;
		counts: { total: number; finalized: number; issued: number; received: number };
	}>();

	const steps = computed(() => periodStageSteps(props.period));

	const countdown = computed(() => {
		if (props.period.status !== 'OPEN') return null;
		const overdue = new Date(props.period.lockAt).getTime() <= props.now.getTime();
		return { text: overdue ? 'Đã quá hạn' : lockCountdown(props.period.lockAt, props.now), overdue };
	});

	const showCounts = computed(() => props.period.status !== 'OPEN' && props.counts.total > 0);
</script>

<template>
	<div data-tour="period-stage" class="space-y-2">
		<ol class="flex flex-wrap items-start gap-x-2 gap-y-1" aria-label="Giai đoạn của kỳ">
			<li v-for="(step, index) in steps" :key="step.status" class="flex items-start gap-2">
				<div class="flex flex-col">
					<span
						:aria-current="step.state === 'current' ? 'step' : undefined"
						:class="[
							'inline-flex items-center gap-1.5 text-sm',
							step.state === 'current'
								? 'font-semibold text-gray-900 dark:text-white'
								: step.state === 'done'
									? 'text-gray-600 dark:text-gray-300'
									: 'text-gray-400 dark:text-gray-500',
						]"
					>
						<span
							aria-hidden="true"
							:class="[
								'h-2.5 w-2.5 rounded-full',
								step.state === 'current'
									? 'bg-brand-600 ring-4 ring-brand-100 dark:ring-brand-900/40'
									: step.state === 'done'
										? 'bg-brand-400'
										: 'border border-gray-300 dark:border-gray-600',
							]"
						/>
						{{ step.label }}
						<span v-if="step.state === 'done'" class="sr-only">(đã qua)</span>
						<span v-else-if="step.state === 'todo'" class="sr-only">(chưa tới)</span>
					</span>
					<span v-if="step.at" class="ml-4 text-xs text-gray-500 dark:text-gray-400">{{ step.at }}</span>
				</div>
				<span v-if="index < steps.length - 1" class="mt-2 h-px w-8 bg-gray-300 sm:w-14 dark:bg-gray-600" aria-hidden="true" />
			</li>
		</ol>

		<p class="text-sm text-gray-600 dark:text-gray-400">
			{{ period.officeSite.name }} · Hạn chót {{ formatDate(period.deadline) }} · Phiếu khoá lúc
			{{ supplyLockLabel(period.lockAt) }}
			<template v-if="countdown">
				·
				<span
					:class="['font-medium', countdown.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400']"
					>{{ countdown.text }}</span
				>
			</template>
			<template v-if="period.createdBy"> · Mở bởi {{ period.createdBy.fullName }}</template>
		</p>

		<p v-if="showCounts" class="text-sm text-gray-700 dark:text-gray-300">
			{{ SUPPLY_STATUS.FINALIZED.shortLabel }} <span class="font-semibold tabular-nums">{{ counts.finalized }}/{{ counts.total }}</span>
			· {{ SUPPLY_STATUS.ISSUED.shortLabel }} <span class="font-semibold tabular-nums">{{ counts.issued }}/{{ counts.total }}</span>
			· {{ SUPPLY_STATUS.RECEIVED.shortLabel }} <span class="font-semibold tabular-nums">{{ counts.received }}/{{ counts.total }}</span>
			<span class="text-gray-500 dark:text-gray-400"> phiếu có đăng ký</span>
		</p>
	</div>
</template>
