# FE prompt — Company Announcements: Realtime WebSocket cho comments & reactions

> Dán cho FE agent (hr-system-web Nuxt / hr-system-mobile Flutter). Prompt tự chứa context, không cần hỏi lại.

---

## Context

Backend vừa thêm Socket.IO gateway để push live event khi user đang mở màn chi tiết announcement. Trước đây FE chỉ nhận notification qua FCM (bell icon, offline push) — muốn thấy comment/reaction mới thì phải refresh trang. Giờ có realtime.

**Không thay thế FCM.** FCM giữ nguyên cho:
- Bell icon (in-app notification khi không mở trang cụ thể)
- Mobile push khi app closed/background
- Mention notification (`ANNOUNCEMENT_COMMENT_MENTION`)

**WebSocket bổ sung:** live sync UI giữa các client cùng đang mở 1 announcement.

Bridge doc đầy đủ: [`docs/bridges/company-announcements.md`](./company-announcements.md) section **"Realtime — WebSocket"**.

---

## Connection info

| Item | Value |
|------|-------|
| Namespace | `/announcements` |
| Full URL (dev) | `ws://localhost:6868/announcements` |
| Full URL (prod) | `wss://<api-host>/announcements` |
| Transport | Socket.IO v4 (bắt buộc — không phải native WebSocket) |
| Auth | `auth.token = <accessToken>` trong handshake |
| Auth fallback | Header `Authorization: Bearer <token>` hoặc query `?token=` |

Server tự disconnect nếu token thiếu/hết hạn, emit event `error` `{ code: 'UNAUTHENTICATED', message }` trước.

---

## Event contracts (copy y hệt)

### Client → Server

```typescript
socket.emit('join', { announcementId: number }, (ack) => {
  // ack = { joined: number } | { error: string }
});

socket.emit('leave', { announcementId: number }, (ack) => {
  // ack = { left: number } | { error: string }
});
```

Cũng chấp nhận truyền số nguyên trực tiếp: `socket.emit('join', 12)`.

### Server → Client

```typescript
socket.on('comment.added', (comment: AnnouncementComment) => { ... });
// AnnouncementComment giống response của POST /:id/comments — full shape (author, mentionIds, replies=[], replyCount=0)
// avatarUrl đã presigned TTL 3600s

socket.on('comment.deleted', (payload: { announcementId: number; commentId: number }) => { ... });

socket.on('reaction.changed', (payload: {
  announcementId: number;
  action: 'added' | 'changed' | 'removed';
  emoji: 'heart' | 'thumbsup' | 'haha' | 'sad' | 'wow';
  actor: { id: number; fullName: string; avatarUrl: string | null };  // avatarUrl presigned
  summary: { heart: number; thumbsup: number; haha: number; sad: number; wow: number };
}) => { ... });

socket.on('error', (err: { code: string; message: string }) => { ... });
```

---

## Việc cần làm — Web (Nuxt)

### 1. Install

```bash
pnpm add socket.io-client
```

### 2. Composable

Tạo `composables/useAnnouncementRealtime.ts`:

