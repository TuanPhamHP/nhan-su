# Bridge: Công việc và KPI (`TASKS`), lô 1 và lô 2

Cho web `nhan-su` và mobile. Thiết kế: `docs/modules/18-tasks.md`. Phiếu yêu cầu: `docs/templates/tasks/quan-ly-cong-viec.md`.
Lô 1 là **lõi công việc**: dự án và thành viên, công việc và việc con, danh sách kiểm tra, vòng đời và nghiệm thu, đổi hạn,
huỷ, người theo dõi, bình luận nhắc tên, file, Việc của tôi, danh sách, bảng việc kéo thả, thông báo N-01 đến N-08, nhắc hạn
J-02, J-03 và kênh thời gian thực `/tasks`. **Lô 2** (mục 12 trở đi): nhóm việc, đợt và việc chờ xếp, việc định kỳ, phụ
thuộc và biểu đồ tiến độ, lịch, báo cáo tiến độ và xuất Excel, cảnh báo nghỉ việc, dự án mẫu. KPI (lô 3) ở
`docs/bridges/kpi.md`.

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
  theo vai trên từng việc và trả sẵn cho giao diện (mục 3). Mã `task:report` (DIRECTOR mặc định, ADMIN luôn có) mở báo cáo
  mọi phòng (mục 16).

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

---

# Lô 2 (26/11/2026)

Thiết kế: `docs/modules/18-tasks.md` mục 2.2, 2.5, 4.5–4.7, 10, 17 (bảng gap, kịch bản), 16 (chỗ code khác thiết kế). Mọi
route mới gắn `@RequireModule('TASKS')`: chỉ xem thì GET dùng được, POST/PATCH/DELETE 403 `MODULE_READ_ONLY`. Phạm vi xem việc
vẫn là mục 1.1; không route nào lộ việc người gọi không xem được.

## 12. Thay đổi ở dữ liệu lô 1

### 12.1 Dòng việc (`TaskListItemDto`) thêm

```json
{
  "group": { "id": 4, "name": "Giai đoạn 1" },
  "sprint": { "id": 2, "name": "Đợt 3", "status": "ACTIVE", "statusLabel": "Đang chạy" },
  "recurrenceId": null,
  "sprintMoveCount": 1,
  "addedAfterSprintStart": false,
  "dependencies": { "blockers": 1, "blocking": 0, "late": true }
}
```

- `group`, `sprint` null khi không có. Trong dự án bật đợt, việc cấp trên `sprint: null` là **việc chờ xếp**.
- `dependencies.late: true` thì hiện **dấu đỏ** trên thẻ, dòng: có việc phải chờ đang trễ (quá hạn mà chưa báo xong, hoặc hạn
  muộn hơn ngày bắt đầu của việc này). Chỉ cảnh báo, không chặn, không tự dời ngày (mục 4.5).
- `recurrenceId` khác null: việc sinh từ việc định kỳ, `source: "RECURRING"`, `sourceLabel: "Việc định kỳ"`.

### 12.2 Chi tiết (`TaskDetailDto`) thêm

```json
{
  "blockers": [{ "id": 40, "code": "HQ-11", "title": "Khảo sát kho bãi", "status": "IN_PROGRESS", "statusLabel": "Đang làm",
                 "startDate": "2026-11-27", "dueDate": "2026-11-30", "visible": true, "late": false }],
  "blocking": []
}
```

`blockers`: việc này phải chờ (việc trước). `blocking`: việc đang chờ việc này (việc sau). Người xem không xem được việc ở đầu
kia thì `title: null`, `visible: false` (chỉ hiện số hiệu). `late` ở `blockers` là việc trước trễ so với việc này; ở
`blocking` là việc này trễ so với việc sau.

### 12.3 Tạo, sửa việc; lọc

- `POST /tasks` nhận thêm `groupId`, `sprintId` (chỉ việc cấp trên trong dự án). Thêm vào đợt đang chạy thì
  `addedAfterSprintStart: true`.
