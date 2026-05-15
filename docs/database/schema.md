# Database — Prisma Schema

File đầy đủ tại `prisma/schema.prisma`.

## schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

enum Role {
  ADMIN
  HR
  MANAGER
  EMPLOYEE
}

enum EmployeeStatus {
  ACTIVE
  INACTIVE
  ON_LEAVE
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  HALF_DAY
  ON_LEAVE
}

enum PayrollStatus {
  DRAFT
  PUBLISHED
}

enum PermissionType {
  LATE
  EARLY_LEAVE
}

enum DocumentType {
  ID_CARD
  CONTRACT
  OTHER
}

enum PayrollItemType {
  ADDITION
  DEDUCTION
}

// ─────────────────────────────────────────
// CORE ENTITIES
// ─────────────────────────────────────────

model Department {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(100)
  manager   Employee? @relation("DepartmentManager", fields: [managerId], references: [id])
  managerId String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  employees Employee[] @relation("DepartmentEmployees")
  positions Position[]

  @@map("departments")
}

model Position {
  id           String     @id @default(uuid())
  name         String     @db.VarChar(100)
  department   Department @relation(fields: [departmentId], references: [id])
  departmentId String
  createdAt    DateTime   @default(now())

  employees Employee[]

  @@map("positions")
}

model Employee {
  id              String         @id @default(uuid())
  employeeCode    String         @unique @db.VarChar(20)
  fullName        String         @db.VarChar(100)
  email           String         @unique @db.VarChar(150)
  phone           String?        @db.VarChar(20)
  dateOfBirth     DateTime?      @db.Date
  gender          String?        @db.VarChar(10)
  address         String?
  avatarUrl       String?        @db.VarChar(255)
  department      Department?    @relation("DepartmentEmployees", fields: [departmentId], references: [id])
  departmentId    String?
  position        Position?      @relation(fields: [positionId], references: [id])
  positionId      String?
  manager         Employee?      @relation("ManagerSubordinates", fields: [managerId], references: [id])
  managerId       String?
  role            Role           @default(EMPLOYEE)
  status          EmployeeStatus @default(ACTIVE)
  joinDate        DateTime       @db.Date

  // Auth fields
  passwordHash    String
  refreshToken    String?
  tokenExpiresAt  DateTime?
  lastLoginAt     DateTime?
  failedAttempts  Int            @default(0)
  lockedUntil     DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  subordinates      Employee[]          @relation("ManagerSubordinates")
  managedDepartment Department?         @relation("DepartmentManager")
  documents         EmployeeDocument[]
  employmentHistory EmploymentHistory[]
  attendanceRecords AttendanceRecord[]
  leaveRequests     LeaveRequest[]      @relation("EmployeeLeaves")
  approvedLeaves    LeaveRequest[]      @relation("ApprovedLeaves")
  leaveBalances     LeaveBalance[]
  permissionRequests PermissionRequest[] @relation("EmployeePermissions")
  approvedPermissions PermissionRequest[] @relation("ApprovedPermissions")
  payrollRecords    PayrollRecord[]
  publishedPayrolls PayrollRecord[]     @relation("PublishedPayrolls")
  editedAttendances AttendanceRecord[]  @relation("EditedAttendances")

  @@map("employees")
}

model EmployeeDocument {
  id         String       @id @default(uuid())
  employee   Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  employeeId String
  type       DocumentType
  fileName   String       @db.VarChar(255)
  fileUrl    String       @db.VarChar(255)
  uploadedAt DateTime     @default(now())

  @@map("employee_documents")
}

model EmploymentHistory {
  id           String     @id @default(uuid())
  employee     Employee   @relation(fields: [employeeId], references: [id])
  employeeId   String
  department   Department @relation(fields: [departmentId], references: [id])
  departmentId String
  position     Position   @relation(fields: [positionId], references: [id])
  positionId   String
  startedAt    DateTime   @db.Date
  endedAt      DateTime?  @db.Date
  note         String?

  @@map("employment_history")
}

// ─────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────

model WorkShift {
  id               String   @id @default(uuid())
  name             String   @db.VarChar(50)
  checkInTime      DateTime @db.Time
  checkOutTime     DateTime @db.Time
  lateThresholdMin Int      @default(15)
  earlyThresholdMin Int     @default(15)
  workDays         Int[]
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())

  attendanceRecords AttendanceRecord[]

  @@map("work_shifts")
}

model AttendanceRecord {
  id          String           @id @default(uuid())
  employee    Employee         @relation(fields: [employeeId], references: [id])
  employeeId  String
  shift       WorkShift?       @relation(fields: [shiftId], references: [id])
  shiftId     String?
  date        DateTime         @db.Date
  checkInAt   DateTime?
  checkOutAt  DateTime?
  checkInIp   String?          @db.VarChar(45)
  lateMinutes Int              @default(0)
  earlyMinutes Int             @default(0)
  status      AttendanceStatus
  note        String?
  isManual    Boolean          @default(false)
  editedBy    Employee?        @relation("EditedAttendances", fields: [editedById], references: [id])
  editedById  String?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@unique([employeeId, date])
  @@map("attendance_records")
}

