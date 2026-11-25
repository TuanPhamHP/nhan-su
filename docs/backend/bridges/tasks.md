# Bridge: Công việc và KPI (`TASKS`), lô 1

Cho web `nhan-su` và mobile. Thiết kế: `docs/modules/18-tasks.md`. Phiếu yêu cầu: `docs/templates/tasks/quan-ly-cong-viec.md`.
Lô 1 là **lõi công việc**: dự án và thành viên, công việc và việc con, danh sách kiểm tra, vòng đời và nghiệm thu, đổi hạn,
huỷ, người theo dõi, bình luận nhắc tên, file, Việc của tôi, danh sách, bảng việc kéo thả, thông báo N-01 đến N-08, nhắc hạn
J-02, J-03 và kênh thời gian thực `/tasks`. Nhóm việc, đợt, việc định kỳ, phụ thuộc, báo cáo ở lô 2; KPI ở lô 3.

Mọi response bọc `{ success, data }` (danh sách thêm `meta { page, limit, total, totalPages }`), lỗi là
`{ success: false, error: { code, message, details? } }` như các module khác. `message` là câu tiếng Việt đời thường, hiện
thẳng cho người dùng được.

---

## 1. Module, ô phân hệ, quyền

- Mã module `TASKS`, **bán riêng** (`defaultEnabled: false`). Chưa được cấp: mọi route 403 `MODULE_NOT_SUBSCRIBED`; bị tắt:
  403 `MODULE_SUSPENDED`; hết thời gian dùng thử: `MODULE_EXPIRED`/`MODULE_LAPSED` như module khác.
- **Chỉ xem** (`READ_ONLY`): mọi GET dùng được; mọi POST, PATCH, DELETE 403 `MODULE_READ_ONLY` (Q-25), kể cả báo xong,
  nghiệm thu, bình luận. `GET /approval/counts` trả `taskReviews: 0`.
- **Ô trên lưới phân hệ:** `GET /me/entitlements` trả ô mã `tsk` ("Công việc và KPI", nhóm `OPERATIONS`, `module: 'TASKS'`).
  Web thêm `TASKS` vào `ModuleCode`, `MODULE_ROUTES` (`/cong-viec`), thêm `tsk` vào `APP_MODULES` và bỏ `TSK`, `PER` khỏi
  `PLANNED_MODULES`; mobile thêm `tsk` vào bảng mã → màn hình. Công ty chưa được cấp thì ô khoá.
- **Không có permission cho thao tác thường** (Q-07, Q-20): ai cũng giao việc cho bất kỳ ai, ai cũng tạo dự án. Server quyết
  theo vai trên từng việc và trả sẵn cho giao diện (mục 3). Mã `task:report` (DIRECTOR mặc định, ADMIN luôn có) dành cho
  báo cáo toàn công ty ở lô 2; lô 1 chưa có route nào dùng.

### 1.1 Ai xem được việc (thiết kế mục 3.1)

Một việc xem được khi người xem: là ADMIN hoặc DIRECTOR; hoặc là người giao, người thực hiện, người nghiệm thu, người theo
dõi của việc (hoặc của việc cha nếu là việc con); hoặc là thành viên dự án của việc (cả ba vai); hoặc là trưởng phòng
(`Department.managerId`) của phòng **hiện tại** của người thực hiện. HR không có quyền xem riêng.

Danh sách, bảng việc, số đếm đều lọc bằng đúng điều kiện này. Mở chi tiết việc không xem được thì 404 `TASK_NOT_VISIBLE`,
`error.details` chỉ có `{ code, assignerName }` để hiện "Bạn không xem được việc này, người giao là …" (UI-02); không lộ
tiêu đề.

### 1.2 Ai làm được gì (thiết kế mục 3.2)

| Thao tác | Ai được |
|---|---|
| Sửa tiêu đề, mô tả, ưu tiên, điểm, ngày bắt đầu | Người giao, quản lý dự án, ADMIN |
| Đổi người thực hiện, người nghiệm thu, đổi hạn, huỷ | Như trên, thêm trưởng phòng của **người giao** |
| Bắt đầu, báo xong, về Chưa làm | Người thực hiện |
| Nghiệm thu, trả lại | Người nghiệm thu; thay được bởi trưởng phòng của người giao, quản lý dự án, ADMIN (BR-06) |
| Tự đóng (`self_close`) | Người thực hiện khi chính họ là người giao (việc tự giao) |
| Mở lại việc đã hoàn thành | Người nghiệm thu, quản lý dự án, ADMIN |
| Danh sách kiểm tra, thêm việc con | Người giao, người thực hiện, quản lý dự án, trưởng phòng của người giao, ADMIN |
| Thêm, bỏ người theo dõi người khác | Như trên, thêm người nghiệm thu. Ai xem được việc cũng tự theo dõi, tự bỏ theo dõi được |
| Bình luận, tải file | Ai xem được việc, trừ Người xem của dự án (trừ khi chính họ là người giao, làm, nghiệm thu) |
| Đổi thứ tự trên bảng chung của dự án | Thành viên dự án vai Quản lý, Thành viên; ADMIN |
| Đổi thứ tự trên bảng Việc của tôi (`board=my`) | Chính người đó |

Giao diện **không tự tính** các luật này: dùng `allowedActions`, `columnRules`, `permissions` server trả kèm mỗi việc.

---

## 2. Dữ liệu và nhãn

