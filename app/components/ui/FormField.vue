<template>
  <div :class="$style.field">
    <label v-if="label" :class="$style.label">
      {{ label }}
      <span v-if="required" :class="$style.required">*</span>
    </label>
    <slot />
    <span v-if="error" :class="$style.error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  required?: boolean
  error?: string
}

defineProps<Props>()
</script>

<style module lang="scss">
.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.label {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-text-primary;
  text-align: left;
}

.required {
  color: #ef4444;
  margin-left: 0.125rem;
}

.error {
  font-size: 0.75rem;
  color: #ef4444;
}
</style>
