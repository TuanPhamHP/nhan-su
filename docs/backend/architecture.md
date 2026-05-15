# Backend — Architecture

## Layer Architecture

Mọi request đi qua đúng 3 tầng, không được bỏ qua hay đảo thứ tự:

```
HTTP Request
  └─► Controller        ← validate input (DTO), gọi Service, trả về transformed response
        └─► Service      ← business logic, orchestration, gọi Repository
              └─► Repository  ← tất cả Prisma queries, không có logic nghiệp vụ
```

**Quy tắc cứng:**
- Controller không được gọi Prisma trực tiếp
- Repository không được chứa business logic
- Service không được import `PrismaService` trực tiếp — phải qua Repository
- Transformer chỉ được gọi trong Controller (sau khi nhận kết quả từ Service)

---

## Project Structure

```
src/
├── main.ts
├── app.module.ts
│
├── common/                          ← Dùng chung toàn hệ thống
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/
│   │   ├── response.interceptor.ts  ← Wrap tất cả response về chuẩn ApiResponse
│   │   └── logging.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   └── utils/                       ← Pure functions, tái sử dụng
│       ├── date.utils.ts
│       ├── pagination.utils.ts
│       └── string.utils.ts
│
├── prisma/
│   ├── prisma.service.ts
│   └── prisma.module.ts
│
└── modules/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── auth.repository.ts
    │   ├── dto/
    │   │   ├── login.dto.ts
    │   │   └── change-password.dto.ts
    │   └── transformers/
    │       └── auth.transformer.ts
    │
    ├── employee/
    │   ├── employee.module.ts
    │   ├── employee.controller.ts
    │   ├── employee.service.ts
    │   ├── employee.repository.ts
    │   ├── dto/
    │   │   ├── create-employee.dto.ts
    │   │   ├── update-employee.dto.ts
    │   │   └── query-employee.dto.ts
    │   └── transformers/
    │       └── employee.transformer.ts
    │
    ├── attendance/         ← cấu trúc tương tự
    ├── leave/
    ├── notification/
    ├── report/
    ├── payroll/
    └── system/
```

---

## Phân loại rõ: Utils vs Service vs Repository

### Utils (`common/utils/`)
- **Pure functions** — không có side effects, không inject dependency
- **Tái sử dụng** được ở bất kỳ module nào
- **Không** gọi Prisma, không gọi service khác
- Test bằng unit test thuần, không cần mock

```typescript
// ✅ ĐÚNG — pure function, tái sử dụng
// common/utils/date.utils.ts
export function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let days = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) days++;
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function isLate(checkInAt: Date, shiftStart: Date, thresholdMinutes: number): boolean {
  const diff = differenceInMinutes(checkInAt, shiftStart);
  return diff > thresholdMinutes;
}

// ❌ SAI — không được inject dependency trong utils
export class DateUtils {
  constructor(private readonly configService: ConfigService) {} // KHÔNG LÀM THẾ NÀY
}
```

### Repository (`*.repository.ts`)
- **Class**, inject `PrismaService`
- **Chỉ** chứa Prisma queries — `findMany`, `create`, `update`, `delete`
- **Không** chứa business logic, không tính toán, không gọi service khác
- Trả về raw Prisma type, **không transform**

```typescript
// ✅ ĐÚNG
@Injectable()
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.employee.findUnique({
      where: { id },
      include: { department: true, position: true },
    });
  }

  async findMany(params: { page: number; limit: number; departmentId?: string }) {
    const { page, limit, departmentId } = params;
    const where = departmentId ? { departmentId } : {};
    return this.prisma.employee.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { department: true },
      orderBy: { fullName: 'asc' },
    });
  }
}

// ❌ SAI — business logic không thuộc Repository
async findActiveEmployeesWithLeaveBalance() {
  const employees = await this.prisma.employee.findMany(...);
  return employees.filter(e => e.leaveBalance > 0); // logic này thuộc Service
}
```

### Service (`*.service.ts`)
- **Class**, inject Repository (và các Service khác nếu cần)
- Chứa **toàn bộ business logic**: tính toán, validate nghiệp vụ, orchestration
- Gọi Utils functions khi cần
- Throw `BusinessException` khi vi phạm rule nghiệp vụ
- Trả về raw data (Prisma type hoặc plain object) — **không transform**

```typescript
// ✅ ĐÚNG
@Injectable()
export class LeaveService {
  constructor(
    private readonly leaveRepository: LeaveRepository,
    private readonly leaveBalanceRepository: LeaveBalanceRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async createLeaveRequest(employeeId: string, dto: CreateLeaveRequestDto) {
    // 1. Business validation
    const totalDays = calculateWorkingDays(dto.startDate, dto.endDate);
    if (totalDays <= 0) throw new BadRequestException('Ngày không hợp lệ');

    const balance = await this.leaveBalanceRepository.findByEmployeeAndType(
      employeeId, dto.leaveTypeId,
    );
    if (balance.remainingDays < totalDays) {
      throw new BadRequestException('Không đủ ngày phép');
    }

    const overlap = await this.leaveRepository.findOverlap(employeeId, dto.startDate, dto.endDate);
    if (overlap) throw new ConflictException('Trùng với đơn phép đã có');

    // 2. Create
    const leave = await this.leaveRepository.create({ ...dto, employeeId, totalDays });

    // 3. Side effects
    await this.notificationService.sendLeaveRequestEmail(leave);

    return leave; // raw Prisma object — KHÔNG transform ở đây
  }
}
```
