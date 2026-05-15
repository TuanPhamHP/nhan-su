# Backend — Coding Rules

Các quy tắc này là **bắt buộc** cho toàn bộ backend. Mọi PR vi phạm sẽ bị reject.

---

## 1. Đặt tên

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| File | `kebab-case` | `employee.service.ts` |
| Class | `PascalCase` | `EmployeeService` |
| Function/method | `camelCase` | `findEmployeeById()` |
| Variable | `camelCase` | `totalDays` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_LOGIN_ATTEMPTS` |
| Interface | `PascalCase`, không prefix `I` | `EmployeeFilter` |
| Type | `PascalCase` | `PaginatedResult<T>` |
| Enum | `PascalCase`, values `UPPER_SNAKE` | `LeaveStatus.PENDING` |
| DTO | suffix `Dto` | `CreateLeaveRequestDto` |
| Transformer | suffix `Transformer`, function `toXxx` | `toEmployeeResponse()` |
| Repository | suffix `Repository` | `EmployeeRepository` |

---

## 2. File placement — Đặt file đúng chỗ

```
Câu hỏi khi tạo function mới:
  ├─ Có side effects? (DB, email, queue)
  │    ├─ Liên quan nhiều bảng / nghiệp vụ phức tạp → Service
  │    └─ Chỉ query/write 1 entity → Repository
  │
  └─ Không có side effects? (tính toán, format, validate)
       ├─ Dùng ở nhiều module → common/utils/
       └─ Chỉ dùng trong 1 module → đặt trong utils/ của module đó (nếu có)
```

**Ví dụ thực tế:**

```
calculateWorkingDays()     → common/utils/date.utils.ts        ✅ pure, tái sử dụng
formatCurrency()           → common/utils/number.utils.ts      ✅ pure, tái sử dụng
buildPaginationMeta()      → common/utils/pagination.utils.ts  ✅ pure, tái sử dụng

findEmployeeById()         → employee.repository.ts            ✅ Prisma query
createAttendanceRecord()   → attendance.repository.ts          ✅ Prisma write

validateLeaveBalance()     → leave.service.ts                  ✅ business logic
sendLeaveNotification()    → notification.service.ts           ✅ side effect (email)
calculatePayroll()         → payroll.service.ts                ✅ business logic
```

---

## 3. Async/Await — Bắt buộc

```typescript
// ✅ ĐÚNG
const employee = await this.employeeRepository.findById(id);

// ❌ SAI — không dùng .then()
this.employeeRepository.findById(id).then(employee => { ... });
```

---

## 4. Error handling

Dùng NestJS built-in exceptions — **không throw Error thuần**:

```typescript
import {
  BadRequestException,    // 400 — input không hợp lệ về nghiệp vụ
  UnauthorizedException,  // 401 — chưa xác thực
  ForbiddenException,     // 403 — không đủ quyền
  NotFoundException,      // 404 — không tìm thấy resource
  ConflictException,      // 409 — trùng dữ liệu
} from '@nestjs/common';

// ✅ ĐÚNG — throw với message rõ ràng bằng tiếng Anh (log) hoặc tiếng Việt (user-facing)
if (!employee) throw new NotFoundException('Employee not found');
if (overlap) throw new ConflictException('Leave request overlaps with existing one');

// ❌ SAI
throw new Error('something went wrong');
if (!employee) return null; // im lặng khi không tìm thấy
```

---

## 5. Validation — Bắt buộc dùng class-validator trong DTO

```typescript
// ✅ ĐÚNG
import { IsString, IsEmail, IsDateString, IsUUID, IsOptional, IsEnum } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEmail()
  email: string;

  @IsDateString()
  joinDate: string;

  @IsUUID()
  departmentId: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  phone?: string;
}

// ❌ SAI — không validate thủ công trong controller hay service
if (!dto.email || !dto.email.includes('@')) throw new BadRequestException(...);
```

---

## 6. Không leak Prisma type ra ngoài Controller

```typescript
// ✅ ĐÚNG — Service trả về, Controller transform rồi trả client
@Get(':id')
async findOne(@Param('id') id: string) {
  const employee = await this.employeeService.findById(id);
  return toEmployeeResponse(employee); // transformer ở đây
}

// ❌ SAI — trả thẳng Prisma object ra client
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.employeeService.findById(id); // lộ password_hash, internal fields
}
```

---

## 7. Không hardcode — dùng config

```typescript
// ✅ ĐÚNG
@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  private getJwtSecret() {
    return this.configService.getOrThrow<string>('JWT_SECRET');
  }
}

// ❌ SAI
const token = jwt.sign(payload, 'my-secret-key'); // hardcode
```

---

## 8. Prisma — Query rules

```typescript
// ✅ Select chỉ fields cần thiết — tránh over-fetching
const employee = await this.prisma.employee.findUnique({
  where: { id },
  select: {
    id: true,
    fullName: true,
    email: true,
    department: { select: { id: true, name: true } },
    // KHÔNG select passwordHash ở đây nếu không cần
  },
});

// ✅ Luôn dùng transaction khi write nhiều bảng
const [leave, _balance] = await this.prisma.$transaction([
  this.prisma.leaveRequest.create({ data: leaveData }),
  this.prisma.leaveBalance.update({ where: { id: balanceId }, data: { usedDays: { increment: totalDays } } }),
]);

// ❌ SAI — write nhiều bảng không dùng transaction
await this.prisma.leaveRequest.create(...);
await this.prisma.leaveBalance.update(...); // nếu cái này fail → data corrupt
```

---

## 9. Import order (ESLint enforce)

```typescript
// 1. NestJS / Node built-ins
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 2. Third-party
import { hash, compare } from 'bcrypt';

// 3. Internal — absolute (common/)
import { buildPaginationMeta } from '@common/utils/pagination.utils';
import { PrismaService } from '@prisma/prisma.service';

// 4. Internal — relative (cùng module)
import { EmployeeRepository } from './employee.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { toEmployeeResponse } from './transformers/employee.transformer';
```

---

## 10. Không comment code thừa

```typescript
// ❌ SAI — comment giải thích code hiển nhiên
// Get employee by id
const employee = await this.employeeRepository.findById(id);

// ✅ ĐÚNG — comment khi logic không hiển nhiên
// Trừ thêm 1 ngày vì endDate inclusive nhưng Prisma lte là exclusive
const adjustedEnd = subDays(endDate, 1);
```
