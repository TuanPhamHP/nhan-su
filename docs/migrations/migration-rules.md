# Database — Migration Rules

## Nguyên tắc tuyệt đối

> **KHÔNG BAO GIỜ** sửa trực tiếp database bằng SQL thủ công, `prisma db push`, hay bất kỳ cách nào ghi đè schema mà không tạo migration file.

Mọi thay đổi schema **bắt buộc** đi qua migration file được version control.

---

## Workflow bắt buộc

### Khi thay đổi schema

```
1. Sửa prisma/schema.prisma
       ↓
2. Tạo migration file
   npx prisma migrate dev --name <tên_mô_tả>
       ↓
3. Kiểm tra file migration được tạo trong
   prisma/migrations/<timestamp>_<tên>/migration.sql
       ↓
4. Commit CẢ HAI: schema.prisma + file migration
       ↓
5. Các môi trường khác (staging, prod) chạy:
   npx prisma migrate deploy
```

### Tên migration — đặt rõ ràng, mô tả đúng thay đổi

```bash
# ✅ ĐÚNG — tên mô tả rõ thay đổi
npx prisma migrate dev --name add_avatar_url_to_employees
npx prisma migrate dev --name create_ip_whitelist_table
npx prisma migrate dev --name add_status_index_to_leave_requests
npx prisma migrate dev --name alter_payroll_add_bonus_column

# ❌ SAI — tên không có nghĩa
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
npx prisma migrate dev --name changes
npx prisma migrate dev --name migration1
```

---

## Các lệnh Prisma — Dùng đúng lệnh đúng môi trường

| Lệnh                               | Dùng khi nào                                           | Môi trường                          |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------- |
| `prisma migrate dev --name <name>` | Phát triển tính năng mới, tạo migration                | **Development only**                |
| `prisma migrate deploy`            | Apply các migration đã có vào DB                       | **Staging, Production**             |
| `prisma migrate status`            | Kiểm tra migration nào chưa được apply                 | Tất cả                              |
| `prisma migrate reset`             | Reset DB + chạy lại tất cả migration                   | **Development only — xóa hết data** |
| `prisma db pull`                   | Sync schema từ DB hiện có (chỉ dùng khi onboard DB cũ) | Một lần duy nhất                    |
| `prisma generate`                  | Regenerate Prisma Client sau khi sửa schema            | Tất cả                              |

### Lệnh bị cấm trong staging/production

```bash
# ❌ TUYỆT ĐỐI KHÔNG chạy trong staging/prod
prisma migrate dev        # tạo migration mới + có thể reset data
prisma migrate reset      # XÓA TOÀN BỘ DATA
prisma db push            # ghi đè schema trực tiếp, không tạo migration file
prisma db push --force-reset  # XÓA TOÀN BỘ DATA
```

---

## Cấu trúc thư mục migrations

```
prisma/
├── schema.prisma
└── migrations/
    ├── 20250101000000_init/
    │   └── migration.sql
    ├── 20250115083000_add_avatar_url_to_employees/
    │   └── migration.sql
    ├── 20250120141500_create_ip_whitelist_table/
    │   └── migration.sql
    └── migration_lock.toml          ← KHÔNG sửa file này thủ công
```

**Quy tắc với thư mục migrations:**

- Không sửa file `migration.sql` đã được commit
- Không xóa thư mục migration cũ
- Không đổi tên thư mục migration
- `migration_lock.toml` do Prisma quản lý — không chỉnh tay

---

## Khi cần sửa migration đã tạo (chưa commit)

Nếu phát hiện lỗi trong migration **chưa được commit và chưa deploy**:

```bash
# 1. Revert migration trên local DB
npx prisma migrate reset   # chỉ dùng trên dev, sẽ xóa data dev

# 2. Sửa schema.prisma

# 3. Tạo lại migration với tên mới
npx prisma migrate dev --name <tên_đúng>
```

Nếu migration **đã được commit hoặc đã deploy** → **không sửa**, tạo migration mới để fix:

```bash
# ✅ ĐÚNG — tạo migration mới để rollback/fix
npx prisma migrate dev --name revert_incorrect_column_type_in_employees
```

---

## Quy trình triển khai (CI/CD)

### Dockerfile / deploy script — production

```bash
# Chạy migration trước khi start app
npx prisma migrate deploy
npx prisma generate
node dist/main.js
```

### GitHub Actions example

```yaml
- name: Run database migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Start application
  run: node dist/main.js
```

**Thứ tự bắt buộc:** `migrate deploy` → `generate` → start app. Không đổi thứ tự.

---

## Seed data

Seed chỉ dùng để khởi tạo data mặc định (loại phép, ngày lễ, role mặc định). Không dùng seed để thay thế migration.

```typescript
// prisma/seed.ts
async function main() {
  // Dùng upsert — idempotent, chạy nhiều lần không bị lỗi
  await prisma.leaveType.upsert({
    where: { code: 'ANNUAL' },
    update: {},
    create: {
      name: 'Phép năm',
      code: 'ANNUAL',
      daysPerYear: 12,
      isPaid: true,
    },
  });
}
```

```bash
# Chạy seed
npx prisma db seed
```

---

## Checklist trước khi commit thay đổi schema

- [ ] Đã chạy `prisma migrate dev --name <tên_rõ_ràng>`
- [ ] File migration được tạo trong `prisma/migrations/`
- [ ] Tên migration mô tả đúng thay đổi
- [ ] Đã chạy `prisma generate` để update Prisma Client
- [ ] Commit bao gồm: `schema.prisma` + thư mục migration mới
- [ ] **Không** có file `migration.sql` nào bị sửa thủ công
- [ ] **Không** dùng `prisma db push`

---

## Tình huống thường gặp

### Thêm column mới

```prisma
// schema.prisma
model Employee {
  // ... existing fields
  nickName String? @db.VarChar(50)  // thêm mới
}
```

```bash
npx prisma migrate dev --name add_nickname_to_employees
```

### Thêm index

```prisma
model AttendanceRecord {
  // ...
  @@index([employeeId, date])   // thêm index
}
```

```bash
npx prisma migrate dev --name add_index_attendance_employee_date
```

### Đổi tên column — KHÔNG làm trực tiếp, Prisma sẽ drop + recreate

```prisma
// Thay vì đổi tên trực tiếp, dùng @map để giữ tên cột trong DB
model Employee {
  fullName String @map("full_name")  // tên trong code vs tên trong DB
}
```

Nếu **bắt buộc** phải đổi tên cột trong DB, sửa thủ công file `migration.sql` trước khi apply (và ghi chú rõ lý do trong commit message).

### Xóa column — Cẩn thận với data production

```bash
# 1. Deploy code không còn dùng column đó trước
# 2. Sau khi đã deploy xong và verify
# 3. Mới xóa column khỏi schema và tạo migration
npx prisma migrate dev --name remove_deprecated_old_column_from_employees
```
