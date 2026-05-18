<template>
  <Teleport to="body">
    <div :class="$style.container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[$style.toast, $style[toast.type]]"
        >
          <span :class="$style.icon">
            <CheckCircleIcon v-if="toast.type === 'success'" class="w-5 h-5" />
            <XCircleIcon v-else-if="toast.type === 'error'" class="w-5 h-5" />
            <AlertTriangleIcon v-else-if="toast.type === 'warning'" class="w-5 h-5" />
            <InfoIcon v-else class="w-5 h-5" />
          </span>
          <span :class="$style.message">{{ toast.message }}</span>
          <button :class="$style.close" type="button" @click="remove(toast.id)">
            <XCloseIcon class="w-4 h-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import CheckCircleIcon from '~/assets/icons/check-circle.svg?component'
import XCircleIcon from '~/assets/icons/x-circle.svg?component'
import AlertTriangleIcon from '~/assets/icons/alert-triangle.svg?component'
import XCloseIcon from '~/assets/icons/x-close.svg?component'
import InfoIcon from '~/assets/icons/mark.svg?component'

const { toasts, remove } = useToast()
</script>

<style module lang="scss">
.container {
  position: fixed;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 0.625rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 16rem;
  max-width: 22rem;
  pointer-events: all;
  font-size: 0.875rem;
  font-weight: 500;
  background: white;
  border: 1px solid transparent;
}

.success {
  border-color: #bbf7d0;
  color: #15803d;

  .icon { color: #16a34a; }
}

.error {
  border-color: #fecaca;
  color: #b91c1c;

  .icon { color: #dc2626; }
}

.warning {
  border-color: #fde68a;
  color: #92400e;

  .icon { color: #d97706; }
}

.info {
  border-color: #bfdbfe;
  color: #1d4ed8;

  .icon { color: #2563eb; }
}

.icon {
  flex-shrink: 0;
  display: flex;
}

.message {
  flex: 1;
}

.close {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: inherit;
  opacity: 0.6;
  display: flex;

  &:hover { opacity: 1; }
}
</style>

<style>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(1rem);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}
</style>
