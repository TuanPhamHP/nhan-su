<template>
  <div :class="[$style.card, active && $style.active]">
    <div :class="$style.content">
      <p :class="$style.label">{{ label }}</p>
      <p :class="$style.value" >{{ value ?? 0 }}</p>
    </div>
    <div :class="[$style.iconBox, $style[`color-${color}`]]">
      <img v-if="img" :src="img" :class="$style.img" alt="" />
      <Icon v-else-if="icon" :name="icon" size="22" />
    </div>
  </div>
</template>

<script setup lang="ts">
type ColorVariant = 'blue' | 'orange' | 'green' | 'yellow' | 'red' | 'purple'

interface Props {
  label: string
  value: string | number
  icon?: string
  img?: string
  color?: ColorVariant
  active?: boolean
  clickable?: boolean
}

withDefaults(defineProps<Props>(), {
  color: 'blue',
  active: false,
  clickable: false,
})
</script>

<style module lang="scss">
.card {
  background-color: white;
  border-radius: $radius-lg;
  padding: $spacing-md $spacing-lg;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: $shadow-sm;
  border: 1px solid $color-border;
  gap: $spacing-md;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease;

  &:hover {
    border-color: $color-primary;
    box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.08);
  }
}

.active {
  border-color: $color-primary !important;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15) !important;
}

.content {
  flex: 1;
  min-width: 0;
}

.label {
  font-size: 14px;
  margin: 0 0 $spacing-xs 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.value {
  font-size: 1.75rem;
  font-weight: $font-weight-bold;
  color: $color-text-primary;
  margin: 0;
  line-height: 1.2;
}

.img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.iconBox {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.color-blue {
  background-color: #eff6ff;
  color: #3b82f6;
  border:1px solid #93C5FD;
}

.color-orange {
  background-color: #fff7ed;
  color: #f97316;
  border: 1px solid #FDBA74;
}

.color-green {
  background-color: #f0fdf4;
  color: #22c55e;
  border: 1px solid #86EFAC;
}

.color-yellow {
  background-color: #fefce8;
  color: #eab308;
}

.color-red {
  background-color: #fef2f2;
  color: #ef4444;
}

.color-purple {
  background-color: #faf5ff;
  color: #a855f7;
}
</style>
