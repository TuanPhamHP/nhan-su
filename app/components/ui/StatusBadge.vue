<template>
  <span :class="[$style.badge, $style[config.variant]]">
    {{ config.label }}
  </span>
</template>

<script setup lang="ts">
export interface ScheduleStatus {
  value: string
  label: string
}

interface Props {
  status: ScheduleStatus
}

const props = defineProps<Props>()

const variantMap: Record<string, string> = {
  received:   'blue',
  completed:  'green',
  processing: 'orange',
  draft:      'gray',
  pending:    'yellow',
  failed:     'red',
  new:        'blue',
  cancelled:  'red',
}

const config = computed(() => ({
  label: props.status?.label ?? '-',
  variant: variantMap[props.status?.value] ?? 'gray',
}))
</script>

<style module lang="scss">
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.625rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid transparent;
  letter-spacing: 0.02em;
}

.blue {
  background-color: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
}

.green {
  background-color: #f0fdf4;
  color: #16a34a;
  border-color: #bbf7d0;
}

.orange {
  background-color: #fff7ed;
  color: #ea580c;
  border-color: #fed7aa;
}

.gray {
  background-color: #f9fafb;
  color: #6b7280;
  border-color: #e5e7eb;
}

.yellow {
  background-color: #fefce8;
  color: #ca8a04;
  border-color: #fde68a;
}

.red {
  background-color: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}
</style>
