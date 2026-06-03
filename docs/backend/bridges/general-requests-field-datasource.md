# Backend Spec — FieldDefinition.dataSource

## Bối cảnh

Frontend đã thêm trường `dataSource` vào `FieldDefinition` để hỗ trợ hai loại select:

1. **Tùy chỉnh (`custom`)** — HR/Admin nhập tay options khi tạo template (hành vi hiện tại)
2. **Từ hệ thống** — frontend tự fetch data live từ API, không cần lưu options trong template

---

## Thay đổi TypeScript type

```typescript
// Thêm vào types/general-request.types.ts (hoặc tương đương phía backend)
export type FieldDataSource = 'custom' | 'departments' | 'employees' | 'positions';

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  dataSource?: FieldDataSource; // MỚI — chỉ có nghĩa khi type === 'select'
}
```

---

## Yêu cầu backend

### 1. Lưu trữ `dataSource` trong JSON

`FieldDefinition` hiện được lưu dưới dạng JSON column trong bảng `document_template` (field `fields`).

**Không cần migration** — chỉ cần đảm bảo Prisma/TypeORM không strip unknown keys khi validate/transform.

Nếu đang dùng class-transformer hoặc zod schema để validate `fields[]` trước khi lưu:

```typescript
// Cập nhật DTO validation để accept dataSource
class FieldDefinitionDto {
  // ... existing fields ...
  
  @IsOptional()
  @IsIn(['custom', 'departments', 'employees', 'positions'])
  dataSource?: 'custom' | 'departments' | 'employees' | 'positions';
}
```

### 2. Trả về `dataSource` trong response

Khi trả về `DocumentTemplateDetail` (cả `GET /templates` và `GET /templates/:id`), phải include `dataSource` trong từng `FieldDefinition`.

```json
// GET /v1/general-requests/templates/:id — response
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Kế hoạch công tác",
    "fields": [
      {
        "key": "phong_ban",
        "label": "Phòng ban",
        "type": "select",
        "required": true,
        "dataSource": "departments"   // ← phải có trong response
      },
      {
        "key": "trang_thai",
        "label": "Trạng thái",
        "type": "select",
        "required": false,
        "options": ["Đang tiến hành", "Hoàn thành"],
        "dataSource": "custom"         // ← hoặc undefined cũng được
      }
    ]
  }
}
```

### 3. Validation khi submit đơn

Khi user nộp đơn (`PATCH /:id/submit`), server validate `required` fields trong `fieldValues`.

Với field có `dataSource !== 'custom'`, server **không cần** validate xem value có nằm trong options hay không — việc giới hạn choices đã do frontend dropdown đảm nhận.

**Chỉ cần validate:** field `required === true` phải có giá trị không rỗng trong `fieldValues`.

---

## Luồng hoạt động

```
HR tạo template với field type=select, dataSource=departments
    ↓
Frontend lưu FieldDefinition { type: 'select', dataSource: 'departments' } vào DB
    ↓
Employee mở form điền → frontend gọi GET /v1/departments → render <select> với danh sách phòng ban
    ↓
Employee chọn "Phòng Kỹ thuật" → fieldValues = { phong_ban: "Phòng Kỹ thuật" }
    ↓
Submit → fieldValues được lưu vào đơn như bình thường
    ↓
In → printTemplate merge: {{phong_ban}} → "Phòng Kỹ thuật"
```

---

## Các API phụ trợ (đã có, cần verify response shape)

Frontend gọi những endpoint sau khi rendering form có `dataSource`:

| dataSource | Endpoint | Lấy field |
|------------|----------|-----------|
| `departments` | `GET /v1/departments?limit=200` | `name` làm option value |
| `positions` | `GET /v1/positions?limit=200` | `name` làm option value |
| `employees` | `GET /v1/employees?status=ACTIVE&limit=200` | `fullName` làm option value |

Những endpoint này đã tồn tại. Chỉ cần đảm bảo response shape là `PaginatedResponse<{ id, name }>` (departments/positions) và `PaginatedResponse<{ id, fullName, ... }>` (employees) — đúng như hiện tại.

---

## Checklist backend

- [ ] `FieldDefinitionDto` accept `dataSource?: 'custom' | 'departments' | 'employees' | 'positions'`
- [ ] Không strip `dataSource` khi lưu JSON vào DB
- [ ] `dataSource` được include trong response của `GET /templates` và `GET /templates/:id`
- [ ] Validation khi submit: chỉ check `required` — không check value against options list
- [ ] `GET /v1/departments?limit=200` trả về `PaginatedResponse<{ id, name }>` — verify không bị 403 với token thường
- [ ] `GET /v1/positions?limit=200` trả về `PaginatedResponse<{ id, name }>` — tương tự