| Trường | Mã | Nhãn (server trả kèm `…Label`) |
|---|---|---|
| `status` | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED` | Chưa làm, Đang làm, Chờ nghiệm thu, Hoàn thành, Đã huỷ |
| `priority` | `LOW`, `NORMAL`, `HIGH`, `URGENT` | Thấp, Bình thường, Cao, Gấp |
| `source` | `SELF`, `ASSIGNED`, `RECURRING` | Tự tạo cho mình, Được giao, Việc định kỳ |
| vai trong dự án | `MANAGER`, `MEMBER`, `VIEWER` | Quản lý dự án, Thành viên, Người xem |
| trạng thái dự án | `ACTIVE`, `CLOSED` | Đang chạy, Đã đóng |

- **Số hiệu** (`code`): `<mã dự án>-<số>` (`HQ-12`) hoặc `CV-<số>` với việc lẻ. Số tăng nguyên tử, hai người tạo cùng lúc
  không trùng.
- **Điểm khối lượng** `points`: bắt buộc, một trong 1, 2, 3, 5, 8, kể cả việc con (BR-12, D-Q3).
- **Hạn**: ngày `YYYY-MM-DD` theo giờ Việt Nam. `originalDueDate` là hạn lúc giao, không bao giờ đổi; `dueDate` là hạn
  hiện tại; `dueChangeCount` số lần đổi. **"Quá hạn" là nhãn, không phải trạng thái**: `overdue: true` khi chưa báo xong
  (`TODO`, `IN_PROGRESS`) và hạn đã qua (quá hạn từ 00:00 ngày hôm sau, BR-10).
- **Việc con** một cấp: `parent` có giá trị; lấy dự án của việc cha. `subtasks { total, done, points }` của việc cha
  (`points` là tổng điểm việc con chưa huỷ, hiện cạnh điểm của việc cha).
- `description` và `body` bình luận là **HTML lưu nguyên** từ Tiptap; web phải lọc bằng DOMPurify khi hiển thị, như bảng tin.
- `version` tăng mỗi lần việc đổi (sửa, chuyển trạng thái, đổi hạn, kéo thẻ trên bảng chung). Danh sách kiểm tra, người
  theo dõi, bình luận, file **không** đổi `version`.

### 2.1 Một dòng việc (`TaskListItemDto`, dùng cho danh sách, thẻ bảng việc, việc con)

```json
{
  "id": 41, "code": "HQ-12", "title": "Chuẩn bị bộ hồ sơ C/O cho tờ khai 1052",
  "status": "IN_PROGRESS", "statusLabel": "Đang làm",
  "priority": "HIGH", "priorityLabel": "Cao", "points": 3,
  "source": "ASSIGNED", "sourceLabel": "Được giao",
  "version": 4, "boardOrder": 2000, "personalOrder": null,
  "project": { "id": 2, "code": "HQ", "name": "Thông quan lô hàng dự án điện gió", "status": "ACTIVE" },
  "parent": null,
  "assigner": { "id": 5, "fullName": "Lê Thị Lan", "avatarUrl": "https://…(đã ký)" },
  "assignee": { "id": 6, "fullName": "Đỗ Minh Đức", "avatarUrl": null },
  "reviewer": { "id": 5, "fullName": "Lê Thị Lan", "avatarUrl": "https://…" },
  "startDate": null, "dueDate": "2026-11-28", "originalDueDate": "2026-11-25", "dueChangeCount": 1,
  "overdue": false,
  "firstSubmittedAt": "2026-11-24T08:10:00.000Z", "lastSubmittedAt": "2026-11-26T02:00:00.000Z",
  "acceptedAt": null, "qualityScore": null, "returnCount": 1, "selfClosed": false,
  "cancelledAt": null, "cancelReason": null,
  "subtasks": { "total": 3, "done": 2, "points": 8 },
  "checklist": { "total": 5, "done": 4 },
  "commentCount": 6, "attachmentCount": 2,
  "allowedActions": ["submit", "back_to_todo"],
  "columnRules": {
    "TODO": { "allowed": true, "action": "back_to_todo", "needsReason": false, "reason": null },
    "IN_REVIEW": { "allowed": true, "action": "submit", "needsReason": false, "reason": null },
    "DONE": { "allowed": false, "action": null, "needsReason": false,
              "reason": "Việc do người khác giao phải qua nghiệm thu, bạn bấm Báo xong để chuyển sang Chờ nghiệm thu." },
    "CANCELLED": { "allowed": false, "action": "cancel", "needsReason": true,
                   "reason": "Chỉ người giao, quản lý dự án hoặc trưởng phòng của người giao mới huỷ được việc này." }
  },
  "permissions": { "edit": false, "reassign": false, "changeDue": false, "cancel": false,
                   "manageChecklist": true, "manageWatchers": true, "addSubtask": true, "comment": true },
  "createdAt": "2026-11-20T03:00:00.000Z", "updatedAt": "2026-11-26T02:00:00.000Z"
}
```

- `allowedActions`: thao tác chuyển trạng thái người xem làm được **ngay** (hiện nút chính trong khung chi tiết, menu ba chấm).
- `columnRules`: luật thả thẻ sang từng cột khác cột hiện tại. Bắt đầu kéo thì làm mờ cột `allowed: false` và hiện `reason`.
  `needsReason: true` thì mở hộp nhập lý do trước khi gửi (Trả lại, Mở lại, Huỷ); cột `DONE` với `action: "accept"` thì mở
  hộp Nghiệm thu (điểm chất lượng tuỳ chọn).
- `permissions`: ẩn hay hiện nút sửa, đổi người, Đổi hạn, Huỷ, mục kiểm tra, người theo dõi, Thêm việc con, ô bình luận.
- `avatarUrl` đã ký sẵn (1 giờ), null khi không có ảnh.

### 2.2 Chi tiết (`TaskDetailDto` = dòng việc + các trường sau)

```json
{
  "description": "<p>Đủ bản gốc và bản sao công chứng</p>",
  "watchers": [{ "id": 8, "fullName": "Trần Quốc Trưởng", "avatarUrl": null }],
  "checklistItems": [{ "id": 7, "content": "Bản gốc", "isDone": true, "doneAt": "…", "doneById": 6, "sortOrder": 1 }],
  "attachments": [{ "id": 31, "fileName": "tờ khai 1052.pdf", "mimeType": "application/pdf", "size": 182044,
                    "commentId": null, "uploadedBy": { "id": 6, "fullName": "Đỗ Minh Đức", "avatarUrl": null },
                    "createdAt": "…" }],
  "dueChanges": [{ "oldDueDate": "2026-11-25", "newDueDate": "2026-11-28", "reason": "Khách gửi chứng từ muộn",
                   "changedBy": { "id": 5, "fullName": "Lê Thị Lan", "avatarUrl": null }, "createdAt": "…" }],
  "children": [ /* TaskListItemDto của việc con người xem xem được */ ],
  "warning": null
}
```

- `parent.title` là null khi người xem không xem được việc cha (chỉ hiện số hiệu), ở cả danh sách, bảng việc và chi tiết.
- `children` chỉ gồm việc con người xem xem được; `subtasks { total, done, points }` vẫn đếm mọi việc con.
- `warning`: câu cảnh báo không chặn sau thao tác, hiện tại chỉ có khi báo xong việc cha còn việc con chưa xong
  ("Việc còn 2 việc con chưa xong. Việc vẫn được chuyển sang Chờ nghiệm thu.").
- `attachments` gồm cả file trong bình luận (`commentId` khác null).

---

## 3. API công việc

| Method | Path | Body / query | Trả |
|---|---|---|---|
| GET | `/v1/tasks` | Mục 3.1 | `TaskListItemDto[]` + `meta` |
| GET | `/v1/tasks/board` | Như danh sách, thêm `includeCancelled=true` | `{ columns: [{ status, label, total, tasks[] }] }` |
| GET | `/v1/tasks/scope` | | `{ seesAllTasks, managedDepartments: [{ id, name }] }`: phạm vi người gọi. Hiện mục Việc của phòng khi `managedDepartments` khác rỗng hoặc `seesAllTasks` (khi đó cho chọn phòng) |
| GET | `/v1/tasks/:code` | `:code` là số hiệu (`HQ-12`, không phân biệt hoa thường) hoặc id số | `TaskDetailDto` |
| POST | `/v1/tasks` | Mục 3.2 | 201 `TaskDetailDto` |
| PATCH | `/v1/tasks/:id` | `{ version, title?, description?, priority?, points?, startDate?, assigneeId?, reviewerId? }` | `TaskDetailDto` |
| POST | `/v1/tasks/:id/transition` | `{ action, version, reason?, qualityScore? }` | 201 `TaskDetailDto` |
| POST | `/v1/tasks/:id/due-date` | `{ dueDate, reason, version }` | 201 `TaskDetailDto` |
| POST | `/v1/tasks/:id/move` | `{ status?, beforeId?, afterId?, version, board?, reason?, qualityScore? }` | 201 `TaskDetailDto` |
| (route con) | `/v1/tasks/:id/...` | Mọi route con chỉ nhận **id số**, không nhận số hiệu | |
| GET | `/v1/tasks/:id/activity` | `kind=comments` (mặc định) \| `history` \| `all`, `page`, `limit` (≤100) | `[{ kind, at, comment? , event? }]` + `meta` |
| POST | `/v1/tasks/:id/checklist` | `{ content }` | 201 mục |
| PATCH | `/v1/tasks/:id/checklist/:itemId` | `{ content?, isDone?, sortOrder? }` | mục |
| DELETE | `/v1/tasks/:id/checklist/:itemId` | | 204 |
| POST | `/v1/tasks/:id/watchers` | `{ employeeIds: number[] }` | 201 `TaskDetailDto` |
| DELETE | `/v1/tasks/:id/watchers/:employeeId` | | 204 |

Các route POST trả **201** (cả `transition`, `due-date`, `move`).

### 3.1 Lọc danh sách và bảng việc

| Query | Ý nghĩa |
|---|---|
| `view` | `my` tôi làm · `assigned` tôi giao cho người khác · `watching` tôi theo dõi · `review` chờ tôi nghiệm thu (`IN_REVIEW`, tôi là người nghiệm thu) · `department` việc của người thuộc phòng tôi làm trưởng phòng (ADMIN, DIRECTOR truyền `departmentId`); người không là trưởng phòng, hoặc trưởng phòng truyền `departmentId` phòng khác, nhận 403 `TASK_ACTION_NOT_ALLOWED` · `project` cần `projectId`. Không truyền: mọi việc xem được |
| `projectId`, `departmentId` | Dự án; phòng hiện tại của người thực hiện |
| `assigneeIds`, `assignerIds` | Danh sách id cách nhau dấu phẩy: `assigneeIds=6,7` |
| `status`, `priority` | Danh sách mã cách nhau dấu phẩy: `status=TODO,IN_PROGRESS` |
| `due` | `overdue` (chưa báo xong và hạn đã qua) · `today` · `this_week` · `next_week` (tuần bắt đầu thứ Hai) · `range` với `dueFrom`, `dueTo` |
| `topLevel=true` | Bỏ việc con. `parentId=` chỉ việc con của một việc |
| `q` | Tìm không dấu theo tiêu đề (`unaccent`), hoặc theo số hiệu (`hq-12`) |
| `sort` | `dueDate` (mặc định) · `-dueDate` · `priority` · `-priority` (Gấp trước) · `createdAt` · `-createdAt` · `updatedAt` · `-updatedAt` · `code` · `board` (thứ tự bảng việc) |
| `page`, `limit` | Mặc định 1, 20; tối đa 100 |

Bảng việc: bốn cột `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` (thêm `CANCELLED` khi `includeCancelled=true`), mỗi cột tối đa
50 thẻ xếp theo `boardOrder`, `total` là tổng thật của cột. Cột Hoàn thành chỉ việc nghiệm thu hoặc đóng trong 14 ngày gần
nhất; cột Đã huỷ chỉ 14 ngày. `status=` lọc bớt cột. `view=my` xếp theo thứ tự riêng của người xem (`personalOrder`, chưa có
thì theo `boardOrder`). Gom nhóm (`groupBy` trong thiết kế) làm ở giao diện.

"Việc của tôi" (UI-01) gợi ý gọi: `view=my&status=TODO,IN_PROGRESS,IN_REVIEW&sort=dueDate` rồi chia nhóm Quá hạn (`overdue`),
Hôm nay, Sắp tới 7 ngày, Sau đó ở giao diện; khối "Chờ tôi nghiệm thu" là `view=review`.

### 3.2 Giao việc

```json
POST /v1/tasks
{
  "title": "Đối chiếu công nợ khách hàng tháng 11",
  "assigneeId": 6,
  "dueDate": "2026-11-28",
  "points": 3,
  "reviewerId": 5,          // tuỳ chọn, mặc định người giao
  "priority": "NORMAL",     // tuỳ chọn
  "startDate": "2026-11-26",// tuỳ chọn, không sau hạn
  "description": "<p>…</p>",// tuỳ chọn, HTML
  "projectId": 2,           // tuỳ chọn; trống là việc lẻ CV-n
  "parentId": 15,           // tuỳ chọn; tạo việc con, bỏ qua projectId
  "watcherIds": [8],        // tuỳ chọn
  "checklist": ["Bản gốc", "Bản sao"] // tuỳ chọn
}
```

- Thiếu hay sai `points` → 400 `TASK_POINTS_REQUIRED`. Hạn trong quá khứ vẫn nhận (nhập việc cũ).
- Người thực hiện, người nghiệm thu, người theo dõi phải đang làm việc → 400 `TASK_PERSON_INVALID`.
- Giao cho người khác mà chọn chính người thực hiện làm người nghiệm thu → 400 `TASK_REVIEWER_INVALID`. Tự giao cho mình
  thì `source: SELF`, nút chính là **Đóng việc** (`self_close`), không qua nghiệm thu (BR-04).
- Trong dự án: phải là thành viên vai Quản lý hoặc Thành viên (Người xem → 403; không là thành viên → 404
  `TASK_PROJECT_NOT_FOUND`); dự án đã đóng → 400 `TASK_PROJECT_CLOSED`.
- Việc con: người giao, người thực hiện, quản lý dự án của việc cha (hoặc trưởng phòng của người giao, ADMIN) mới thêm
  được; việc con của việc con → 400 `TASK_SUBTASK_DEPTH`; việc cha đã đóng → 400 `TASK_PARENT_CLOSED`.

### 3.3 Chuyển trạng thái (một API cho nút, menu, kéo thẻ)

| `action` | Từ | Sang | Ghi chú |
|---|---|---|---|
| `start` | Chưa làm | Đang làm | |
| `back_to_todo` | Đang làm | Chưa làm | |
| `submit` | Chưa làm, Đang làm | Chờ nghiệm thu | Ghi `firstSubmittedAt` lần đầu, `lastSubmittedAt` mỗi lần; còn việc con mở thì có `warning` |
| `accept` | Chờ nghiệm thu | Hoàn thành | `qualityScore` 1–5 tuỳ chọn; người thay nghiệm thu thì nhật ký ghi `onBehalfOf` |
| `return` | Chờ nghiệm thu | Đang làm | Bắt buộc `reason`; `returnCount + 1` |
| `self_close` | Chưa làm, Đang làm | Hoàn thành | Chỉ việc tự giao; `selfClosed: true` |
| `reopen` | Hoàn thành | Đang làm | Bắt buộc `reason`; `returnCount + 1`; giữ `firstSubmittedAt` |
| `cancel` | Mọi trạng thái trừ Hoàn thành, Đã huỷ | Đã huỷ | Bắt buộc `reason`; việc con chưa xong bị huỷ theo cùng lý do |

Sai người → 403 `TASK_ACTION_NOT_ALLOWED` kèm câu lý do (cùng câu với `columnRules`). Việc không còn ở trạng thái cho phép →
409 `TASK_STATUS_INVALID`, `error.details.task` là bản rút gọn mới. Thiếu lý do → 400 `TASK_REASON_REQUIRED`. Điểm chất lượng
sai hay gửi kèm thao tác khác `accept` → 400 `TASK_QUALITY_INVALID`.

### 3.4 Kéo thẻ (`POST /tasks/:id/move`)

- Đổi cột: `{ status, version, reason?, qualityScore? }`. Server đổi cột thành thao tác như bảng trên (Chờ nghiệm thu →
  Hoàn thành là `accept`, Chờ nghiệm thu → Đang làm là `return`, Hoàn thành → Đang làm là `reopen`, sang Đã huỷ là `cancel`,
  Chưa làm/Đang làm → Hoàn thành chỉ với việc tự giao) rồi đi đúng luật như `transition`. Kéo việc người khác giao sang Hoàn
  thành → 403 với câu "…bạn bấm Báo xong…" (S-03). Không có đường đi (Chờ nghiệm thu → Chưa làm, Hoàn thành → Chưa làm…)
  → 409 `TASK_STATUS_INVALID`.
- Đổi thứ tự: gửi `beforeId` (thẻ ngay trên chỗ thả) và/hoặc `afterId` (thẻ ngay dưới), có thể cùng lúc đổi cột. Thẻ cạnh
  phải ở cùng cột và cùng dự án (hoặc cùng là việc lẻ), không thì 400 `TASK_MOVE_INVALID`. Không gửi thẻ cạnh khi đổi cột thì
  thẻ xuống cuối cột.
- `board: 'my'`: chỉ đổi thứ tự riêng ở Việc của tôi (`personalOrder`), không kiểm `version`, không ảnh hưởng người khác.
  Thẻ cạnh phải là việc của chính mình ở cùng cột. Mặc định `board: 'shared'` (thứ tự chung của dự án).
- Thứ tự chung chỉ thành viên Quản lý/Thành viên của dự án (ADMIN) đổi được; người khác đổi cột được nếu đúng luật, thẻ xuống
  cuối cột.

### 3.5 Phiên bản (T-03)

Mọi thao tác ghi lên việc (`PATCH`, `transition`, `due-date`, `move` bảng chung) gửi `version` đang hiện. Người khác vừa đổi
trước → 409 `TASK_VERSION_CONFLICT`, `error.details.task` là bản mới rút gọn:

```json
{ "success": false, "error": { "code": "TASK_VERSION_CONFLICT",
  "message": "Việc vừa được người khác thay đổi. Màn hình đã cập nhật bản mới, bạn xem lại rồi làm tiếp.",
  "details": { "task": { "id": 41, "code": "HQ-12", "version": 5, "status": "IN_REVIEW", "statusLabel": "Chờ nghiệm thu",
    "dueDate": "2026-11-28", "assigneeId": 6, "reviewerId": 5, "boardOrder": 3000, "updatedAt": "…" } } } }
