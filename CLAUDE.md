# xc-booking

Trang đăng ký dịch vụ logistics cho khách hàng.

## Tech Stack

- **Framework:** Nuxt 4
- **Language:** TypeScript
- **Styling:** Tailwind CSS — @docs/conventions.md#tailwind
- **State Management:** Pinia
- **Package Manager:** Yarn

## Project Structure

```
app/
├── assets/          # Static assets (images, fonts, global CSS)
├── components/      # Vue components (auto-imported)
├── composables/     # Composable functions (auto-imported)
├── layouts/         # Page layouts
├── middleware/      # Route middleware
├── pages/           # File-based routing
├── plugins/         # Nuxt plugins
├── services/        # API service layer
│   ├── http/        # HTTP client layer (fetch factory, typed fetchers)
│   │   ├── fetch.factory.ts   # Base fetch wrapper
│   │   ├── apikey.fetch.ts    # Fetch with API key auth
│   │   ├── auth.fetch.ts      # Fetch with Bearer token auth
│   │   ├── public.fetch.ts    # Unauthenticated fetch
│   │   └── types.ts           # Shared HTTP types
│   ├── auth.service.ts        # Auth API calls
│   ├── user.service.ts        # User API calls
│   ├── example.service.ts     # Example/reference service — đọc trước khi tạo service mới
│   └── index.ts               # Re-exports all services
└── stores/          # Pinia stores
    └── auth.ts      # Auth state
utils/               # Pure utility functions (non-Vue)
docs/                # Project documentation
```

## Environment Variables

```env
NUXT_PUBLIC_API_KEY=     # API key gửi kèm mỗi request
NUXT_BASE_API_URL=       # Base URL của REST API external
```

Truy cập trong code:

- `useRuntimeConfig().public.apiKey`
- `useRuntimeConfig().baseApiUrl` (server-only)

## Common Commands

```bash
yarn dev          # Start dev server
yarn build        # Build for production
yarn preview      # Preview production build
yarn typecheck    # Run TypeScript check
```

## Non-Negotiable Rules

Những rule này LUÔN áp dụng, không có ngoại lệ:

### Vue / Nuxt

- Luôn dùng `<script setup lang="ts">` — không dùng Options API, không dùng `defineComponent`
- Import type riêng: `import type { Foo } from '...'`
- Không dùng `any` — dùng `unknown` nếu chưa rõ type

### API & Services

- Không gọi `$fetch` / `fetch` trực tiếp trong component, composable, store
- Mọi API call đi qua `app/services/` — xem `example.service.ts` để hiểu pattern
- Service mới phải được re-export trong `services/index.ts`

### Styling

- **Tailwind CSS là mặc định** — dùng utility classes cho mọi styling
- **Không dùng `<style scoped>`** trừ 2 trường hợp duy nhất:
  1. Override style của third-party component với `:deep()`
  2. CSS animation phức tạp không có sẵn trong Tailwind (ví dụ: `@keyframes shimmer`)
- Khi muốn viết scoped CSS → dừng lại, thử viết bằng Tailwind trước

### Pinia Store

- Luôn dùng Setup Store — không dùng Options Store (`state: () => ({})`)
- Dùng `storeToRefs()` khi destructure state/getters
- Store chỉ chứa state + actions gọi service — không chứa UI logic

### Data Flow

- Logic tái sử dụng → composable; shared state → store

### Forms

- Dùng vee-validate cho mọi form có validation — không tự viết validation logic
- Xem pattern: @docs/forms.md

### Toast / Notifications

- Dùng useToast() để hiển thị thông báo — không dùng alert()
- Gọi toast ở component/composable sau action, không gọi trong store
- Xem pattern: @docs/forms.md#toast

### Before Finishing Any Task

- Trước khi kết thúc task, LUÔN tự chạy review theo @docs/review.md:

- Nếu phát hiện vi phạm → tự sửa, không hỏi Nếu có trade-off cần quyết định → báo cáo rõ lý do giữ nguyên

## Documentation

- Conventions & naming: @docs/conventions.md
- Architecture & data flow: @docs/architecture.md
- API service layer: @docs/api.md
- Component patterns: @docs/components.md
- Forms & notifications: @docs/forms.md
- Code review checklist: @docs/review.md
