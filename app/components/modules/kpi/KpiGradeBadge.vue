<script setup lang="ts">
	import type { KpiGrade } from '~/types/kpi.types';
	import { kpiGradeClass } from '~/utils/kpi.utils';

	/** Ô xếp loại (A, B, C, D). Màu theo vị trí trong thang của kỳ, không đoán theo chữ. */
	defineProps<{ grade: string | null; grades: KpiGrade[]; size?: 'sm' | 'lg' }>();
</script>

<template>
	<span
		class="inline-flex items-center justify-center rounded-lg font-bold"
		:class="[kpiGradeClass(grade, grades), size === 'lg' ? 'h-12 min-w-12 px-3 text-2xl' : 'h-6 min-w-6 px-1.5 text-xs']"
		:aria-label="grade ? `Xếp loại ${grade}` : 'Chưa xếp loại'"
	>
		{{ grade ?? '—' }}
	</span>
</template>