```typescript
import { io, type Socket } from 'socket.io-client';
import type {
  AnnouncementComment,
  ReactionEmoji,
} from '~/types/announcement-comment.types';

interface ReactionChangedEvent {
  announcementId: number;
  action: 'added' | 'changed' | 'removed';
  emoji: ReactionEmoji;
  actor: { id: number; fullName: string; avatarUrl: string | null };
  summary: Record<ReactionEmoji, number>;
}

interface Handlers {
  onCommentAdded?: (c: AnnouncementComment) => void;
  onCommentDeleted?: (p: { commentId: number }) => void;
  onReactionChanged?: (p: ReactionChangedEvent) => void;
}

let socket: Socket | null = null;
const activeRooms = new Set<number>();

export function useAnnouncementRealtime() {
  const { token } = useAuth();  // hoặc useSession() — điều chỉnh theo project
  const config = useRuntimeConfig();

  function ensureConnected(): Socket {
    if (socket?.connected) return socket;
    socket = io(`${config.public.apiBase}/announcements`, {
      auth: { token: token.value },
      transports: ['websocket'],
      autoConnect: true,
    });

    // Re-join tất cả room đang active sau khi reconnect
    socket.on('connect', () => {
      for (const id of activeRooms) socket?.emit('join', { announcementId: id });
    });

    socket.on('error', (err: { code: string; message: string }) => {
      if (err.code === 'UNAUTHENTICATED') {
        // TODO: trigger refresh-token flow rồi reconnect
        console.warn('[WS] Auth failed', err.message);
      }
    });

    return socket;
  }

  function subscribe(announcementId: number, handlers: Handlers): () => void {
    const s = ensureConnected();
    s.emit('join', { announcementId });
    activeRooms.add(announcementId);

    if (handlers.onCommentAdded) s.on('comment.added', handlers.onCommentAdded);
    if (handlers.onCommentDeleted) s.on('comment.deleted', handlers.onCommentDeleted);
    if (handlers.onReactionChanged) s.on('reaction.changed', handlers.onReactionChanged);

    return () => {
      s.emit('leave', { announcementId });
      activeRooms.delete(announcementId);
      if (handlers.onCommentAdded) s.off('comment.added', handlers.onCommentAdded);
      if (handlers.onCommentDeleted) s.off('comment.deleted', handlers.onCommentDeleted);
      if (handlers.onReactionChanged) s.off('reaction.changed', handlers.onReactionChanged);
    };
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
    activeRooms.clear();
  }

  return { subscribe, disconnect };
}
```

### 3. Trang chi tiết announcement

Ví dụ `pages/announcements/[id].vue`:

```vue
<script setup lang="ts">
const route = useRoute();
const id = Number(route.params.id);

const { fetchMyAnnouncementDetail, markAsRead } = useCompanyAnnouncements();
const { subscribe } = useAnnouncementRealtime();

const detail = ref<MyAnnouncementDetail | null>(null);
const comments = ref<AnnouncementComment[]>([]);
const reactions = ref<ReactionResponse | null>(null);

onMounted(async () => {
  detail.value = await fetchMyAnnouncementDetail(id);
  comments.value = await fetchComments(id);
  reactions.value = await fetchReactions(id);
  markAsRead(id).catch(() => {});
});

const unsubscribe = subscribe(id, {
  onCommentAdded(c) {
    if (c.parentId === null) {
      comments.value = [c, ...comments.value];
    } else {
      const parent = comments.value.find((x) => x.id === c.parentId);
      if (parent) {
        parent.replies = [...parent.replies, c as any];  // c là AnnouncementReply shape khi có parentId
        parent.replyCount++;
      }
    }
  },
  onCommentDeleted({ commentId }) {
    comments.value = comments.value.filter((c) => c.id !== commentId);
    for (const c of comments.value) {
      c.replies = c.replies.filter((r) => r.id !== commentId);
    }
  },
  onReactionChanged(p) {
    if (!reactions.value) return;
    reactions.value.summary = p.summary;
    if (p.actor.id === useAuth().user.value?.id) {
      reactions.value.myReaction = p.action === 'removed' ? null : p.emoji;
    }
    // Nếu FE render danh sách người react, gọi lại fetchReactions() để đồng bộ chi tiết
  },
});

onBeforeUnmount(() => unsubscribe());
</script>
```

### 4. Dedupe với optimistic UI

Nếu FE đang optimistic update (thêm comment ngay khi user bấm gửi trước khi API trả), khi event `comment.added` về:
- Match theo `comment.id` — nếu đã có trong state → bỏ qua.
- Reaction: khớp `actor.id === currentUser.id` + đang có action tương tự → bỏ qua diff `summary` (đã update local rồi). Hoặc luôn thay bằng `summary` từ event (server-authoritative — cách này an toàn hơn).

---

## Việc cần làm — Mobile (Flutter)

