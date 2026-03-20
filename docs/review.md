# Code Review Checklist

Dùng cho 2 mục đích:

1. **Self-review**: Claude Code chạy checklist này trước khi kết thúc mỗi task
2. **PR review**: Dev hoặc Claude Code review code của người khác

---

## TypeScript & Type Safety

- [ ] Không có `any` — dùng `unknown` hoặc type cụ thể
- [ ] Import type dùng `import type { }` riêng
- [ ] Props được typed đầy đủ qua `defineProps<{}>()`
- [ ] Emits được typed đầy đủ qua `defineEmits<{}>()`
- [ ] Return type của service methods được khai báo rõ: `Promise<BookingResponse>`
- [ ] Không dùng non-null assertion (`!`) bừa bãi — xử lý null/undefined rõ ràng

## Convention Vi Phạm

- [ ] Dùng `<script setup lang="ts">` — không có `defineComponent`, không có Options API
- [ ] Không có `<style scoped>` trừ `:deep()` override hoặc `@keyframes`
- [ ] Không có `$fetch` / `fetch` trực tiếp trong component, composable, store
- [ ] Mọi API call đi qua `services/` layer
- [ ] Service mới đã được re-export trong `services/index.ts`
- [ ] Store dùng Setup Store — không có `state: () => ({})`
- [ ] Destructure store dùng `storeToRefs()` cho state/getters

## Data Flow

- [ ] Page không chứa business logic — chỉ layout + gọi composable/store
- [ ] Component nhận data qua props — không gọi service trực tiếp
- [ ] Toast/notification gọi ở component hoặc composable — không trong store
- [ ] `useAsyncData` key đúng format: `'domain-action'` hoặc `` `domain-action-${id}` ``

## Forms

- [ ] Form có validation dùng `vee-validate` — không validate thủ công bằng `ref`
- [ ] `isSubmitting` từ `useForm` — không dùng `ref` riêng để track loading state của form
- [ ] Error message từ API được unwrap: `error instanceof Error ? error.message : 'fallback'`

## Performance

- [ ] `v-for` luôn có `:key` với unique id — không dùng index làm key khi list có thể reorder
- [ ] Derived data dùng `computed()` — không dùng method gọi trong template
- [ ] Không có `watch` không cần thiết — ưu tiên `computed` hoặc event-driven
- [ ] Component lớn (> ~150 dòng script) đã được tách logic vào composable chưa

## Logic & Bug Tiềm Ẩn

- [ ] Async actions có `try/catch` — không để unhandled promise rejection
- [ ] Loading state được reset trong `finally` — không bị kẹt `loading = true`
- [ ] Không có reactive state khai báo ngoài composable function (gây shared state bug)
- [ ] `onMounted` / `window` / `document` được guard bằng `import.meta.client` nếu SSR

---

## Cách dùng khi PR Review

Khi được yêu cầu review một file hoặc PR, Claude Code sẽ:

1. Chạy qua từng mục trong checklist trên
2. Báo cáo theo format:

```
## Review: BookingForm.vue

### ❌ Cần sửa
- [Convention] Dùng `<style scoped>` cho styles có thể viết bằng Tailwind (line 45-52)
- [TypeScript] Props `onSubmit` thiếu type, đang là `any` ngầm (line 8)

### ⚠️ Nên cải thiện
- [Performance] `filteredList` là method nhưng gọi trong template — nên đổi sang computed

### ✅ Tốt
- Data flow đúng, không gọi service trực tiếp trong component
- vee-validate được dùng đúng pattern
```
