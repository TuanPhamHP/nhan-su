# Realtime / WebSocket — Architecture Rules

Kiến trúc: **1 gateway = 1 namespace = 1 bounded context** (`/announcements`, `/chat`, `/notifications`, …). Wire-level vẫn dùng chung 1 connection nhờ Socket.IO tự multiplex, miễn là client tuân thủ shared Manager pattern.

Ba quy tắc dưới đây LUÔN áp dụng, không có ngoại lệ.

---

## 1. Client — Shared Manager Singleton (Frontend)

Toàn app dùng **1 `io.Manager('wss://<baseApiUrl>', { auth })`** ở module scope. Mọi composable/feature phải lấy socket qua `manager.socket('/<namespace>')`.

- **Không** gọi `io(url, ...)` trực tiếp trong composable, component, plugin của từng feature.
- Composable dùng chung: `useSocket(namespace: string)` — trả về `Socket` của namespace tương ứng, được cache theo namespace.
- Manager được khởi tạo trong `plugins/socket.client.ts` sau khi auth ready; watch token thay đổi (login/logout) để reconnect/disconnect toàn bộ namespace một lần.
- Mỗi feature-composable (VD: `useAnnouncementRealtime`) chỉ chịu trách nhiệm join/leave room + bind event, KHÔNG quản lý connection.

```ts
// ✅ Đúng — 1 Manager, N namespace socket dùng chung wire
const socket = useSocket('/announcements');
socket.emit('join', { announcementId });

// ❌ Sai — mỗi feature tự io() sẽ mở connection mới
const socket = io(`${baseApiUrl}/announcements`, { auth: { token } });
```

**Vì sao:** nếu mỗi feature tự `io()`, mỗi namespace mở 1 underlying WebSocket connection riêng — phá vỡ multiplexing, tốn tài nguyên client/server, mất đồng bộ auth token khi refresh.

---

## 2. Backend — Mỗi Namespace = 1 Gateway File, Không Cross-namespace Emit

Mỗi gateway file (`*.gateway.ts`) chỉ phục vụ **đúng 1 namespace** và chỉ emit trong namespace của chính nó.

- **Không** inject `Server` của namespace khác rồi `server.of('/other').emit(...)` từ trong gateway.
- Muốn broadcast tới namespace khác → **inject gateway đó vào controller/service** (qua DI) và gọi method public tường minh (VD: `notificationsGateway.pushToUser(userId, payload)`).
- Public API của gateway phải rõ ràng: các method emit ra ngoài phải typed, có tên nghiệp vụ (`broadcastCommentAdded`, `notifyReactionChanged`…), không expose raw `server`.

```ts
// ✅ Đúng — muốn báo cho notification namespace thì gọi qua service của nó
// announcements.controller.ts
constructor(
  private readonly announcementsGateway: AnnouncementsGateway,
  private readonly notificationsGateway: NotificationsGateway, // tường minh
) {}

async create(dto) {
  const created = await this.service.create(dto);
  this.announcementsGateway.broadcastCreated(created);
  this.notificationsGateway.pushToUsers(dto.recipientIds, { ... });
}

// ❌ Sai — gateway announcements tự đi qua namespace khác
@WebSocketServer() private server: Server;
this.server.of('/notifications').emit('push', payload);
```

**Vì sao:** cross-namespace emit từ trong gateway phá vỡ ranh giới bounded context, khiến rất khó truy vết event flow và thay đổi auth policy độc lập.

---

## 3. Backend — Shared Auth Pattern (`WsAuthGuard` / `AuthenticatedGateway`)

Tách logic xác thực WebSocket ra thành **một trong hai** cấu trúc dùng chung, không copy-paste `extractToken` + `verifyAsync` vào từng gateway.

- Option A: `@UseGuards(WsAuthGuard)` — guard đọc `handshake.auth.token`, verify JWT, gắn `client.data.user`. Gateway chỉ đọc `client.data.user`.
- Option B: `AuthenticatedGateway` base class — override `handleConnection` để verify token, disconnect với `error { code: 'UNAUTHENTICATED' }` nếu fail; gateway con extend base này.

Mỗi namespace có thể **tùy biến role/permission** trên gateway con (VD: `/announcements` chỉ ADMIN, `/notifications` mọi role đã login) — nhưng phần extract + verify token luôn dùng shared code.

```ts
// ✅ Đúng — shared guard, gateway con chỉ khai báo policy
@UseGuards(WsAuthGuard, WsRolesGuard)
@Roles('ADMIN', 'HR')
@WebSocketGateway({ namespace: '/announcements', ... })
export class AnnouncementsGateway { ... }

// ❌ Sai — mỗi gateway tự extract + verify token
async handleConnection(client: Socket) {
  const token = client.handshake.auth?.token ?? ...; // copy-paste
  const payload = await this.jwtService.verifyAsync(token, { ... });
  client.data.user = payload;
}
```

**Vì sao:** đã có ít nhất 1 gateway (`/announcements`) làm việc này inline — thêm 4 gateway nữa (chat, notifications, presence, attendance…) sẽ nhân 5 duplicate. Sửa 1 lỗ hổng auth phải sửa 5 chỗ là công thức lộ hàng.

---

## Checklist khi thêm namespace mới

- [ ] Backend: tạo `xxx.gateway.ts` extend `AuthenticatedGateway` HOẶC `@UseGuards(WsAuthGuard)`
- [ ] Backend: không dùng `server.of('/other')` trong gateway — inject gateway khác nếu cần
- [ ] Frontend: KHÔNG gọi `io()` — dùng `useSocket('/xxx')` để lấy socket từ shared Manager
- [ ] Frontend: composable feature chỉ join/leave room + bind event, không sở hữu connection
- [ ] Frontend: nếu cần re-join room sau reconnect, quản lý `activeRooms` cục bộ trong composable đó