```

Giao diện đặt thẻ về đúng cột mới theo `details.task.status`, hiện `message`, rồi tải lại việc nếu cần.

### 3.6 Đổi hạn

`POST /tasks/:id/due-date { dueDate, reason, version }`: người giao, quản lý dự án, trưởng phòng của người giao, ADMIN.
Người thực hiện gọi → 403 "Người thực hiện không tự đổi hạn. Bạn nhờ người giao đổi giúp." Thiếu lý do → 400
`TASK_REASON_REQUIRED`; trùng hạn cũ → 400 `TASK_DUE_UNCHANGED`; hạn mới trước ngày bắt đầu → 400 `TASK_DATE_INVALID`.
`originalDueDate` không đổi, `dueChangeCount + 1`, thêm một dòng `dueChanges`, người thực hiện nhận N-08.

---

## 4. Bình luận, nhắc tên, file

| Method | Path | Body | Trả |
|---|---|---|---|
| POST | `/v1/tasks/:id/comments` | `{ body, mentionIds?, attachmentIds? }` | 201 `TaskCommentDto` |
| PATCH | `/v1/tasks/:id/comments/:commentId` | `{ body, mentionIds? }` | `TaskCommentDto` |
| DELETE | `/v1/tasks/:id/comments/:commentId` | | 204 (xoá mềm) |
| GET | `/v1/tasks/:id/mentionable?q=` | | `[{ id, fullName, avatarUrl, departmentName, canView }]` tối đa 8 |
| POST | `/v1/tasks/:id/attachments` | multipart `file` | 201 `TaskAttachmentDto` |
| GET | `/v1/tasks/:id/attachments/:attachmentId/url` | | `{ url, expiresIn: 3600 }` |
| DELETE | `/v1/tasks/:id/attachments/:attachmentId` | | 204 (xoá mềm) |

```json
{ "id": 88, "taskId": 41, "author": { "id": 5, "fullName": "Lê Thị Lan", "avatarUrl": null },
  "body": "<p>Anh <span data-type=\"mention\" data-id=\"6\">@Đức</span> xem giúp bản sao</p>",
  "mentionIds": [6], "editedAt": null, "createdAt": "…", "deleted": false,
  "attachments": [], "canEdit": true }