- `PATCH /tasks/:id` nhận thêm `groupId`, `sprintId`; gửi `null` để bỏ nhóm, đưa về việc chờ xếp. Có `version` như mọi sửa
  khác. Ai: thành viên dự án vai Quản lý, Thành viên, ADMIN (Người xem 403). Sự kiện `GROUP_CHANGED`, `SPRINT_CHANGED`
  (`payload { from, to }` là id).
- Lỗi: `TASK_GROUP_INVALID` (việc con, việc lẻ, nhóm dự án khác, nhóm đã cất), `TASK_SPRINT_INVALID` (việc con, việc lẻ, đợt
  dự án khác, đợt đã đóng), `TASK_SPRINT_DISABLED` (dự án chưa bật đợt).
- `GET /tasks`, `/tasks/board`, `/tasks/timeline`, `/tasks/calendar` nhận thêm `groupId`, `sprintId`, `recurrenceId`,
  `backlog=true` (việc chờ xếp: việc cấp trên chưa đóng, chưa vào đợt, của dự án bật đợt; dùng kèm `projectId`).

### 12.4 Dự án

`TaskProjectDto` thêm `useSprints`, `isSample`, `wipLimits` (`{ TODO?, IN_PROGRESS?, IN_REVIEW? }` hoặc null).
`PATCH /task-projects/:id` nhận thêm `useSprints` (tắt khi đang có đợt chạy → 409 `TASK_SPRINT_STATE_INVALID`) và `wipLimits`
(số 1–999 mỗi cột, `null` để bỏ; chỉ để cảnh báo, server không chặn kéo thẻ).

## 13. Nhóm việc (F-14) và đợt (F-12)

| Method | Path | Body | Ai |
|---|---|---|---|
| GET | `/v1/task-projects/:id/groups` | | Thành viên, ADMIN, DIRECTOR |
| POST | `/v1/task-projects/:id/groups` | `{ name, sortOrder? }` | Quản lý dự án, ADMIN |
| PATCH | `/v1/task-projects/:id/groups/:groupId` | `{ name?, sortOrder?, archived? }` | Quản lý dự án, ADMIN |
| GET | `/v1/task-projects/:id/sprints` | | Thành viên, ADMIN, DIRECTOR |
| POST | `/v1/task-projects/:id/sprints` | `{ name, goal?, startDate, endDate }` | Quản lý dự án, ADMIN |
| PATCH | `/v1/task-projects/:id/sprints/:sprintId` | `{ name?, goal?, startDate?, endDate? }` | Như trên, đợt chưa đóng |
| POST | `/v1/task-projects/:id/sprints/:sprintId/start` | | Như trên |
| POST | `/v1/task-projects/:id/sprints/:sprintId/close` | `{ moveTo?: 'next' \| 'new' \| 'backlog', newSprint? }` | Như trên |

```json
// Nhóm việc
{ "id": 4, "projectId": 2, "name": "Giai đoạn 1", "sortOrder": 1, "archived": false,
  "taskCount": 8, "doneCount": 5, "points": 21 }
// Đợt
{ "id": 2, "projectId": 2, "name": "Đợt 3", "goal": null, "startDate": "2026-12-01", "endDate": "2026-12-14",
  "status": "ACTIVE", "statusLabel": "Đang chạy", "startedAt": "…", "closedAt": null,
  "taskCounts": { "TODO": 2, "IN_PROGRESS": 1, "IN_REVIEW": 1, "DONE": 4, "CANCELLED": 0 },
  "points": { "TODO": 5, "IN_PROGRESS": 3, "IN_REVIEW": 2, "DONE": 13, "CANCELLED": 0 }, "totalPoints": 23 }
// Đóng đợt (201)
{ "sprint": { /* đợt vừa đóng */ }, "movedTo": { /* đợt nhận việc */ } , "moved": ["HQ-12", "HQ-15"] }
```

- Nhóm việc: `taskCount`, `doneCount`, `points` chỉ đếm việc cấp trên chưa huỷ ("5/8 xong" ở tổng quan). Cất nhóm
  (`archived: true`) thì việc cũ giữ nhóm, không thêm việc mới vào được; nhóm đã cất xếp cuối danh sách. Tên trùng trong dự án →
  409 `TASK_GROUP_NAME_EXISTS`. Không có xoá nhóm.
