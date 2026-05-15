# Backend — Prisma & Repository Rules

## PrismaService

```typescript
// prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```typescript
// prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // inject được ở mọi module mà không cần import
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

---

## Repository Pattern

### Cấu trúc chuẩn

```typescript
// employee/employee.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma, Employee } from '@prisma/client';

@Injectable()
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- READ ---

  async findById(id: string) {
    return this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        position: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.employee.findUnique({ where: { email } });
  }

  async findMany(params: {
    page: number;
    limit: number;
    departmentId?: string;
    status?: string;
    search?: string;
  }) {
    const { page, limit, departmentId, status, search } = params;

    const where: Prisma.EmployeeWhereInput = {
      ...(departmentId && { departmentId }),
      ...(status && { status: status as any }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: { department: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, total };
  }

  // --- WRITE ---

  async create(data: Prisma.EmployeeCreateInput) {
    return this.prisma.employee.create({
      data,
      include: { department: true, position: true },
    });
  }

  async update(id: string, data: Prisma.EmployeeUpdateInput) {
    return this.prisma.employee.update({
      where: { id },
      data,
      include: { department: true, position: true },
    });
  }

  async softDelete(id: string) {
    return this.prisma.employee.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }
}
```

---

## Transaction — Bắt buộc khi write nhiều bảng

```typescript
// ✅ ĐÚNG — dùng $transaction khi update nhiều bảng liên quan
async approveLeaveRequest(leaveId: string, approverId: string) {
  const leave = await this.leaveRepository.findById(leaveId);

  return this.prisma.$transaction(async (tx) => {
    // 1. Update leave status
    const updatedLeave = await tx.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    // 2. Deduct leave balance
    await tx.leaveBalance.update({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: leave.employeeId,
          leaveTypeId: leave.leaveTypeId,
          year: new Date().getFullYear(),
        },
      },
      data: {
        usedDays: { increment: leave.totalDays },
      },
    });

    return updatedLeave;
  });
}

// ❌ SAI — không dùng transaction
await this.prisma.leaveRequest.update(...);
await this.prisma.leaveBalance.update(...); // nếu fail → inconsistent data
```

---

## Pagination utility

```typescript
// common/utils/pagination.utils.ts
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
```

---

## Soft Delete — Quy ước

Không bao giờ xoá cứng các entity chính. Dùng `status` field:

| Entity | Status khi xoá |
|--------|---------------|
| Employee | `INACTIVE` |
| LeaveRequest | `CANCELLED` |
| Department | `INACTIVE` |

```typescript
// ✅ ĐÚNG
await this.employeeRepository.softDelete(id);

// ❌ SAI
await this.prisma.employee.delete({ where: { id } });
```

---

## Prisma Schema — Conventions

```prisma
// Mọi model đều có:
model Example {
  id        String   @id @default(uuid())   // UUID, không dùng auto-increment
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Enum fields dùng enum type của Prisma, không dùng String
  status    EmployeeStatus @default(ACTIVE)
}

// Enum đặt cuối file schema.prisma
enum EmployeeStatus {
  ACTIVE
  INACTIVE
  ON_LEAVE
}
```

**Naming trong Prisma schema:**
- Model name: `PascalCase` singular — `Employee`, `LeaveRequest`
- Field name: `camelCase` — `fullName`, `departmentId`
- Prisma tự map sang `snake_case` trong PostgreSQL qua `@@map`

```prisma
model LeaveRequest {
  id String @id @default(uuid())

  @@map("leave_requests") // tên bảng trong DB là snake_case
}
```