```

- `body` là HTML từ Tiptap, server lưu nguyên, tối đa 20.000 ký tự; web lọc DOMPurify khi hiển thị. Không có chữ và không có
  file → 400 `TASK_COMMENT_EMPTY`.
- `mentionIds` tối đa 20 → quá thì 400 `TASK_MENTION_LIMIT`. Người được nhắc mà **không xem được việc** thì không nhận thông
  báo và không báo lỗi (T-06). Trước khi gửi, ô gợi ý đã trả `canView: false` để giao diện cảnh báo kèm nút "Thêm làm người
  theo dõi" (`POST /tasks/:id/watchers`).
- Gợi ý nhắc tên: tìm không dấu theo họ tên hoặc mã nhân viên, người đang làm việc; không có `q` thì gợi ý người dính vào việc.
  Xếp người dính vào việc trước, rồi thành viên dự án hoặc cùng phòng người thực hiện, rồi người khác. Không gợi ý chính mình.
- Bình luận đã xoá vẫn trả trong hoạt động với `deleted: true`, `body: null`, không có file, để giao diện hiện "Bình luận đã
  xoá". Chỉ người viết sửa, xoá (`canEdit`).
- File: PDF, ảnh JPG/PNG/GIF/WebP, Word, Excel, PowerPoint, ZIP; tối đa **20 MB** mỗi file, 50 file mỗi việc. Kiểm loại bằng
  chữ ký file, file `.exe` đổi đuôi `.pdf` → 400 `TASK_FILE_TYPE` (T-07). Quá cỡ → 400 `TASK_FILE_TOO_LARGE` hoặc 413 từ
  bước nhận file. Tên file giữ dấu tiếng Việt.
- Gắn file vào bình luận: tải từng file lên trước (`POST …/attachments`), rồi gửi `attachmentIds` trong bình luận. Chỉ gắn
  được file chính mình tải lên, chưa gắn bình luận nào → không thì 400 `TASK_ATTACHMENT_INVALID`.
- Đường dẫn file **không** có trong response; bấm file thì gọi `…/url` để lấy link ký 1 giờ. Gỡ file: người tải lên, người
  giao, ADMIN.

### 4.1 Hoạt động (`GET /tasks/:id/activity`)

```json
[ { "kind": "comment", "at": "…", "comment": { /* TaskCommentDto */ } },
  { "kind": "event", "at": "…", "event": { "id": 301, "type": "RETURNED", "typeLabel": "Trả lại",
      "actor": { "id": 5, "fullName": "Lê Thị Lan", "avatarUrl": null },
      "fromStatus": "IN_REVIEW", "fromStatusLabel": "Chờ nghiệm thu",
      "toStatus": "IN_PROGRESS", "toStatusLabel": "Đang làm",
      "payload": { "action": "return", "reason": "Thiếu bản sao công chứng" }, "createdAt": "…" } } ]