- Đợt: trạng thái `PLANNED` (Chưa bắt đầu), `ACTIVE` (Đang chạy), `CLOSED` (Đã đóng). Mỗi dự án tối đa **một** đợt đang chạy:
  bắt đầu khi đã có đợt chạy → 409 `TASK_SPRINT_ALREADY_ACTIVE` (hai người bấm cùng lúc thì người sau nhận lỗi này, T-10). Bắt
  đầu đợt đang chạy hay đã đóng, đóng đợt chưa chạy hay đã đóng, sửa đợt đã đóng → 409 `TASK_SPRINT_STATE_INVALID`.
- Đóng đợt: việc cấp trên **chưa Hoàn thành** (kể cả Chờ nghiệm thu) chuyển tới `next` (đợt chưa bắt đầu có ngày bắt đầu sớm
  nhất), `new` (đợt mới tạo từ `newSprint { name, goal?, startDate, endDate }`, trạng thái Chưa bắt đầu) hoặc `backlog` (về việc
  chờ xếp). Không gửi `moveTo`: `next` nếu có đợt kế, không thì `backlog`. `next` mà không có đợt kế, `new` thiếu `newSprint` →
  400 `TASK_SPRINT_INVALID`. Mỗi việc bị chuyển `sprintMoveCount + 1`, `version + 1` (socket `task.changed kind: 'sprint'`).
  Hộp Đóng đợt nên liệt kê việc chưa xong bằng `GET /tasks?sprintId=<id>&status=TODO,IN_PROGRESS,IN_REVIEW&topLevel=true`.
- Đợt có `points` theo trạng thái cho đầu đợt; `totalPoints` không tính việc huỷ.

## 14. Việc định kỳ (F-11)

| Method | Path | Body | Ai |
|---|---|---|---|
| GET | `/v1/task-recurrences` | `isActive`, `projectId`, `assigneeId`, `page`, `limit` (≤100, mặc định 50) | Quy tắc mình đặt, làm, nghiệm thu, quy tắc thuộc dự án mình là Quản lý dự án; ADMIN, DIRECTOR mọi quy tắc |
| POST | `/v1/task-recurrences` | Xem dưới | Ai cũng đặt được; người đặt là người giao |
| GET | `/v1/task-recurrences/:id` | | Như GET danh sách; người khác 404 `TASK_RECURRENCE_NOT_FOUND` |
| PATCH | `/v1/task-recurrences/:id` | Như POST, mọi trường tuỳ chọn, không đổi dự án; `endDate: null` để bỏ | Người đặt, Quản lý dự án của dự án đó, ADMIN (người làm 403). Quy tắc thuộc dự án: người sửa phải còn là Quản lý hoặc Thành viên dự án (403 `TASK_PROJECT_NOT_CONTRIBUTOR`) |
| POST | `/v1/task-recurrences/:id/pause`, `/resume` | | Như PATCH (dừng không cần là thành viên; chạy lại thì cần). J-01 tự dừng quy tắc của dự án khi người giao không còn là Quản lý, Thành viên dự án (`pausedReason`) |

```json
POST /v1/task-recurrences
{ "title": "Nộp báo cáo thuế tháng", "assigneeId": 6, "points": 3,
  "frequency": "MONTHLY", "dayOfMonth": 20, "leadDays": 3, "startDate": "2026-12-01",
  "reviewerId": 5, "priority": "HIGH", "projectId": 2, "watcherIds": [8], "checklist": ["Đối chiếu sổ"],
  "interval": 1, "endDate": null }
```

| `frequency` | Nhãn | Trường bắt buộc |
|---|---|---|
| `WEEKLY` | Hằng tuần | `weekdays` (1 thứ Hai … 7 Chủ nhật, ít nhất một) |
| `MONTHLY` | Hằng tháng | `dayOfMonth` 1–31 |
| `QUARTERLY` | Hằng quý | `dayOfMonth`, `monthOfPeriod` 1–3 (tháng thứ mấy trong quý) |
| `YEARLY` | Hằng năm | `dayOfMonth`, `monthOfPeriod` 1–12 |

