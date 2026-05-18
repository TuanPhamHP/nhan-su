<template>
  <div :class="[$style.wrapper, error && $style.wrapperError]" ref="wrapperRef">
    <div :class="[$style.trigger, isOpen && $style.triggerOpen]" @click="toggleOpen">
      <span v-if="displayText" :class="$style.triggerText">{{ displayText }}</span>
      <span v-else :class="$style.placeholder">{{ effectivePlaceholder }}</span>
      <Icon name="mdi:calendar-outline" size="16" :class="$style.calIcon" />
    </div>

    <Teleport to="body">
      <div v-if="isOpen" ref="dropdownRef" :class="$style.dropdown" :style="dropdownStyle">
        <div :class="$style.calendarPanel">
          <div :class="$style.calHeader">
            <div :class="$style.calNav">
              <button type="button" :class="$style.navBtn" @click="currentMonth -= 12">«</button>
              <button type="button" :class="$style.navBtn" @click="currentMonth--">‹</button>
            </div>
            <span :class="$style.calTitle">{{ currentYear }} - {{ MONTHS[currentMonthIndex] }}</span>
            <div :class="$style.calNav">
              <button type="button" :class="$style.navBtn" @click="currentMonth++">›</button>
              <button type="button" :class="$style.navBtn" @click="currentMonth += 12">»</button>
            </div>
          </div>

          <div :class="$style.dayHeaders">
            <div v-for="d in DAY_NAMES" :key="d" :class="$style.dayHeader">{{ d }}</div>
          </div>

          <div :class="$style.dayGrid">
            <div
              v-for="(cell, i) in cells"
              :key="i"
              :class="$style.dayCell"
              @click="cell.isCurrentMonth && !cell.isDisabled && onDateSelect(cell.dateStr)"
            >
              <div
                :class="[
                  $style.day,
                  !cell.isCurrentMonth && $style.dayOutside,
                  cell.isDisabled && $style.dayDisabled,
                  isSelected(cell.dateStr) && $style.daySelected,
                  isToday(cell.dateStr) && !isSelected(cell.dateStr) && $style.dayToday,
                ]"
              >
                {{ cell.day }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const { locale, t } = useLocale()

interface Props {
  modelValue: string
  placeholder?: string
  min?: string
  max?: string
  error?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: undefined,
  min: undefined,
  max: undefined,
  error: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const effectivePlaceholder = computed(() => props.placeholder ?? t('common.datePlaceholder'))

const MONTHS_MAP: Record<string, string[]> = {
  vi: ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'],
  cn: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
}
const DAY_NAMES_MAP: Record<string, string[]> = {
  vi: ['CN','T2','T3','T4','T5','T6','T7'],
  cn: ['日','一','二','三','四','五','六'],
}
const MONTHS = computed((): string[] => MONTHS_MAP[locale.value] ?? MONTHS_MAP.vi!)
const DAY_NAMES = computed((): string[] => DAY_NAMES_MAP[locale.value] ?? DAY_NAMES_MAP.vi!)

const isOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

const now = new Date()
const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate())

// Init calendar to the selected date's month, or today
const initMonth = computed(() => {
  if (props.modelValue) {
    const [y, m] = props.modelValue.split('-').map(Number)
    return (y ?? now.getFullYear()) * 12 + ((m ?? now.getMonth() + 1) - 1)
  }
  return now.getFullYear() * 12 + now.getMonth()
})

const currentMonth = ref(initMonth.value)

watch(() => props.modelValue, () => {
  if (!isOpen.value) currentMonth.value = initMonth.value
})

const currentYear = computed(() => Math.floor(currentMonth.value / 12))
const currentMonthIndex = computed(() => ((currentMonth.value % 12) + 12) % 12)

interface DayCell {
  day: number
  dateStr: string
  isCurrentMonth: boolean
  isDisabled: boolean
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function buildCells(year: number, month: number): DayCell[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const result: DayCell[] = []

  const prevDays = new Date(year, month, 0).getDate()
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    result.push({ day: d, dateStr: toDateStr(py, pm, d), isCurrentMonth: false, isDisabled: true })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(year, month, d)
    const isDisabled = (!!props.min && ds < props.min) || (!!props.max && ds > props.max)
    result.push({ day: d, dateStr: ds, isCurrentMonth: true, isDisabled })
  }

  const remaining = 42 - result.length
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    result.push({ day: d, dateStr: toDateStr(ny, nm, d), isCurrentMonth: false, isDisabled: true })
  }

  return result
}

