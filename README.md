# HR System — Web Admin Frontend

Web Admin dashboard cho hệ thống quản lý nhân sự (HR System). Dành cho các vai trò **Admin**, **HR**, và **Manager**.

Consume REST API từ repo `hr-system-api` tại `/v1/...`.

---

## Tech Stack

| Thành phần       | Công nghệ          | Phiên bản |
| ---------------- | ------------------ | --------- |
| Framework        | Nuxt               | 4.x       |
| Language         | TypeScript         | —         |
| Styling          | Tailwind CSS       | 3.x       |
| State Management | Pinia              | 3.x       |
| Form Validation  | vee-validate + zod | —         |
| Package Manager  | Yarn Classic       | 1.22.22   |
| Runtime          | Node.js            | 22.x      |

---

## Roles & Quyền truy cập

| Trang         | ADMIN | HR  | MANAGER  | EMPLOYEE |
| ------------- | ----- | --- | -------- | -------- |
| `/employees`  | ✓     | ✓   | —        | —        |
| `/attendance` | ✓     | ✓   | ✓ (team) | —        |
| `/leave`      | ✓     | ✓   | ✓ (team) | —        |
| `/reports`    | ✓     | ✓   | ✓ (team) | —        |
| `/payroll`    | ✓     | ✓   | —        | —        |
| `/settings`   | ✓     | —   | —        | —        |

---

## Cấu trúc dự án

```
app/
├── components/
│   ├── common/          # AppButton, AppInput, AppModal, AppTable...
│   └── modules/         # EmployeeCard, LeaveRequestForm, AttendanceTable...
├── composables/         # useAuth, useEmployee, useLeave...
├── layouts/
│   ├── default.vue      # Layout chính (sidebar + topbar)
│   └── auth.vue         # Layout trang login
├── middleware/
│   ├── auth.ts          # Redirect /login nếu chưa có token
│   └── role.ts          # Kiểm tra role, redirect nếu không đủ quyền
├── pages/               # File-based routing
├── services/            # API service layer
│   ├── http/            # Fetch factory + typed fetchers
│   └── *.service.ts
├── stores/              # Pinia stores
└── types/               # TypeScript interfaces
utils/                   # Pure utility functions (date-fns, format)
docs/                    # Tài liệu kỹ thuật
```

---

## Biến môi trường

Copy file `.env.example` thành `.env` và điền giá trị thực:

```bash
cp .env.example .env
```

| Biến                  | Mô tả                                | Bắt buộc |
| --------------------- | ------------------------------------ | -------- |
| `NUXT_PUBLIC_API_KEY` | API key gửi kèm mỗi request (header) | ✓        |
| `NUXT_BASE_API_URL`   | Base URL của backend API             | ✓        |

> **Quan trọng:** `NUXT_PUBLIC_API_KEY` được nhúng vào bundle lúc build. Phải điền đúng giá trị **trước khi** chạy `yarn build` hoặc `docker build`.

---

## Chạy Local (không Docker)

### Yêu cầu

- Node.js 22.x
- Yarn 1.22.22

```bash
corepack enable && corepack prepare yarn@1.22.22 --activate
```

### Các bước

```bash
# 1. Clone repo
git clone <repo-url>
cd hr-system-fe

# 2. Cài dependencies
yarn install

# 3. Cấu hình môi trường
cp .env.example .env
# Mở .env và điền đúng giá trị

# 4. Chạy dev server
yarn dev
```

Truy cập: **http://localhost:4000**

### Tất cả lệnh

```bash
yarn dev          # Dev server với hot-reload (port 4000)
yarn build        # Build production (SSR/Nitro)
yarn generate     # Build static files
yarn preview      # Preview production build
yarn typecheck    # Kiểm tra TypeScript
```

---

## Chạy Local với Docker

### Yêu cầu

- Docker Desktop (hoặc Docker Engine + Compose plugin)

### Build và chạy

```bash
# 1. Cấu hình môi trường
cp .env.example .env
# Mở .env và điền đúng giá trị

# 2. Build image và khởi động container
docker compose up --build

# Hoặc chạy nền (detached)
docker compose up --build -d
```

Truy cập: **http://localhost:4000**