- `interval` 1–12 (mỗi n tuần, tháng, quý, năm, đếm từ tuần, tháng, quý, năm chứa `startDate`). `leadDays` 0–60: việc xuất hiện
  từ ngày hạn trừ số ngày này. Ngày 31 ở tháng ngắn lấy **ngày cuối tháng** (tháng 2 ra 28 hoặc 29, T-12).
- Trả về: mọi trường trên (gồm `description`, `watcherIds`, `checklist`), `createdAt`, `frequencyLabel`, `priorityLabel`, `project`, `assigner`/`assignee`/`reviewer` (kèm `inactive`),
  `nextDueDate` (hạn lần sinh kế), `nextAppearDate` (ngày việc kế xuất hiện), `lastDueDate`, `isActive`, `pausedReason` (lý do
  hệ thống tự dừng: "Người thực hiện đã nghỉ việc", "Dự án đã đóng", "Đã hết lịch"…; null khi người dùng dừng), `upcoming`
  (tối đa 5 hạn sắp tới, rỗng khi đã dừng), `taskCount` (số việc đã sinh), `canManage`.
- J-01 06:00 mỗi sáng sinh việc (mục 8 của `docs/cron-jobs.md`): việc mới `source: RECURRING`, `recurrenceId`, người giao là người
  đặt, `startDate` là ngày xuất hiện, `originalDueDate`, `dueDate` là hạn; người thực hiện nhận thông báo "Việc định kỳ … đã đến
  kỳ". Không chờ việc kỳ trước xong (BR-08). Danh sách việc đã sinh: `GET /tasks?recurrenceId=<id>`.
- Sửa chỉ có hiệu lực từ lần sinh sau, việc đã sinh giữ nguyên. Đổi lịch thì lần kế tính lại từ hôm nay và không sinh lại hạn
  đã sinh. Chạy lại (`resume`) cũng tính từ hôm nay, không sinh bù lần đã qua lúc dừng.
- Lỗi: `TASK_RECURRENCE_INVALID` (thiếu thứ, ngày, tháng; khoảng lặp sai; ngày kết thúc trước ngày bắt đầu; không còn lần nào),
  `TASK_POINTS_REQUIRED`, `TASK_PERSON_INVALID`, `TASK_REVIEWER_INVALID`, `TASK_DATE_INVALID`, `TASK_PROJECT_CLOSED`,
  `TASK_PROJECT_NOT_FOUND`, 403 người xem dự án, 409 `TASK_RECURRENCE_STATE_INVALID` (dừng khi đã dừng, chạy khi đang chạy,
  chạy lại quy tắc hết lịch).

## 15. Phụ thuộc, biểu đồ tiến độ, lịch (F-15)

| Method | Path | Body / query | Trả |
|---|---|---|---|
| POST | `/v1/tasks/:id/dependencies` | `{ blockerId }`: việc `:id` (việc sau) chờ `blockerId` (việc trước) | 201 `TaskDetailDto` của việc sau |
| DELETE | `/v1/tasks/:id/dependencies/:blockerId` | | 204 |
| GET | `/v1/tasks/timeline` | Lọc như danh sách + `from`, `to` (bắt buộc, tối đa 370 ngày) | `{ from, to, tasks: TaskListItemDto[], links: [{ blockerId, blockedId, late }], truncated }` |
| GET | `/v1/tasks/calendar` | Lọc như danh sách + `from`, `to` (bắt buộc, tối đa 62 ngày) | `{ from, to, tasks: TaskListItemDto[], truncated }` |

- Nối phụ thuộc: người giao, người thực hiện, quản lý dự án, trưởng phòng của người giao của việc sau, hoặc thành viên dự án vai
  Quản lý, Thành viên (kéo chấm trên biểu đồ). Người nối phải xem được cả hai việc (việc trước không xem được → 404
  `TASK_NOT_VISIBLE`, không lộ tiêu đề). Người xem dự án → 403. Không đổi `version`; socket `task.changed kind: 'dependency'`
  cho cả hai việc.