const cells = computed(() => buildCells(currentYear.value, currentMonthIndex.value))

function isToday(dateStr: string): boolean {
  return dateStr === todayStr
}

function isSelected(dateStr: string): boolean {
  return dateStr === props.modelValue
}

const dropdownStyle = ref<Record<string, string>>({})

function toggleOpen() {
  if (isOpen.value) {
    isOpen.value = false
  } else {
    currentMonth.value = initMonth.value
    isOpen.value = true
    nextTick(() => positionDropdown())
  }
}

function positionDropdown() {
  if (!wrapperRef.value) return
  const rect = wrapperRef.value.getBoundingClientRect()
  const DROPDOWN_WIDTH = 290
  const spaceRight = window.innerWidth - rect.left
  const style: Record<string, string> = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    zIndex: '9999',
  }
  if (spaceRight >= DROPDOWN_WIDTH) {
    style.left = `${rect.left}px`
  } else {
    style.right = `${window.innerWidth - rect.right}px`
  }
  dropdownStyle.value = style
}

function onDateSelect(dateStr: string) {
  emit('update:modelValue', dateStr)
  isOpen.value = false
}

const displayText = computed(() => {
  if (!props.modelValue) return ''
  const [y, m, d] = props.modelValue.split('-')
  return `${d}/${m}/${y}`
})

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (wrapperRef.value?.contains(target)) return
  if (dropdownRef.value?.contains(target)) return
  isOpen.value = false
}

onMounted(() => window.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => window.removeEventListener('mousedown', handleClickOutside))
</script>

<style module lang="scss">
.wrapper {
  position: relative;
  width: 100%;
}

.wrapperError {
  .trigger {
    border-color: #ef4444;

    &:hover {
      border-color: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
    }
  }
}

.trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.5rem 0.75rem;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  background: #fff;
  font-size: $font-size-sm;
  cursor: pointer;
  height: 38px;
  transition: border-color 150ms ease;

  &:hover {
    border-color: $color-primary;
  }
}

.triggerOpen {
  border-color: $color-primary;
  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
}

.triggerText {
  flex: 1;
  color: $color-text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.placeholder {
  flex: 1;
  color: #9ca3af;
}

.calIcon {
  color: #6b7280;
  flex-shrink: 0;
}

.dropdown {
  background: #fff;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.calendarPanel {
  padding: 12px;
  width: 280px;
}

.calHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
}

.calTitle {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.calNav {
  display: flex;
  gap: 4px;
}

.navBtn {
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  color: #6b7280;
  font-size: 14px;
  line-height: 1;

  &:hover {
    background: #f3f4f6;
  }
}

.dayHeaders {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}

.dayHeader {
  padding: 4px 0;
  font-size: 12px;
  color: #6b7280;
}

.dayGrid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}

.dayCell {
  padding: 2px;
  cursor: pointer;
}

.day {
  width: 32px;
  height: 32px;
  line-height: 32px;
  margin: auto;
  border-radius: 6px;
  font-size: 13px;
  color: #1f2937;
  transition: background 0.15s ease;

  &:hover {
    background: #f3f4f6;
  }
}

.dayOutside {
  color: #d1d5db;
  cursor: default;

  &:hover {
    background: transparent;
  }
}

.dayDisabled {
  color: #d1d5db;
  cursor: not-allowed;

  &:hover {
    background: transparent;
  }
}

.daySelected {
  background: #3b82f6 !important;
  color: white !important;
  font-weight: 600;
}

.dayToday {
  border: 1px solid #3b82f6;
  font-weight: 600;
}
</style>