model IpWhitelist {
  id        String   @id @default(uuid())
  ipAddress String   @db.VarChar(45)
  label     String?  @db.VarChar(100)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@map("ip_whitelist")
}

// ─────────────────────────────────────────
// LEAVE
// ─────────────────────────────────────────

model LeaveType {
  id           String  @id @default(uuid())
  name         String  @db.VarChar(100)
  code         String  @unique @db.VarChar(20)
  daysPerYear  Decimal? @db.Decimal(5, 1)
  isPaid       Boolean @default(true)
  isActive     Boolean @default(true)

  leaveRequests LeaveRequest[]
  leaveBalances LeaveBalance[]

  @@map("leave_types")
}

model LeaveBalance {
  id          String    @id @default(uuid())
  employee    Employee  @relation(fields: [employeeId], references: [id])
  employeeId  String
  leaveType   LeaveType @relation(fields: [leaveTypeId], references: [id])
  leaveTypeId String
  year        Int
  totalDays   Decimal   @db.Decimal(5, 1)
  usedDays    Decimal   @default(0) @db.Decimal(5, 1)

  @@unique([employeeId, leaveTypeId, year])
  @@map("leave_balances")
}

model LeaveRequest {
  id          String      @id @default(uuid())
  employee    Employee    @relation("EmployeeLeaves", fields: [employeeId], references: [id])
  employeeId  String
  leaveType   LeaveType   @relation(fields: [leaveTypeId], references: [id])
  leaveTypeId String
  startDate   DateTime    @db.Date
  endDate     DateTime    @db.Date
  totalDays   Decimal     @db.Decimal(5, 1)
  reason      String?
  status      LeaveStatus @default(PENDING)
  approvedBy  Employee?   @relation("ApprovedLeaves", fields: [approvedById], references: [id])
  approvedById String?
  approvedAt  DateTime?
  rejectNote  String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@map("leave_requests")
}

model PermissionRequest {
  id         String         @id @default(uuid())
  employee   Employee       @relation("EmployeePermissions", fields: [employeeId], references: [id])
  employeeId String
  type       PermissionType
  date       DateTime       @db.Date
  time       DateTime       @db.Time
  reason     String?
  status     LeaveStatus    @default(PENDING)
  approvedBy Employee?      @relation("ApprovedPermissions", fields: [approvedById], references: [id])
  approvedById String?
  approvedAt DateTime?
  createdAt  DateTime       @default(now())

  @@map("permission_requests")
}

// ─────────────────────────────────────────
// PAYROLL
// ─────────────────────────────────────────

model PayrollRecord {
  id          String        @id @default(uuid())
  employee    Employee      @relation(fields: [employeeId], references: [id])
  employeeId  String
  month       String        @db.VarChar(7)
  baseSalary  BigInt
  allowances  BigInt        @default(0)
  deductions  BigInt        @default(0)
  bonus       BigInt        @default(0)
  netSalary   BigInt
  status      PayrollStatus @default(DRAFT)
  note        String?
  publishedBy Employee?     @relation("PublishedPayrolls", fields: [publishedById], references: [id])
  publishedById String?
  publishedAt DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  items PayrollItem[]

  @@unique([employeeId, month])
  @@map("payroll_records")
}

model PayrollItem {
  id        String          @id @default(uuid())
  payroll   PayrollRecord   @relation(fields: [payrollId], references: [id], onDelete: Cascade)
  payrollId String
  label     String          @db.VarChar(100)
  amount    BigInt
  type      PayrollItemType

  @@map("payroll_items")
}

// ─────────────────────────────────────────
// NOTIFICATION
// ─────────────────────────────────────────

model EmailLog {
  id           String   @id @default(uuid())
  toEmail      String   @db.VarChar(150)
  subject      String?  @db.VarChar(255)
  template     String?  @db.VarChar(100)
  status       String   @default("PENDING") @db.VarChar(20)
  attempts     Int      @default(0)
  errorMessage String?
  sentAt       DateTime?
  createdAt    DateTime @default(now())

  @@map("email_logs")
}

// ─────────────────────────────────────────
// SYSTEM
// ─────────────────────────────────────────

model SystemSetting {
  key         String   @id @db.VarChar(100)
  value       String?
  description String?  @db.VarChar(255)
  updatedAt   DateTime @updatedAt

  @@map("system_settings")
}

model PublicHoliday {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(100)
  date      DateTime @unique @db.Date
  year      Int
  createdAt DateTime @default(now())

  @@map("public_holidays")
}
```