- Lỗi: vòng (A chờ B rồi B chờ A, hay vòng dài hơn) → 400 `TASK_DEPENDENCY_CYCLE` (T-09); tự nối, việc sau đã hoàn thành
  hoặc đã huỷ, việc trước đã huỷ → 400 `TASK_DEPENDENCY_INVALID`; nối trùng → 409 `TASK_DEPENDENCY_EXISTS`; gỡ nối không có →
  404 `TASK_DEPENDENCY_NOT_FOUND`.
- Biểu đồ tiến độ: việc có khoảng [`startDate`, `dueDate`] giao với [`from`, `to`]; việc không có ngày bắt đầu thì chỉ xét hạn
  (vẽ một chấm ở hạn). Xếp theo ngày bắt đầu, hạn. `links` chỉ gồm đường nối giữa các việc có trong `tasks`; `late: true` vẽ
  đường đỏ. Vạch hạn ban đầu dùng `originalDueDate` khi `dueChangeCount > 0`. Tay cầm kéo đổi hạn chỉ hiện khi
  `permissions.changeDue`; thả thì mở hộp Đổi hạn (`POST /tasks/:id/due-date`, bắt buộc lý do). Gom theo nhóm việc dùng
  `group` của từng việc.
- Lịch: việc có hạn trong khoảng, xếp theo hạn rồi ưu tiên. Cả hai: Đã huỷ ẩn trừ khi lọc `status`; tối đa 500 việc
  (`truncated: true` khi còn nữa, gợi ý người dùng lọc hẹp hơn). Khoảng sai → 400 `TASK_DATE_INVALID`.

## 16. Báo cáo (F-10, F-18, RP-01..RP-03)

| Method | Path | Query | Trả |
|---|---|---|---|
| GET | `/v1/task-reports/progress` | `from`, `to` (bắt buộc, ≤370 ngày), `departmentId?`, `projectId?`, `groupId?`, `assigneeIds?` | `ProgressReportDto` |
| GET | `/v1/task-reports/progress/tasks` | Như trên + `metric` (bắt buộc), `assigneeId?`, `page`, `limit` (≤200) | `TaskListItemDto[]` + `meta` |
| GET | `/v1/task-reports/progress/export` | Như `progress` | File `.xlsx` |
| GET | `/v1/task-reports/overdue` | `departmentId?`, `projectId?`, `groupId?`, `assigneeIds?`, `page`, `limit` (≤200) | `(TaskListItemDto + daysOverdue)[]` + `meta` |
| GET | `/v1/task-reports/overdue/export` | Như trên (không phân trang, tối đa 5.000 dòng) | File `.xlsx` |
| GET | `/v1/task-reports/project/:id` | | `ProjectOverviewDto` |

**Ai xem được** (progress, overdue, export): người có `task:report` (DIRECTOR mặc định) hoặc ADMIN: mọi phòng; trưởng phòng: phòng
mình quản lý (mặc định mọi phòng mình quản lý, xin phòng khác → 403); quản lý dự án: khi lọc đúng `projectId` dự án mình quản
lý. Người khác (kể cả HR không có `task:report`) → 403 `TASK_REPORT_FORBIDDEN`. Lọc phòng theo **phòng của người thực hiện lúc
giao việc**. Mọi số chỉ gồm việc người gọi xem được (mục 1.1) và không gồm dự án mẫu. Tổng quan dự án: thành viên dự án, ADMIN,
DIRECTOR (người khác 404).

```json
// ProgressReportDto
{ "from": "2026-11-01", "to": "2026-11-30",
  "scope": { "departmentNames": ["Kế toán"], "projectId": null, "projectName": null },
  "rows": [{ "person": { "id": 6, "fullName": "Đỗ Minh Đức", "avatarUrl": null, "employeeCode": "NV002",
                         "departmentName": "Kế toán", "inactive": false },
             "counts": { "assigned": 10, "cancelled": 1, "done": 7, "onTimeOriginal": 6, "onTimeCurrent": 8,
                         "overdueOpen": 1, "returned": 2, "points": 21, "quality": 4.2, "qualityCount": 5,
                         "onTimeOriginalPct": 66.7, "onTimeCurrentPct": 88.9, "donePct": 77.8 } }],
  "total": { /* cùng dạng counts, cộng mọi dòng */ } }
```

