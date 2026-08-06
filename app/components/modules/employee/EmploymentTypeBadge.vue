<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { EmploymentType } from '~/types/employee.types';
import { EMPLOYMENT_TYPE_BADGE_CLS } from '~/utils/employment-type';

const props = defineProps<{ type: EmploymentType }>();

const metaDataStore = useMetaDataStore();
const { employmentTypes } = storeToRefs(metaDataStore);

const label = computed(
	() => employmentTypes.value.find(t => t.value === props.type)?.label ?? props.type,
);
const cls = computed(() => EMPLOYMENT_TYPE_BADGE_CLS[props.type]);
</script>

<template>
	<span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', cls]">
		{{ label }}
	</span>
</template>
