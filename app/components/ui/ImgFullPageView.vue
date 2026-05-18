<template>
  <Teleport to="body">
    <div :class="$style.overlay" @click.self="emit('close')">
      <!-- Header -->
      <div :class="$style.header">
        <span :class="$style.counter">{{ currentIdx + 1 }} / {{ urls.length }}</span>
        <button :class="$style.closeBtn" type="button" aria-label="Đóng" @click="emit('close')">
          <Icon name="mdi:close" size="22" />
        </button>
      </div>

      <!-- Body -->
      <div :class="$style.body">
        <button
          v-if="urls.length > 1"
          :class="[$style.navBtn, $style.navBtnPrev]"
          type="button"
          aria-label="Ảnh trước"
          @click="prev"
        >
          <Icon name="mdi:chevron-left" size="28" />
        </button>

        <img
          :key="currentIdx"
          :src="urls[currentIdx]"
          :alt="`Ảnh ${currentIdx + 1}`"
          :class="$style.mainImg"
        />

        <button
          v-if="urls.length > 1"
          :class="[$style.navBtn, $style.navBtnNext]"
          type="button"
          aria-label="Ảnh tiếp theo"
          @click="next"
        >
          <Icon name="mdi:chevron-right" size="28" />
        </button>
      </div>

      <!-- Footer -->
      <div :class="$style.footer">
        <div :class="$style.thumbList">
          <button
            v-for="(url, i) in urls"
            :key="i"
            :class="[$style.thumbBtn, i === currentIdx && $style.thumbBtnActive]"
            type="button"
            @click="currentIdx = i"
          >
            <img :src="url" :alt="`Thumbnail ${i + 1}`" :class="$style.thumb" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  urls: string[]
  idx: number
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const currentIdx = ref(props.idx)

function prev() {
  currentIdx.value = (currentIdx.value - 1 + props.urls.length) % props.urls.length
}

function next() {
  currentIdx.value = (currentIdx.value + 1) % props.urls.length
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft')  prev()
  if (e.key === 'ArrowRight') next()
  if (e.key === 'Escape')     emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.body.style.overflow = ''
})
</script>

<style module lang="scss">
// ── Overlay ────────────────────────────────────────────
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
}

// ── Header ─────────────────────────────────────────────
.header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: rgba(0, 0, 0, 0.4);
}

.counter {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: white;
}

.closeBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  transition: background-color 150ms ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
}

// ── Body ───────────────────────────────────────────────
.body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: 1rem 4rem;
}

.mainImg {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: $radius-md;
  user-select: none;
}

.navBtn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border: none;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.15);
  color: white;
  cursor: pointer;
  transition: background-color 150ms ease;
  z-index: 1;

  &:hover {
    background-color: rgba(255, 255, 255, 0.28);
  }
}

.navBtnPrev {
  left: 0.75rem;
}

.navBtnNext {
  right: 0.75rem;
}

// ── Footer ─────────────────────────────────────────────
.footer {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  background-color: rgba(0, 0, 0, 0.4);
  overflow-x: auto;
}

.thumbList {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: nowrap;
}

.thumbBtn {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border: 2px solid transparent;
  border-radius: $radius-md;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  background: none;
  opacity: 0.55;
  transition: opacity 150ms ease, border-color 150ms ease;

  &:hover {
    opacity: 0.85;
  }
}

.thumbBtnActive {
  border-color: white;
  opacity: 1;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