| Ô (`metric`) | Cách tính (mục 4.7, BR-20) |
|---|---|
| `assigned` Được giao | Việc cấp trên, người khác giao, hạn ban đầu trong khoảng (gồm cả việc đã huỷ) |
| `cancelled` Đã huỷ | Được giao và đã huỷ (hiện riêng, BR-07) |
| `done` Hoàn thành | Được giao, chưa huỷ, đã nghiệm thu |
| `onTimeOriginal` | Được giao, chưa huỷ, ngày báo xong lần đầu (giờ Việt Nam) không sau hạn ban đầu |
| `onTimeCurrent` | Như trên, so với hạn hiện tại |
| `overdueOpen` Quá hạn còn mở | Được giao, chưa huỷ, đang Chưa làm hoặc Đang làm, hạn đã qua tại cuối ngày `to` (khoảng chưa hết thì tại hôm nay) |
| `returned` Bị trả lại | Được giao, chưa huỷ, đã bị trả lại hoặc mở lại ít nhất một lần |
| `points` Khối lượng | Tổng điểm việc cấp trên người khác giao **nghiệm thu trong khoảng** (BR-21) |
| `quality` Chất lượng | Trung bình điểm chất lượng của các việc ở ô `points` có chấm (`qualityCount` là số việc có chấm) |

Các tỷ lệ `…Pct` chia cho `assigned - cancelled`, null khi mẫu số 0. Việc tự giao, việc con, việc dự án mẫu không vào báo cáo.

**Bấm số ra danh sách (T-13):** `GET /task-reports/progress/tasks?…&metric=onTimeOriginal&assigneeId=6` (bỏ `assigneeId` cho dòng
tổng) trả đúng các việc làm nên con số: `meta.total` bằng con số ở mọi ô; riêng `points` là các việc làm nên tổng điểm (cộng
`points` của danh sách ra con số), `quality` là các việc có chấm.

**Excel:** file `bao-cao-tien-do-cong-viec-<from>_<to>.xlsx` (STT, Mã NV, Họ tên, Phòng, rồi đúng các cột trên kèm hai cột tỷ lệ,
dòng Tổng cuối) và `viec-qua-han-<ngày>.xlsx` (Số hiệu, Tiêu đề, Dự án, Người thực hiện, Người giao, Hạn, Hạn ban đầu, Số ngày quá
hạn, Trạng thái, Ưu tiên). Tải như các file Excel khác (`authFetch` với `responseType: 'blob'`). Không có cột nào về lương.

```json
// ProjectOverviewDto (GET /task-reports/project/:id)
{ "project": { /* TaskProjectDto */ },
  "statusCounts": { "TODO": 4, "IN_PROGRESS": 3, "IN_REVIEW": 1, "DONE": 10, "CANCELLED": 0 },
  "overdue": 2,
  "groups": [{ "id": 4, "name": "Giai đoạn 1", "taskCount": 8, "doneCount": 5, "points": 21, "archived": false, … }],
  "byAssignee": [{ "person": { … }, "open": 4, "overdue": 1 }],
  "activeSprint": { /* đợt đang chạy hoặc null */ } }
```

Số trong tổng quan dự án chỉ đếm việc cấp trên.

## 17. Dự án mẫu (D-Q4)

| Method | Path | Ai |
|---|---|---|
| POST | `/v1/task-projects/sample` | Mọi người, mỗi người một dự án mẫu (lần hai → 409 `TASK_SAMPLE_EXISTS`, `error.details.projectId`) |
| DELETE | `/v1/task-projects/:id` | Người tạo dự án mẫu, ADMIN; chỉ dự án mẫu (dự án thật → 400 `TASK_PROJECT_NOT_SAMPLE`; người khác → 403). Dự án mẫu đã có thành viên khác, việc giao cho người khác, bình luận hay file của người khác → 409 `TASK_SAMPLE_HAS_OTHERS` (đóng dự án thay vì xoá) |

