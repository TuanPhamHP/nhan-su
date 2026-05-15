# Backend — Transformer & DTO Rules

## Nguyên tắc cốt lõi

```
Prisma Model  →  Repository  →  Service  →  Controller  →  Transformer  →  HTTP Response
     ↑                                            ↑
  raw DB type                             transform tại đây
  (không ra ngoài)                        KHÔNG ở Service hay Repository
```

- **DTO**: định nghĩa shape của INPUT (request body, query params)
- **Transformer**: định nghĩa shape của OUTPUT (response trả về client)
- **Tuyệt đối không** trả raw Prisma object ra client
- **Transformer là pure functions** — không async, không inject dependency

---

## Cấu trúc file mỗi module

```
modules/employee/
├── dto/
│   ├── create-employee.dto.ts      ← POST body
│   ├── update-employee.dto.ts      ← PATCH body
│   └── query-employee.dto.ts       ← GET query params
└── transformers/
    └── employee.transformer.ts     ← tất cả output shapes của module này
```

---

## DTO — Input Validation

### Quy tắc đặt tên DTO

| Loại | Tên file | Class name |
|------|----------|-----------|
| POST body | `create-{entity}.dto.ts` | `Create{Entity}Dto` |
| PATCH body | `update-{entity}.dto.ts` | `Update{Entity}Dto` |
| Query params | `query-{entity}.dto.ts` | `Query{Entity}Dto` |

### Chuẩn DTO

```typescript
// dto/create-employee.dto.ts
import {
  IsString, IsEmail, IsDateString, IsUUID,
  IsOptional, IsEnum, MinLength, MaxLength, IsMobilePhone,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsDateString()
  joinDate: string;

  @IsUUID()
  departmentId: string;

  @IsUUID()
  positionId: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsMobilePhone('vi-VN')
  phone?: string;
}
```

```typescript
// dto/update-employee.dto.ts — dùng PartialType để tất cả fields đều optional
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateEmployeeDto } from './create-employee.dto';

export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['email'] as const), // email không cho sửa
) {}
```

```typescript
// dto/query-employee.dto.ts — pagination + filter
import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EmployeeStatus } from '@prisma/client';

export class QueryEmployeeDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

---

## Transformer — Output Serialization

### Quy tắc transformer

1. **Pure functions** — `export function toXxx(raw): XxxResponse`
2. **Tên hàm** bắt đầu bằng `to` + tên response type
3. **Luôn định nghĩa return type** rõ ràng
4. **Strip** các fields nhạy cảm: `passwordHash`, `refreshToken`, `tokenExpiresAt`
5. **Không async** — nếu cần fetch thêm data thì làm trong Service trước

```typescript
// transformers/employee.transformer.ts

import { Employee, Department, Position } from '@prisma/client';

// --- Response types ---
export interface EmployeeResponse {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  joinDate: string;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  createdAt: string;
}

export interface EmployeeSummaryResponse {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string | null;
  status: string;
}

// --- Transformer functions ---

type EmployeeWithRelations = Employee & {
  department?: Department | null;
  position?: Position | null;
};

export function toEmployeeResponse(employee: EmployeeWithRelations): EmployeeResponse {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone,
    role: employee.role,
    status: employee.status,
    joinDate: employee.joinDate.toISOString().split('T')[0],
    department: employee.department
      ? { id: employee.department.id, name: employee.department.name }
      : null,
    position: employee.position
      ? { id: employee.position.id, name: employee.position.name }
      : null,
    createdAt: employee.createdAt.toISOString(),
    // passwordHash, refreshToken → KHÔNG có ở đây
  };
}

export function toEmployeeSummaryResponse(employee: EmployeeWithRelations): EmployeeSummaryResponse {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department?.name ?? null,
    status: employee.status,
  };
}
```

---

## Response Wrapper — ApiResponse

Mọi API đều trả về chuẩn này, áp dụng qua `ResponseInterceptor`:

### Single item
```json
{
  "success": true,
  "data": { "id": "...", "fullName": "..." }
}
```

### Paginated list
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "LEAVE_OVERLAP",
    "message": "Đã có đơn nghỉ phép trong khoảng thời gian này"
  }
}
```

### ResponseInterceptor

```typescript
// common/interceptors/response.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        ...(data?.data !== undefined ? data : { data }), // hỗ trợ cả { data, meta }
      })),
    );
  }
}
```

### Cách dùng trong Controller

```typescript
// ✅ Single item
@Get(':id')
async findOne(@Param('id') id: string) {
  const employee = await this.employeeService.findById(id);
  return toEmployeeResponse(employee);
  // → { success: true, data: { id, fullName, ... } }
}

// ✅ Paginated list
@Get()
async findAll(@Query() query: QueryEmployeeDto) {
  const { items, total } = await this.employeeService.findMany(query);
  return {
    data: items.map(toEmployeeSummaryResponse),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
  // → { success: true, data: [...], meta: { page, limit, total, totalPages } }
}
```

---

## Ví dụ đầy đủ — Leave module

```typescript
// leave/transformers/leave.transformer.ts

import { LeaveRequest, Employee, LeaveType } from '@prisma/client';

export interface LeaveRequestResponse {
  id: string;
  employee: { id: string; fullName: string; employeeCode: string };
  leaveType: { id: string; name: string; code: string };
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  approvedBy: { id: string; fullName: string } | null;
  approvedAt: string | null;
  rejectNote: string | null;
  createdAt: string;
}

type LeaveRequestWithRelations = LeaveRequest & {
  employee: Pick<Employee, 'id' | 'fullName' | 'employeeCode'>;
  leaveType: Pick<LeaveType, 'id' | 'name' | 'code'>;
  approvedByEmployee?: Pick<Employee, 'id' | 'fullName'> | null;
};

export function toLeaveRequestResponse(leave: LeaveRequestWithRelations): LeaveRequestResponse {
  return {
    id: leave.id,
    employee: {
      id: leave.employee.id,
      fullName: leave.employee.fullName,
      employeeCode: leave.employee.employeeCode,
    },
    leaveType: {
      id: leave.leaveType.id,
      name: leave.leaveType.name,
      code: leave.leaveType.code,
    },
    startDate: leave.startDate.toISOString().split('T')[0],
    endDate: leave.endDate.toISOString().split('T')[0],
    totalDays: Number(leave.totalDays),
    reason: leave.reason,
    status: leave.status,
    approvedBy: leave.approvedByEmployee
      ? { id: leave.approvedByEmployee.id, fullName: leave.approvedByEmployee.fullName }
      : null,
    approvedAt: leave.approvedAt?.toISOString() ?? null,
    rejectNote: leave.rejectNote,
    createdAt: leave.createdAt.toISOString(),
  };
}
```
