<template>
  <div :class="[$style.wrapper, error && $style.wrapperError]" ref="wrapperRef">
    <div :class="[$style.trigger, isOpen && $style.triggerOpen]" @click="toggleOpen">
      <span v-if="displayText" :class="$style.triggerText">{{ displayText }}</span>
      <span v-else :class="$style.placeholder">{{ effectivePlaceholder }}</span>
      <Icon name="mdi:calendar-clock-outline" size="16" :class="$style.calIcon" />
    </div>

    <Teleport to="body">
      <div v-if="isOpen" ref="dropdownRef" :class="$style.dropdown" :style="dropdownStyle">
        <!-- Calendar (left) -->
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
              @click="cell.isCurrentMonth && !cell.isDisabled && selectDate(cell.dateStr)"
            >
              <div
                :class="[
                  $style.day,
                  !cell.isCurrentMonth && $style.dayOutside,
                  cell.isDisabled && $style.dayDisabled,
                  pickedDate === cell.dateStr && $style.daySelected,
                  isToday(cell.dateStr) && pickedDate !== cell.dateStr && $style.dayToday,
                ]"
              >
                {{ cell.day }}
              </div>
            </div>
          </div>
        </div>

        <!-- Time picker (right) -->
        <div :class="$style.timePanel">
          <div :class="$style.timeCols">
            <!-- Hour column -->
            <div :class="$style.timeColWrapper">
              <span :class="$style.timeLabel">{{ hourLabel }}</span>
              <button type="button" :class="$style.scrollBtn" @click="stepHour(-1)">
                <Icon name="mdi:chevron-up" size="14" />
              </button>
              <div :class="$style.timeCol" ref="hourColRef">
                <div
                  v-for="h in 24"
                  :key="h - 1"
                  :class="[
                    $style.timeItem,
                    pickedHour === h - 1 && $style.timeItemSelected,
                    isHourDisabled(h - 1) && $style.timeItemDisabled,
                  ]"
                  @click="!isHourDisabled(h - 1) && selectHour(h - 1)"
                >
                  {{ String(h - 1).padStart(2, '0') }}
                </div>
              </div>
              <button type="button" :class="$style.scrollBtn" @click="stepHour(1)">
                <Icon name="mdi:chevron-down" size="14" />
              </button>
            </div>

            <span :class="$style.timeSep">:</span>

            <!-- Minute column -->
            <div :class="$style.timeColWrapper">
              <span :class="$style.timeLabel">{{ minLabel }}</span>
              <button type="button" :class="$style.scrollBtn" @click="stepMinute(-1)">
                <Icon name="mdi:chevron-up" size="14" />
              </button>
              <div :class="$style.timeCol" ref="minColRef">
                <div
                  v-for="m in 60"
                  :key="m - 1"
                  :class="[
                    $style.timeItem,
                    pickedMinute === m - 1 && $style.timeItemSelected,
                    isMinuteDisabled(m - 1) && $style.timeItemDisabled,
                  ]"
                  @click="!isMinuteDisabled(m - 1) && selectMinute(m - 1)"
                >
                  {{ String(m - 1).padStart(2, '0') }}
                </div>
              </div>
              <button type="button" :class="$style.scrollBtn" @click="stepMinute(1)">
                <Icon name="mdi:chevron-down" size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const { locale } = useLocale()

interface Props {
  modelValue: string
  placeholder?: string
  min?: string
  max?: string
  error?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '–/– dd/mm/yyyy',
  min: undefined,
  max: undefined,
  error: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [event: Event]
}>()

const effectivePlaceholder = computed(() => props.placeholder)

const MONTHS_MAP: Record<string, string[]> = {
  vi: ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'],
  cn: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
}
const DAY_NAMES_MAP: Record<string, string[]> = {
  vi: ['CN','T2','T3','T4','T5','T6','T7'],
  cn: ['日','一','二','三','四','五','六'],
}
const hourLabel = computed(() => locale.value === 'cn' ? '时' : 'Giờ')
const minLabel = computed(() => locale.value === 'cn' ? '分' : 'Phút')
const MONTHS = computed((): string[] => MONTHS_MAP[locale.value] ?? MONTHS_MAP.vi!)
const DAY_NAMES = computed((): string[] => DAY_NAMES_MAP[locale.value] ?? DAY_NAMES_MAP.vi!)

// ─── Value parsing ───────────────────────────────────────────────────────────

function parseValue(v: string) {
  if (!v) return { date: '', hour: 0, minute: 0 }
  const [datePart, timePart] = v.split('T')
  const [hStr, mStr] = (timePart || '00:00').split(':')
  return { date: datePart ?? '', hour: Number(hStr) || 0, minute: Number(mStr) || 0 }
}

const initial = parseValue(props.modelValue)
const pickedDate = ref(initial.date)
const pickedHour = ref(initial.hour)
const pickedMinute = ref(initial.minute)