Dự án mẫu (`isSample: true`, mã `MAU`, hoặc `MAUA`… khi đã có) gồm hai nhóm việc, sáu việc (một việc con, bốn đường nối phụ
thuộc, ngày trải trong 15 ngày tới) đều giao cho chính người tạo, nên không ai khác nhận thông báo. Không vào báo cáo và KPI.
Xoá là **xoá hẳn** dự án cùng mọi việc, bình luận, file của nó (dự án thật thì đóng, không xoá). Màn danh sách dự án rỗng (UI-03)
hiện nút "Tạo dự án mẫu"; dự án mẫu hiện nhãn "Dự án mẫu" và nút Xoá dự án cho người tạo.

## 18. Cảnh báo nghỉ việc

Khi HR cho một người nghỉ (`POST /employees/:id/terminate`), nếu người đó còn việc đang mở (Chưa làm, Đang làm, Chờ nghiệm thu)
mà họ làm hoặc nghiệm thu: trưởng phòng của người nghỉ nhận thông báo cho những việc đó mà trưởng phòng xem được (mục 1.1; việc người nghỉ chỉ nghiệm thu ở phòng, dự án khác thì không), người giao từng việc nhận thông báo cho
việc mình giao (trong app và email liệt kê từng việc). `type: 'TASK_OFFBOARDING_OPEN'`, `category: 'TASK'`, `refType:
'task_offboarding'`, `refId` là **id người nghỉ**, `targetUrl: '/cong-viec?assigneeIds=<id>'`. Web mở danh sách việc với
`GET /tasks?assigneeIds=<id>&status=TODO,IN_PROGRESS,IN_REVIEW` để người nhận giao lại (đổi người ở `PATCH /tasks/:id`). Hệ
thống không tự chuyển việc. Module tắt thì không cảnh báo; việc định kỳ của người nghỉ tự dừng ở lượt J-01 kế tiếp
(`pausedReason`).

## 19. Thông báo, socket lô 2

| `type` | Khi | Người nhận |
|---|---|---|
| `TASK_ASSIGNED` (tiêu đề "Việc định kỳ … đã đến kỳ") | J-01 sinh việc định kỳ | Người thực hiện |
| `TASK_OFFBOARDING_OPEN` | Cho nghỉ người còn việc mở | Trưởng phòng của người nghỉ, người giao |

Socket `task.changed` thêm `kind: 'dependency'` (nối, gỡ phụ thuộc) và `kind: 'sprint'` (việc đổi đợt khi đóng đợt). Việc định kỳ
vừa sinh phát `kind: 'created'`.

## 20. Mã lỗi lô 2

| Mã | HTTP | Khi nào |
|---|---|---|
| `TASK_GROUP_NOT_FOUND` | 404 | Nhóm không có trong dự án |
| `TASK_GROUP_NAME_EXISTS` | 409 | Tên nhóm trùng trong dự án |
| `TASK_GROUP_INVALID` | 400 | Gắn nhóm cho việc con, việc lẻ; nhóm dự án khác; nhóm đã cất |
| `TASK_SPRINT_NOT_FOUND` | 404 | Đợt không có trong dự án |
| `TASK_SPRINT_DISABLED` | 400 | Dự án chưa bật đợt |
| `TASK_SPRINT_ALREADY_ACTIVE` | 409 | Đã có đợt đang chạy (T-10) |
| `TASK_SPRINT_STATE_INVALID` | 409 | Bắt đầu, đóng, sửa đợt sai trạng thái; tắt đợt khi đang có đợt chạy |
| `TASK_SPRINT_INVALID` | 400 | Đưa việc con, việc lẻ vào đợt; đợt dự án khác, đã đóng; đóng đợt `next` không có đợt kế, `new` thiếu `newSprint` |
| `TASK_RECURRENCE_NOT_FOUND` | 404 | Không có, hoặc không liên quan |
| `TASK_RECURRENCE_INVALID` | 400 | Quy tắc lặp sai, không còn lần nào |
| `TASK_RECURRENCE_STATE_INVALID` | 409 | Dừng khi đã dừng, chạy khi đang chạy, chạy lại khi hết lịch |
| `TASK_DEPENDENCY_CYCLE` | 400 | Nối thành vòng (T-09) |
| `TASK_DEPENDENCY_INVALID` | 400 | Tự nối; việc sau đã đóng; việc trước đã huỷ |
| `TASK_DEPENDENCY_EXISTS` | 409 | Nối trùng |
| `TASK_DEPENDENCY_NOT_FOUND` | 404 | Gỡ nối không có |
| `TASK_REPORT_FORBIDDEN` | 403 | Không đủ phạm vi xem báo cáo (mục 16) |
| `TASK_SAMPLE_EXISTS` | 409 | Đã có dự án mẫu; `details.projectId` |
| `TASK_PROJECT_NOT_SAMPLE` | 400 | Xoá dự án thật |
| `TASK_SAMPLE_HAS_OTHERS` | 409 | Xoá dự án mẫu đã có dữ liệu của người khác |

