# Module 01 — Auth

## Yêu cầu

| # | Yêu cầu | Ưu tiên | Web | Mobile | Sprint |
|---|---------|---------|-----|--------|--------|
| 1 | Đăng nhập / đăng xuất | Cao | ✓ | ✓ | S1 |
| 2 | Phân quyền theo vai trò | Cao | ✓ | ✓ | S1 |
| 3 | Đổi mật khẩu | Cao | ✓ | ✓ | S1 |
| 4 | Quản lý phiên đăng nhập | Trung bình | ✓ | — | S3 |

## API Endpoints

| Method | Endpoint | Role |
|--------|----------|------|
| POST | `/v1/auth/login` | Public |
| POST | `/v1/auth/logout` | JWT |
| POST | `/v1/auth/refresh` | Refresh token |
| PATCH | `/v1/auth/change-password` | JWT |
| POST | `/v1/auth/forgot-password` | Public |
| POST | `/v1/auth/reset-password` | Reset token |

## Token Strategy

- Access token: JWT, TTL 15 phút
- Refresh token: UUID lưu DB, TTL 7 ngày
- Khóa tài khoản sau 5 lần đăng nhập sai (30 phút)
- Reset password link hết hạn sau 1 giờ

## Transformer output

```typescript
// auth.transformer.ts
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl: string | null;
  };
}
```