watch(() => props.modelValue, v => {
  const p = parseValue(v)
  pickedDate.value = p.date
  pickedHour.value = p.hour
  pickedMinute.value = p.minute
})

// ─── Min / past-time constraints ─────────────────────────────────────────────

const minDate = computed(() => props.min?.split('T')[0] ?? '')
const minHour = computed(() => Number(props.min?.split('T')[1]?.split(':')[0] ?? 0))
const minMin = computed(() => Number(props.min?.split('T')[1]?.split(':')[1] ?? 0))

function isDateDisabled(ds: string): boolean {
  if (props.min && ds < minDate.value) return true
  if (props.max && ds > (props.max.split('T')[0] ?? '')) return true
  return false
}

function isHourDisabled(h: number): boolean {
  if (!props.min || !pickedDate.value) return false
  return pickedDate.value === minDate.value && h < minHour.value
}

function isMinuteDisabled(m: number): boolean {
  if (!props.min || !pickedDate.value) return false
  return pickedDate.value === minDate.value && pickedHour.value === minHour.value && m < minMin.value
}

// ─── Calendar ────────────────────────────────────────────────────────────────

const now = new Date()

const currentMonth = ref(
  initial.date
    ? Number(initial.date.split('-')[0]) * 12 + Number(initial.date.split('-')[1]) - 1
    : now.getFullYear() * 12 + now.getMonth()
)

const currentYear = computed(() => Math.floor(currentMonth.value / 12))
const currentMonthIndex = computed(() => ((currentMonth.value % 12) + 12) % 12)

