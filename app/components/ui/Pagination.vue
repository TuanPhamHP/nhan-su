<template>
  <div :class="$style.wrapper">
    <p :class="$style.info">
      Hiển thị {{ startItem }}-{{ endItem }} trong {{ totalItems }} kết quả
    </p>

    <div :class="$style.pages">
      <button
        :class="[$style.pageBtn, $style.arrow]"
        :disabled="currentPage <= 1"
        type="button"
        @click="emit('update:currentPage', currentPage - 1)"
      >
        <ChevronLeftIcon class="w-4 h-4" />
      </button>

      <template v-for="item in pageItems" :key="item">
        <span v-if="item === '...'" :class="$style.ellipsis">…</span>
        <button
          v-else
          :class="[$style.pageBtn, item === currentPage && $style.active]"
          type="button"
          @click="emit('update:currentPage', item as number)"
        >
          {{ item }}
        </button>
      </template>

      <button
        :class="[$style.pageBtn, $style.arrow]"
        :disabled="currentPage >= totalPages"
        type="button"
        @click="emit('update:currentPage', currentPage + 1)"
      >
        <ChevronRightIcon class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import ChevronLeftIcon from '~/assets/icons/chevron-left.svg?component'
import ChevronRightIcon from '~/assets/icons/chevron-right.svg?component'

interface Props {
  currentPage: number
  totalPages: number
  totalItems: number
  perPage: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:currentPage': [page: number]
}>()

const startItem = computed(() => (props.currentPage - 1) * props.perPage + 1)
const endItem = computed(() => Math.min(props.currentPage * props.perPage, props.totalItems))

// Generates: 1 2 3 ... (last-1) last  or  1 ... (cur-1) cur (cur+1) ... (last-1) last
const pageItems = computed<(number | '...')[]>(() => {
  const { currentPage: cur, totalPages: total } = props
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const items: (number | '...')[] = []

  // Always show first 3
  const headPages = [1, 2, 3]
  // Always show last 2
  const tailPages = [total - 1, total]

  // Middle window: cur-1, cur, cur+1
  const midPages = [cur - 1, cur, cur + 1].filter(p => p > 3 && p < total - 1)

  const allPages = new Set([...headPages, ...midPages, ...tailPages])
  const sorted = Array.from(allPages).sort((a, b) => a - b)

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      items.push('...')
    }
    items.push(sorted[i])
  }

  return items
})
</script>

<style module lang="scss">
.wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md 0;
}

.info {
  font-size: $font-size-sm;
  color: $color-text-secondary;
  margin: 0;
}

.pages {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pageBtn {
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.375rem;
  border-radius: $radius-md;
  border: 1px solid $color-border;
  background-color: white;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;

  &:hover:not(:disabled) {
    background-color: #f3f4f6;
    border-color: #d1d5db;
    color: $color-text-primary;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.active {
  background-color: $color-primary;
  border-color: $color-primary;
  color: white;
  font-weight: $font-weight-semibold;

  &:hover:not(:disabled) {
    background-color: $color-primary-dark;
    border-color: $color-primary-dark;
    color: white;
  }
}

.arrow {
  color: $color-text-secondary;
}

.ellipsis {
  min-width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-sm;
  color: $color-text-secondary;
  user-select: none;
}
</style>