### 1. Install

```yaml
# pubspec.yaml
dependencies:
  socket_io_client: ^2.0.3
```

### 2. Service

```dart
// lib/services/announcement_realtime_service.dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class AnnouncementRealtimeService {
  IO.Socket? _socket;
  final Set<int> _activeRooms = {};

  void connect(String baseUrl, String token) {
    if (_socket?.connected == true) return;
    _socket = IO.io(
      '$baseUrl/announcements',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .build(),
    );

    _socket!.on('connect', (_) {
      for (final id in _activeRooms) {
        _socket!.emit('join', {'announcementId': id});
      }
    });

    _socket!.on('error', (data) {
      if (data is Map && data['code'] == 'UNAUTHENTICATED') {
        // trigger refresh token
      }
    });
  }

  void subscribe(
    int announcementId, {
    void Function(Map<String, dynamic>)? onCommentAdded,
    void Function(Map<String, dynamic>)? onCommentDeleted,
    void Function(Map<String, dynamic>)? onReactionChanged,
  }) {
    _socket?.emit('join', {'announcementId': announcementId});
    _activeRooms.add(announcementId);
    if (onCommentAdded != null) _socket?.on('comment.added', (data) => onCommentAdded(data as Map<String, dynamic>));
    if (onCommentDeleted != null) _socket?.on('comment.deleted', (data) => onCommentDeleted(data as Map<String, dynamic>));
    if (onReactionChanged != null) _socket?.on('reaction.changed', (data) => onReactionChanged(data as Map<String, dynamic>));
  }

  void unsubscribe(int announcementId) {
    _socket?.emit('leave', {'announcementId': announcementId});
    _activeRooms.remove(announcementId);
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
    _activeRooms.clear();
  }
}
```

### 3. Screen detail

Trong `AnnouncementDetailScreen`:
- `initState`: `service.connect(...); service.subscribe(id, onCommentAdded: ..., ...);`
- `dispose`: `service.unsubscribe(id);` — không disconnect toàn socket vì user có thể mở screen khác cũng dùng.
- Khi app vào background: giữ socket connect nếu OS chưa kill. Nếu socket rớt, FCM sẽ lo notification off-app.

---

## Reconnect & auth refresh

- Socket.IO tự reconnect với exponential backoff. Khi reconnect thành công, `connect` event fire → composable tự re-emit `join` cho các room đang active.
- Token hết hạn (15p JWT): server disconnect + emit `error`. FE nghe `error` với `code: 'UNAUTHENTICATED'` → gọi refresh token → gán token mới vào `socket.auth.token` → `socket.connect()`.
- Đơn giản nhất: **reconnect socket sau mỗi lần refresh token thành công** (kể cả khi socket chưa disconnect).

---

## Test checklist

- [ ] Mở 2 tab cùng 1 announcement → 1 tab thêm comment → tab kia thấy ngay không refresh.
- [ ] React ở tab A → tab B thấy `summary` counts đổi ngay.
- [ ] Xoá comment ở tab A → tab B thấy comment biến mất.
- [ ] Ngắt mạng 5s rồi kết nối lại → socket reconnect → room tự re-join → event vẫn nhận được.
- [ ] Token hết hạn → nhận `error` → refresh token → reconnect → tiếp tục nhận event.
- [ ] Rời trang detail → socket rời room → không nhận event của announcement đó nữa.
- [ ] User có FCM device token → khi app closed, comment/reaction mới KHÔNG cần WS (FCM đã lo mention). Mở app lại → refetch REST.

---

## Ghi chú

- CORS đã enable trên gateway (`origin: (_, cb) => cb(null, true)`) — hoạt động với mọi origin trong dev/prod.
- Không có rate limit riêng cho WS event — nhưng comment/reaction REST endpoint vẫn đi qua `@nestjs/throttler` như cũ.
- Openapi.json không mô tả WS (Socket.IO không phải OpenAPI). Contract chuẩn ở bridge doc section "Realtime — WebSocket".
