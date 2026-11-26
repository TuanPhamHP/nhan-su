<script setup lang="ts">
	import type { KpiDistribution, KpiGrade } from '~/types/kpi.types';
	import { kpiGradeBarClass, kpiNum } from '~/utils/kpi.utils';

	/**
	 * Phân bố xếp loại một phòng (hoặc cả công ty) bằng một thanh CSS chia theo tỷ lệ (không dùng thư viện
	 * biểu đồ). Dưới thanh là số người từng loại; phiếu chưa xếp loại ghi riêng.
	 */
	const props = defineProps<{ dist: KpiDistribution; grades: KpiGrade[]; label: string; strong?: boolean }>();
	const parts = computed(() =>
		props.grades.map(g => ({ label: g.label, n: props.dist.byGrade[g.label] ?? 0 })).filter(p => p.n > 0),
	);
	const ungraded = computed(() => props.dist.total - props.dist.graded);
</script>

<template>
	<div class="space-y-1" :data-testid="`kpi-dist-${dist.department?.id ?? 'all'}`">
		<div class="flex items-baseline justify-between gap-2 text-sm">
			<span :class="strong ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200'">{{ label }}</span>
			<span class="text-xs text-gray-500">{{ dist.graded }}/{{ dist.total }} người đã xếp loại</span>
		</div>
		<div class="flex h-4 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" role="img" :aria-label="`${label}: ${parts.map(p => `${p.label} ${p.n} người`).join(', ') || 'chưa có xếp loại'}`">
			<div
				v-for="p in parts"
				:key="p.label"
				class="h-full"
				:class="kpiGradeBarClass(p.label, grades)"
				:style="{ width: `${(p.n / Math.max(dist.graded, 1)) * 100}%` }"
				:title="`${p.label}: ${p.n} người`"
			/>
		</div>
		<p class="flex flex-wrap gap-x-3 text-xs text-gray-600 dark:text-gray-300">
			<span v-for="g in grades" :key="g.label">
				<span class="mr-1 inline-block h-2 w-2 rounded-full" :class="kpiGradeBarClass(g.label, grades)" />{{ g.label }}: {{ dist.byGrade[g.label] ?? 0 }}<template v-if="dist.graded">
					({{ kpiNum(((dist.byGrade[g.label] ?? 0) / dist.graded) * 100, 1) }}%)</template
				>
			</span>
			<span v-if="ungraded > 0" class="text-gray-400">chưa xếp loại: {{ ungraded }}</span>
		</p>
	</div>
</template>