### Quản lý container

```bash
docker compose logs -f          # Xem logs real-time
docker compose down             # Dừng và xóa container
docker compose up --build       # Rebuild sau khi thay đổi code
docker compose exec app sh      # Mở shell bên trong container
```

---

## Deploy lên Server với Docker

### Bước 1 — Build image

```bash
docker build -t hr-system-fe:latest .
```

### Bước 2a — Deploy qua SSH (không dùng registry)

Phù hợp khi chưa có Docker Registry.

```bash
# Export image ra file
docker save hr-system-fe:latest | gzip > hr-system-fe.tar.gz

# Copy lên server
scp hr-system-fe.tar.gz user@your-server:/deploy/path/
# Copy docker-compose và .env nếu chưa có trên server
scp docker-compose.yml .env user@your-server:/deploy/path/

# SSH vào server và khởi động
ssh user@your-server
cd /deploy/path
docker load < hr-system-fe.tar.gz
docker compose up -d
```

### Bước 2b — Deploy qua Docker Registry (khuyến nghị)

```bash
# Tag và push
docker build -t registry.example.com/hr-system-fe:latest .
docker push registry.example.com/hr-system-fe:latest

# Trên server: pull và restart
ssh user@your-server
cd /deploy/path
docker compose pull
docker compose up -d
```

### Cấu trúc thư mục trên server

```
/deploy/path/
├── docker-compose.yml    # Copy từ repo
└── .env                  # Tạo thủ công — KHÔNG commit lên git
```

### Cập nhật phiên bản mới

```bash
# Build và push image mới
docker build -t registry.example.com/hr-system-fe:latest .
docker push registry.example.com/hr-system-fe:latest

# SSH vào server và pull image mới
ssh user@your-server "cd /deploy/path && docker compose pull && docker compose up -d"
```

## CI/CD — Bitbucket Pipelines

Pipeline tự động deploy khi push lên:

| Branch    | Environment | Hành động                                       |
| --------- | ----------- | ----------------------------------------------- |
| `develop` | Dev/Staging | SSH → git pull → `yarn generate` (static build) |
| `staging` | Staging     | SSH → git pull → `yarn generate` (static build) |

### Biến cần cấu hình trong Bitbucket

Vào **Repository Settings → Repository variables**:

| Biến              | Mô tả                                 |
| ----------------- | ------------------------------------- |
| `DEPLOY_USER`     | SSH username trên server              |
| `DEPLOY_HOST`     | IP hoặc hostname của server           |
| `DEPLOY_PATH`     | Đường dẫn deploy cho branch `develop` |
| `DEPLOY_STG_PATH` | Đường dẫn deploy cho branch `staging` |

---

## Dockerfile — Cách hoạt động

Multi-stage build, image production không chứa `node_modules`:

| Stage     | Việc làm                                         |
| --------- | ------------------------------------------------ |
| `deps`    | Cài Yarn + chạy `yarn install --frozen-lockfile` |
| `builder` | Copy deps + source code, chạy `yarn build`       |
| `runner`  | Chỉ copy `.output/` (Nitro standalone output)    |

Server production khởi động bằng Nitro:

```
node .output/server/index.mjs
```

Port mặc định `4000`, điều chỉnh qua env var `PORT`.

---

## Tài liệu kỹ thuật

| Tài liệu                                                               | Nội dung                             |
| ---------------------------------------------------------------------- | ------------------------------------ |
| [docs/conventions.md](docs/conventions.md)                             | Naming conventions, Tailwind, Pinia  |
| [docs/architecture.md](docs/architecture.md)                           | Data flow, HTTP layer                |
| [docs/api.md](docs/api.md)                                             | Service layer, cách viết service mới |
| [docs/components.md](docs/components.md)                               | Component patterns, composables      |
| [docs/forms.md](docs/forms.md)                                         | Form validation, toast notifications |
| [docs/review.md](docs/review.md)                                       | Code review checklist                |
| [docs/api-enpoint.json](docs/api-enpoint.json)                         | file json chứa các apis endpoint     |
| [docs/frontend/nuxt-conventions.md](docs/frontend/nuxt-conventions.md) | Nuxt 4 conventions chi tiết          |