```

Loại sự kiện (`type`, có `typeLabel`): `CREATED`, `STATUS_CHANGED` (start, back_to_todo, self_close), `SUBMITTED`, `ACCEPTED`
(`payload.qualityScore`, `payload.onBehalfOf` khi nghiệm thu thay), `RETURNED`, `REOPENED`, `CANCELLED` (`payload.byParent`
khi huỷ theo việc cha), `ASSIGNEE_CHANGED`, `REVIEWER_CHANGED` (`payload.from`, `to` là id), `DUE_CHANGED` (`from`, `to`,
`reason`), `FIELD_CHANGED` (`payload.changes { field: { from, to } }`, mô tả chỉ ghi là có đổi), `ATTACHMENT_ADDED`,
`ATTACHMENT_REMOVED`.

---

## 5. Dự án

| Method | Path | Body | Ai |
|---|---|---|---|
| GET | `/v1/task-projects` | `status`, `q`, `page`, `limit` (≤100, mặc định 50) | Dự án mình là thành viên; ADMIN, DIRECTOR mọi dự án |
| POST | `/v1/task-projects` | `{ code, name, description?, departmentId?, members?: [{ employeeId, role? }] }` | Mọi người; người tạo là Quản lý dự án |
| GET | `/v1/task-projects/:id` | `:id` là id số **hoặc mã dự án** (`HQ`, không phân biệt hoa thường) | Thành viên, ADMIN, DIRECTOR; người khác 404 `TASK_PROJECT_NOT_FOUND`. Các route con của dự án chỉ nhận id số |
| PATCH | `/v1/task-projects/:id` | `{ name?, description?, departmentId? }` | Quản lý dự án, ADMIN |
| POST | `/v1/task-projects/:id/close`, `/reopen` | | Quản lý dự án, ADMIN |
| GET | `/v1/task-projects/:id/members` | | Như GET dự án |
| POST | `/v1/task-projects/:id/members` | `{ employeeId, role? }` | Quản lý dự án, ADMIN |
| PATCH | `/v1/task-projects/:id/members/:employeeId` | `{ role }` | Quản lý dự án, ADMIN |
| DELETE | `/v1/task-projects/:id/members/:employeeId` | | Quản lý dự án, ADMIN; thành viên tự rời được |

```json
{ "id": 2, "code": "HQ", "name": "Thông quan lô hàng dự án điện gió", "description": null,
  "department": { "id": 4, "name": "Thủ tục hải quan" }, "status": "ACTIVE", "statusLabel": "Đang chạy",
  "createdBy": { "id": 5, "fullName": "Lê Thị Lan", "avatarUrl": null }, "closedAt": null,
  "memberCount": 3, "openTaskCount": 12, "myRole": "MANAGER", "myRoleLabel": "Quản lý dự án", "canManage": true,
  "createdAt": "…",
  "members": [{ "employee": { "id": 5, "fullName": "Lê Thị Lan", "avatarUrl": null }, "departmentName": "Kế toán",
                "role": "MANAGER", "roleLabel": "Quản lý dự án", "inactive": false, "addedAt": "…" }],
  "taskCounts": { "TODO": 4, "IN_PROGRESS": 3, "IN_REVIEW": 1, "DONE": 10, "CANCELLED": 0 } }