interface DayCell { day: number; dateStr: string; isCurrentMonth: boolean; isDisabled: boolean }

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function buildCells(year: number, month: number): DayCell[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const result: DayCell[] = []

  for (let i = firstDay - 1; i >= 0; i--) {
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    result.push({ day: prevDays - i, dateStr: toDateStr(py, pm, prevDays - i), isCurrentMonth: false, isDisabled: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(year, month, d)
    result.push({ day: d, dateStr: ds, isCurrentMonth: true, isDisabled: isDateDisabled(ds) })
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

function isToday(ds: string) {
  return ds === toDateStr(now.getFullYear(), now.getMonth(), now.getDate())
}

// ─── Selection ───────────────────────────────────────────────────────────────

function emitValue() {
  if (!pickedDate.value) return
  const val = `${pickedDate.value}T${String(pickedHour.value).padStart(2, '0')}:${String(pickedMinute.value).padStart(2, '0')}`
  emit('update:modelValue', val)
  emit('change', new Event('change'))
}

function selectDate(ds: string) {
  pickedDate.value = ds
  if (props.min && ds === minDate.value) {
    if (pickedHour.value < minHour.value) pickedHour.value = minHour.value
    if (pickedHour.value === minHour.value && pickedMinute.value < minMin.value) pickedMinute.value = minMin.value
  }
  emitValue()
  scrollToTime()
}

function selectHour(h: number) {
  pickedHour.value = h
  if (props.min && pickedDate.value === minDate.value && h === minHour.value && pickedMinute.value < minMin.value) {
    pickedMinute.value = minMin.value
  }
  emitValue()
  nextTick(() => scrollColTo(minColRef.value, pickedMinute.value))
}

function selectMinute(m: number) {
  pickedMinute.value = m
  emitValue()
}

function stepHour(delta: number) {
  let h = ((pickedHour.value + delta) + 24) % 24
  while (isHourDisabled(h) && h !== pickedHour.value) h = ((h + delta) + 24) % 24
  if (!isHourDisabled(h)) { selectHour(h); nextTick(() => scrollColTo(hourColRef.value, h)) }
}

function stepMinute(delta: number) {
  let m = ((pickedMinute.value + delta) + 60) % 60
  while (isMinuteDisabled(m) && m !== pickedMinute.value) m = ((m + delta) + 60) % 60
  if (!isMinuteDisabled(m)) { selectMinute(m); nextTick(() => scrollColTo(minColRef.value, m)) }
}

// ─── Time scroll ─────────────────────────────────────────────────────────────

const hourColRef = ref<HTMLElement | null>(null)
const minColRef = ref<HTMLElement | null>(null)
const ITEM_H = 32

function scrollColTo(el: HTMLElement | null, index: number) {
  if (!el) return
  const visibleItems = Math.max(1, Math.floor(el.clientHeight / ITEM_H))
  el.scrollTop = Math.max(0, (index - Math.floor(visibleItems / 2)) * ITEM_H)
}

function scrollToTime() {
  nextTick(() => {
    scrollColTo(hourColRef.value, pickedHour.value)
    scrollColTo(minColRef.value, pickedMinute.value)
  })
}

// ─── Dropdown open / position ─────────────────────────────────────────────

const isOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

function toggleOpen() {
  if (isOpen.value) { isOpen.value = false; return }
  const p = parseValue(props.modelValue)
  pickedDate.value = p.date
  pickedHour.value = p.hour
  pickedMinute.value = p.minute
  currentMonth.value = p.date
    ? Number(p.date.split('-')[0]) * 12 + Number(p.date.split('-')[1]) - 1
    : now.getFullYear() * 12 + now.getMonth()
  isOpen.value = true
  nextTick(() => { positionDropdown(); scrollToTime() })
}

function positionDropdown() {
  if (!wrapperRef.value) return
  const rect = wrapperRef.value.getBoundingClientRect()
  const DROPDOWN_W = 390
  const DROPDOWN_H = 340
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceRight = window.innerWidth - rect.left

  const style: Record<string, string> = { position: 'fixed', zIndex: '9999' }
  style.top = spaceBelow >= DROPDOWN_H ? `${rect.bottom + 4}px` : `${rect.top - DROPDOWN_H - 4}px`
  style[spaceRight >= DROPDOWN_W ? 'left' : 'right'] = spaceRight >= DROPDOWN_W
    ? `${rect.left}px`
    : `${window.innerWidth - rect.right}px`

  dropdownStyle.value = style
}

function handleClickOutside(e: MouseEvent) {
  const t = e.target as Node
  if (wrapperRef.value?.contains(t) || dropdownRef.value?.contains(t)) return
  isOpen.value = false
}

onMounted(() => window.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => window.removeEventListener('mousedown', handleClickOutside))

// ─── Display ─────────────────────────────────────────────────────────────────

const displayText = computed(() => {
  if (!props.modelValue) return ''
  const [datePart, timePart] = props.modelValue.split('T')
  if (!datePart || !timePart) return ''
  const [y, mo, d] = datePart.split('-')
  return `${timePart} - ${d}/${mo}/${y}`
})
</script>

<style module lang="scss">
.wrapper {
  position: relative;
  width: 100%;
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
  &:hover { border-color: $color-primary; }
}

.wrapperError {
  .trigger {
    border-color: #ef4444;
    &:hover { border-color: #ef4444; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15); }
  }
}

.triggerOpen {
  border-color: $color-primary;
  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
}

.triggerText { flex: 1; color: $color-text-primary; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.placeholder { flex: 1; color: #9ca3af; }
.calIcon { color: #6b7280; flex-shrink: 0; }

// ─── Dropdown layout (calendar + time side by side) ───────────────────────
.dropdown {
  display: flex;
  align-items: stretch;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

// ─── Calendar ────────────────────────────────────────────────────────────────
.calendarPanel {
  padding: 12px;
  flex-shrink: 0;
}

.calHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
}

.calTitle { font-size: 14px; font-weight: 600; color: #1f2937; }
.calNav { display: flex; gap: 4px; }

.navBtn {
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  color: #6b7280;
  font-size: 14px;
  line-height: 1;
  &:hover { background: #f3f4f6; }
}

.dayHeaders { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; }
.dayHeader { padding: 4px 0; font-size: 12px; color: #6b7280; }
.dayGrid { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; }
.dayCell { padding: 2px; cursor: pointer; }

.day {
  width: 32px;
  height: 32px;
  line-height: 32px;
  margin: auto;
  border-radius: 6px;
  font-size: 13px;
  color: #1f2937;
  transition: background 0.15s ease;
  &:hover { background: #f3f4f6; }
}

.dayOutside { color: #d1d5db; cursor: default; &:hover { background: transparent; } }
.dayDisabled { color: #d1d5db; cursor: not-allowed; &:hover { background: transparent; } }
.daySelected { background: #3b82f6 !important; color: white !important; font-weight: 600; }
.dayToday { border: 1px solid #3b82f6; font-weight: 600; }

// ─── Time panel (right side) ──────────────────────────────────────────────
.timePanel {
  width: 108px;
  flex-shrink: 0;
  border-left: 1px solid $color-border;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
}

.timeCols {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 2px;
}

.timeColWrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 2px;
}

.timeLabel {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 0;
}

.scrollBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  padding: 3px 0;
  border-radius: 4px;
  color: #9ca3af;
  &:hover { background: #e5e7eb; color: #374151; }
}

.timeCol {
  width: 100%;
  height: 128px;
  overflow-y: scroll;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.timeSep {
  font-size: 16px;
  font-weight: 700;
  color: #374151;
  flex-shrink: 0;
  user-select: none;
  padding-top: 52px; // offset past label + top button to align with scroll area center
}

.timeItem {
  height: 32px;
  line-height: 32px;
  text-align: center;
  font-size: 14px;
  color: #374151;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s ease;
  &:hover { background: #f3f4f6; }
}

.timeItemSelected {
  background: #3b82f6 !important;
  color: white !important;
  font-weight: 600;
}

.timeItemDisabled {
  color: #d1d5db;
  cursor: not-allowed;
  &:hover { background: transparent; }
}
</style>
