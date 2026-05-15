# Module 07 — Bảng lương

## Yêu cầu

| # | Yêu cầu | Ưu tiên | Web | Mobile | Sprint |
|---|---------|---------|-----|--------|--------|
| 1 | Xem bảng lương cá nhân | Trung bình | ✓ | ✓ | S3 |
| 2 | Quản lý bảng lương | Trung bình | ✓ | — | S3 |
| 3 | Xuất phiếu lương PDF | Thấp | ✓ | — | S5+ |

## API Endpoints

| Method | Endpoint | Role |
|--------|----------|------|
| GET | `/v1/payroll` | HR, Admin |
| POST | `/v1/payroll` | HR, Admin |
| PATCH | `/v1/payroll/:id` | HR, Admin |
| POST | `/v1/payroll/:id/publish` | HR, Admin |
| GET | `/v1/payroll/me` | Employee |
| GET | `/v1/payroll/:id/export` | HR, Admin |

## Transformer output

```typescript
export interface PayrollResponse {
  id: string;
  month: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  bonus: number;
  netSalary: number;
  status: string;
  items: { label: string; amount: number; type: 'ADDITION' | 'DEDUCTION' }[];
}
```

## Lưu ý

- Employee chỉ xem `status = PUBLISHED`
- Lương lưu dạng `BigInt` (VND, không có decimal)
- Phase 2: tích hợp tự động tính khấu trừ từ chấm công