```

(`members`, `taskCounts` chỉ có ở chi tiết, POST, PATCH, close, reopen.)

- `code`: 2–6 chữ cái không dấu, gõ thường thì server viết hoa; `CV` dành cho việc lẻ → 400 `TASK_PROJECT_CODE_INVALID`;
  trùng → 409 `TASK_PROJECT_CODE_EXISTS`.
- Dự án luôn còn ít nhất một Quản lý dự án: bỏ vai hay gỡ người quản lý cuối → 409 `TASK_PROJECT_LAST_MANAGER`.
- Dự án đã đóng: không thêm việc mới (400 `TASK_PROJECT_CLOSED`), việc đang có làm tiếp bình thường. Đóng lần hai, mở lại
  dự án đang chạy → 409 `TASK_PROJECT_STATUS_INVALID`.
- Thành viên phải đang làm việc → 400 `TASK_PERSON_INVALID`; đã là thành viên → 409 `TASK_PROJECT_MEMBER_EXISTS`.
- Trưởng phòng không là thành viên thì không thấy dự án trong danh sách, nhưng vẫn xem được việc của người phòng mình trong
  dự án qua Việc của phòng (`view=department`).

---

## 6. Số đếm chờ nghiệm thu

`GET /v1/approval/counts` có thêm `taskReviews`: số việc đang Chờ nghiệm thu mà người gọi là người nghiệm thu, 0 khi TASKS
không ở trạng thái dùng đầy đủ. **Không cộng vào `total`** (total là huy hiệu trang Duyệt đơn; nghiệm thu làm ở trang Công
việc). Dùng cho huy hiệu menu Công việc và ô trang chủ; danh sách tương ứng là `GET /tasks?view=review`.

---

## 7. Mã lỗi

| Mã | HTTP | Khi nào |
|---|---|---|
| `TASK_NOT_FOUND` | 404 | Số hiệu hay id không có |
| `TASK_NOT_VISIBLE` | 404 | Không xem được việc; `details { code, assignerName }`, không lộ tiêu đề |
| `TASK_ACTION_NOT_ALLOWED` | 403 | Sai người cho thao tác; `message` là câu lý do hiện thẳng |
| `TASK_STATUS_INVALID` | 409 | Việc không còn ở trạng thái cho phép; `details.task` |
| `TASK_VERSION_CONFLICT` | 409 | Lệch phiên bản; `details.task` |
| `TASK_POINTS_REQUIRED` | 400 | Thiếu hay sai thang điểm |
| `TASK_REASON_REQUIRED` | 400 | Thiếu lý do trả lại, mở lại, huỷ, đổi hạn |
| `TASK_QUALITY_INVALID` | 400 | Điểm chất lượng ngoài 1–5 hoặc gửi kèm thao tác khác nghiệm thu |
| `TASK_SUBTASK_DEPTH` | 400 | Việc con của việc con |
| `TASK_PARENT_CLOSED` | 400 | Thêm việc con vào việc đã hoàn thành, đã huỷ |
| `TASK_NOT_EDITABLE` | 400 | Sửa, đổi hạn việc đã hoàn thành hay đã huỷ; sửa danh sách kiểm tra, người theo dõi, file của việc đã huỷ |
| `TASK_PERSON_INVALID` | 400 | Người không có hoặc đã nghỉ việc |
| `TASK_REVIEWER_INVALID` | 400 | Người thực hiện tự nghiệm thu việc người khác giao |
| `TASK_DATE_INVALID` | 400 | Ngày sai, ngày bắt đầu sau hạn |
| `TASK_DUE_UNCHANGED` | 400 | Hạn mới trùng hạn cũ |
| `TASK_MOVE_INVALID` | 400 | Thẻ cạnh không ở cột đích, khác dự án |
| `TASK_MENTION_LIMIT` | 400 | Nhắc quá 20 người |
| `TASK_COMMENT_EMPTY` | 400 | Bình luận rỗng |
| `TASK_COMMENT_NOT_FOUND` | 404 | |
| `TASK_ATTACHMENT_INVALID` | 400 | `attachmentIds` không hợp lệ |
| `TASK_ATTACHMENT_NOT_FOUND` | 404 | |
| `TASK_FILE_REQUIRED`, `TASK_FILE_TOO_LARGE`, `TASK_FILE_TYPE`, `TASK_FILE_LIMIT` | 400 | File |
| `TASK_CHECKLIST_NOT_FOUND` | 404 | |
| `TASK_CHECKLIST_LIMIT` | 400 | Quá 100 mục |
| `TASK_PROJECT_NOT_FOUND` | 404 | Dự án không có hoặc không là thành viên |
| `TASK_PROJECT_CLOSED` | 400 | Thêm việc vào dự án đã đóng |
| `TASK_PROJECT_CODE_INVALID` | 400 | Mã dự án sai dạng hoặc là CV |
| `TASK_PROJECT_CODE_EXISTS` | 409 | Mã dự án trùng |
| `TASK_PROJECT_DEPARTMENT_INVALID` | 400 | Phòng chủ quản không có |
| `TASK_PROJECT_LAST_MANAGER` | 409 | Bỏ quản lý dự án cuối cùng |
| `TASK_PROJECT_MEMBER_EXISTS` | 409 | |
| `TASK_PROJECT_MEMBER_NOT_FOUND` | 404 | |
| `TASK_PROJECT_STATUS_INVALID` | 409 | Đóng dự án đã đóng, mở dự án đang chạy |
| `MODULE_NOT_SUBSCRIBED`, `MODULE_SUSPENDED`, `MODULE_READ_ONLY`, `MODULE_EXPIRED`, `MODULE_LAPSED` | 403 | Cổng module |

Lỗi kiểm dữ liệu chung (thiếu `dueDate`, sai kiểu) là 400 `BAD_REQUEST` với câu tiếng Việt có tên ô.

---

## 8. Thông báo (deep link)

Mọi thông báo của module có `category: 'TASK'`, `refType: 'task'`, `refId` là id việc, `targetUrl: '/cong-viec/<số hiệu>'`,
`actionType: 'NAVIGATE_ONLY'`. Web mở khung chi tiết việc theo số hiệu; mobile mở màn chi tiết việc bằng `refId`.

| Mã | `type` | Người nhận |
|---|---|---|
| N-01 | `TASK_ASSIGNED` | Người thực hiện mới (giao, đổi người) |
| N-02 | `TASK_MENTIONED` | Người được nhắc, xem được việc |
| N-02 | `TASK_COMMENTED` | Người liên quan, tối đa một lần mỗi 15 phút mỗi việc |
| N-03 | `TASK_REVIEW_NEEDED` | Người nghiệm thu (báo xong; nhắc lại khi chờ quá 2 ngày làm việc) |
| N-04 | `TASK_ACCEPTED` | Người thực hiện |
| N-05 | `TASK_RETURNED`, `TASK_REOPENED` | Người thực hiện, có email |
| N-06 | `TASK_CANCELLED` | Người thực hiện, người theo dõi, người làm việc con bị huỷ theo |
| N-07 | `TASK_DUE_SOON`, `TASK_OVERDUE` | 08:00 mỗi sáng: người thực hiện; quá hạn thêm người giao; một email gom mỗi người |
| N-08 | `TASK_DUE_CHANGED` | Người thực hiện |

Câu chữ: `docs/notifications/notification-content-map.md` mục "Công việc". Không gửi cho chính người làm thao tác.
Web thêm `TASK` vào bảng category và icon thông báo.

---

## 9. Kênh thời gian thực `/tasks`

Chi tiết: `docs/realtime-websocket.md` mục 2. Tóm tắt cho web:

```ts
const socket = io(`${API_BASE}/tasks`, { auth: { token }, transports: ['websocket'] });
socket.on('ready', () => socket.emit('join', { projectId }, (ack) => { /* { joined } | { code: 'NOT_A_MEMBER' } */ }));
socket.on('task.changed', ({ id, code, version, kind }) => { /* version mới hơn thì tải lại thẻ hoặc khung chi tiết */ });
socket.on('task.comment', ({ taskId, code }) => { /* đang mở khung chi tiết việc đó thì tải lại hoạt động */ });
```

Không có nội dung việc trong sự kiện: luôn gọi lại API. Phòng riêng của người dùng có sẵn khi kết nối (Việc của tôi tự cập
nhật); phòng dự án cần `join` và chỉ thành viên (hoặc ADMIN, DIRECTOR) vào được. Module tắt hẳn thì socket bị ngắt.

---

## 10. Mobile

Lô 1 chưa có màn hình mobile (F-19 để sau) nhưng mọi API dùng chung. Khi làm: Việc của tôi (`view=my`), chi tiết theo
`refId` từ thông báo (`GET /tasks/:id` nhận id số), Báo xong, Nghiệm thu, Trả lại, bình luận. Mã ô phân hệ `tsk`.

---

## 11. Kịch bản phải thử trên web (P4)

Lấy từ phiếu S-01 đến S-05 và thiết kế T-01 đến T-08:

1. S-01: nhân viên phòng B giao việc cho người phòng A, 3 điểm; người nhận thấy ở Việc của tôi và có thông báo.
2. S-02: báo xong → người giao trả lại có lý do → báo xong lại → nghiệm thu 4 sao; việc ghi trả lại 1 lần.
3. S-03: người thực hiện kéo thẻ sang Hoàn thành: cột mờ ngay khi bắt đầu kéo, hiện câu gợi ý Báo xong.
4. S-04: người giao đổi hạn có lý do; khung chi tiết hiện "hạn ban đầu …, đã đổi 1 lần"; người thực hiện không thấy nút Đổi hạn.
5. S-05, T-01: mở link việc của dự án mình không thuộc → "Bạn không xem được việc này" kèm tên người giao.
6. T-02: trưởng phòng mở Việc của phòng chỉ thấy việc người phòng mình.
7. T-03: hai trình duyệt kéo cùng một thẻ → trình duyệt sau nhận câu báo và thẻ về đúng cột mới.
8. T-04: người thực hiện không thấy nút Nghiệm thu; gọi thẳng API thì 403.
9. T-06: gõ @ gợi ý không dấu; người không xem được việc có cảnh báo và nút Thêm làm người theo dõi.
10. T-07: tải file `.exe` đổi đuôi `.pdf` → báo lỗi; file thật mở được bằng link ký.
11. T-08: công ty ở chế độ chỉ xem: xem, lọc được; nút ghi ẩn hoặc báo lỗi 403 có câu.
12. Mọi vai: ADMIN, HR (như nhân viên), DIRECTOR (xem mọi việc), MANAGER (trưởng phòng), EMPLOYEE; trạng thái rỗng, đang tải,
    lỗi; phân trang; màn 390 điểm ảnh.