## 21. Kịch bản phải thử trên web (P4 lô 2)

Lấy từ phiếu S-06..S-08, thiết kế T-09..T-13 và `docs/modules/18-tasks.md` mục 17.2:

1. F-14: quản lý dự án tạo hai nhóm, giao việc vào nhóm, đổi nhóm trên danh sách; tổng quan dự án hiện "x/y xong" mỗi nhóm; cất
   nhóm thì không chọn được khi tạo việc; người xem dự án không đổi được nhóm.
2. F-12, S-08: bật đợt ở cài đặt dự án; màn Việc chờ xếp và Đợt; kéo việc vào đợt (hoặc menu Đưa vào đợt); bắt đầu đợt (hai
   trình duyệt bấm cùng lúc → một bên báo lỗi, T-10); đóng đợt còn 2 việc chưa xong → hộp liệt kê 2 việc và nơi chuyển, chúng
   sang đợt kế, thẻ hiện "chuyển đợt 1 lần"; tắt đợt khi đang chạy báo lỗi có câu.
3. F-11, S-06, T-12: đặt "ngày 31 hằng tháng" thấy các hạn sắp tới có 28 hoặc 29/02; dừng, chạy lại; người thực hiện thấy việc
   định kỳ xuất hiện đúng ngày báo trước, có nhãn "Việc định kỳ".
4. F-15, T-09: kéo chấm nối B chờ A trên biểu đồ tiến độ; nối A chờ B báo lỗi vòng; việc trước trễ thì đường nối đỏ, thẻ việc sau
   có dấu đỏ; người không có quyền đổi hạn không thấy tay cầm; màn hẹp thay biểu đồ bằng danh sách theo hạn.
5. Lịch: tháng hiện việc theo hạn, đổi tháng, lọc theo người, dự án.
6. F-10, S-07, T-13: trưởng phòng mở báo cáo tháng phòng mình; bấm từng ô số ra danh sách đúng bằng số; xin phòng khác bị chặn
   có câu; DIRECTOR thấy mọi phòng; nhân viên thường không thấy menu báo cáo (hoặc 403 có câu).
7. F-18: xuất Excel tiến độ và việc quá hạn, mở file thấy đúng các cột đang xem.
8. D-Q4: danh sách dự án rỗng có nút Tạo dự án mẫu; mở dự án mẫu thử đủ bốn chế độ xem; xoá dự án mẫu; dự án mẫu không vào báo cáo.
9. Cảnh báo nghỉ việc: thông báo "Cần giao lại việc của …" mở đúng danh sách việc của người nghỉ.
10. Chỉ xem: báo cáo, tiến độ, lịch xem được; nút tạo nhóm, đợt, việc định kỳ, nối phụ thuộc, dự án mẫu ẩn hoặc báo 403 có câu.
11. Mọi vai: ADMIN, HR, DIRECTOR, MANAGER (trưởng phòng), EMPLOYEE; rỗng, đang tải, lỗi; màn 390 điểm ảnh.

