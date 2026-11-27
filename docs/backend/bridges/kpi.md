# Bridge: KPI (module `TASKS`, lô 3)

Cho web `nhan-su` và mobile. Thiết kế: `docs/modules/18-tasks.md` mục 2.6, 4.8, 5.4, 7, 8, 18. Phiếu yêu cầu:
`docs/templates/tasks/quan-ly-cong-viec.md` (F-20 đến F-29). Phần công việc ở `docs/bridges/tasks.md`.

**KPI chỉ xem và xuất** (Q-14): điểm và xếp loại. Không có trường, API hay chữ nào về lương, thưởng, hệ số; giao diện cũng
không được hiện chữ nào như vậy.

Mọi response bọc `{ success, data }` (danh sách thêm `meta { page, limit, total, totalPages }`), lỗi là
`{ success: false, error: { code, message, details? } }`. `message` là câu tiếng Việt đời thường, hiện thẳng cho người dùng.
Số là số JSON (điểm `98.1`, giao diện hiện `98,1`). Ngày thuần dạng `YYYY-MM-DD`, thời điểm dạng ISO UTC.

---

## 1. Module, quyền, ai xem được gì

- Dùng chung module `TASKS` với phần công việc: chưa cấp 403 `MODULE_NOT_SUBSCRIBED`, tắt 403 `MODULE_SUSPENDED`. **Chỉ xem**:
  mọi GET dùng được (KPI của tôi, phiếu, kết quả, xuất Excel); mọi POST, PATCH 403 `MODULE_READ_ONLY`; J-04, J-05 dừng.
- Mã quyền `kpi:manage` (HR mặc định, ADMIN luôn có): cài đặt (UI-12), kỳ đánh giá (UI-13), chốt, công bố, mở lại, đổi người
  chấm, xem mọi phiếu. Người không có mã gọi các route này nhận 403 `KPI_FORBIDDEN`.
- **Người chấm** (D-Q6) chụp vào phiếu lúc mở kỳ: quản lý trực tiếp (`Employee.managerId`, đang làm), không có thì trưởng phòng
  của phòng người đó, trưởng phòng và người không có cả hai thì giám đốc đang làm có mã nhỏ nhất (không phải chính mình),
  không còn giám đốc nào thì ADMIN. HR đổi được người chấm khi phiếu chưa gửi đánh giá.
- **Ai xem được một phiếu:** chính nhân viên, người chấm, người có `kpi:manage`, ADMIN, DIRECTOR. Người khác (kể cả trưởng
  phòng không phải người chấm) nhận 404 `KPI_REVIEW_NOT_FOUND`, không lộ phiếu có tồn tại. Danh sách lọc cùng điều kiện.
- **Kết quả kỳ, kết quả năm, xuất Excel:** `kpi:manage`, ADMIN, DIRECTOR mọi phòng; trưởng phòng (`Department.managerId`)
  chỉ phòng mình; người khác 403 `KPI_FORBIDDEN`.
- Người có `kpi:manage` không tự chỉnh, chốt, công bố, mở lại hay đổi người chấm phiếu **của chính mình**: 403
  `KPI_REVIEW_SELF` (người có quyền khác làm thay).
- `GET /approval/counts` thêm `kpiReviews`: số phiếu Chờ cấp trên đánh giá mà người gọi chấm; 0 khi `TASKS` không `ENABLED`;
  **không** cộng vào `total` (đánh giá làm ở trang KPI, không ở trang Duyệt đơn).

## 2. Các bước của phiếu (F-26, Q-23 không có tự đánh giá)

| `status` | Nhãn | Ai làm gì | Sang bước sau |
|---|---|---|---|
| `OPEN` | Đang mở | Hệ thống tính số tự động mỗi đêm (J-04); nhân viên xem điểm tạm tính (F-28). Không ai sửa dòng | J-05 sáng hôm sau ngày cuối kỳ: tính lần cuối rồi sang `MANAGER_REVIEW`, người chấm nhận N-22 |
| `MANAGER_REVIEW` | Chờ cấp trên đánh giá | Người chấm chấm chỉ tiêu nhập tay, chỉnh số tự động có lý do, ghi chú, nhận xét chung. J-04 vẫn tính lại số gốc | `POST …/submit`: khoá số tự động, sang `FEEDBACK`, hạn phản hồi = lúc gửi + `feedbackDays` (mặc định 3) ngày, nhân viên nhận N-23 |
| `FEEDBACK` | Chờ phản hồi | Nhân viên `POST …/feedback` | Phản hồi (đồng ý hay không) thì sang `PENDING_FINAL`; quá hạn thì J-05 tự chuyển (sự kiện `FEEDBACK_EXPIRED`) |
| `PENDING_FINAL` | Chờ chốt | HR sửa dòng (trước khi chốt), `finalize` (khoá điểm), `publish`. Nhân viên **vẫn gửi thêm phản hồi được** | `POST …/publish`: `PUBLISHED`, nhân viên nhận N-24 |
| `PUBLISHED` | Đã công bố | Chỉ xem | `POST …/reopen` (bắt buộc lý do) về `PENDING_FINAL` |

Kỳ (`KpiPeriod.status`): `OPEN` Đang mở → `REVIEWING` Đang đánh giá (J-05 chuyển phiếu) → `CLOSED` Đã công bố (khi phiếu cuối
cùng được công bố; mở lại một phiếu thì về `REVIEWING`).

Mọi thao tác sai bước trả 409 `KPI_REVIEW_STEP_INVALID` kèm `details.status` (T-16). Hai người bấm cùng lúc: người sau nhận
409 `KPI_REVIEW_STEP_INVALID` với `details.status = 'CHANGED'` và câu "Phiếu vừa được người khác chuyển bước…", giao diện tải
lại phiếu. Mỗi phiếu trả sẵn `permissions` để giao diện ẩn nút (mục 4.3), không tự tính luật.

## 3. Cách tính (BR-20 đến BR-28)

- **Tỷ lệ hoàn thành** (`completionPct`): càng cao càng tốt = kết quả / mức giao; càng thấp càng tốt = mức giao / kết quả (kết
  quả 0 là tốt nhất, nhận mức trần); đạt hoặc không đạt = 100 hoặc 0 (nhập 1 là đạt, 0 là không đạt); theo mốc = tra bảng
  mốc. Hai kiểu tỷ lệ chặn ở mức trần (mặc định 120%) và bằng 0 dưới mức sàn.
- **Điểm dòng** = tỷ lệ × trọng số hiệu lực / 100. **Tổng điểm** = tổng điểm dòng, làm tròn một chữ số. **Xếp loại** theo thang
  chụp vào kỳ lúc mở (A từ 110, B từ 95, C từ 80, D dưới 80 mặc định). Thang mới không đổi kỳ đã mở (T-18).
- **Không áp dụng** (`applicable: false`, BR-26): người không có việc nào trong kỳ thì mọi chỉ tiêu công việc không áp dụng;
  chất lượng không áp dụng khi chưa việc nào có điểm chất lượng; tỷ lệ trả lại khi chưa việc nào được nghiệm thu; đúng hạn khi
  không có việc được đếm; chuyên cần khi kỳ không có lịch làm việc nào. Trọng số của dòng không áp dụng chia lại theo tỷ lệ cho
  dòng còn lại (`effectiveWeight`).
- **Mức giao hiệu lực** (`effectiveTarget`, BR-27): khối lượng đã nghiệm thu và số việc hoàn thành nhân `workDaysRatio` khi
  người đó làm thiếu ngày (vào giữa kỳ, nghỉ phép): ngày thứ Hai–thứ Sáu không phải ngày lễ từ ngày vào làm (hoặc đầu kỳ) tới
  cuối kỳ, trừ ngày nghỉ phép, chia cho ngày làm việc của cả kỳ.
- **Tám chỉ tiêu tự động** (`autoKey`), đếm theo đúng hàm của báo cáo tiến độ (`docs/bridges/tasks.md` mục 16) nên số khớp báo
  cáo: việc cấp trên, người khác giao, không thuộc dự án mẫu; đúng hạn xét ngày báo xong lần đầu; khối lượng, chất lượng, trả
  lại tính vào kỳ có ngày nghiệm thu.

| `autoKey` | Tên | Kết quả |
|---|---|---|
| `TASK_ON_TIME_ORIGINAL` | Tỷ lệ đúng hạn theo hạn ban đầu | % việc được đếm báo xong không muộn hơn hạn ban đầu |
| `TASK_ON_TIME_CURRENT` | Tỷ lệ đúng hạn theo hạn hiện tại | Như trên, so với hạn hiện tại |
| `TASK_POINTS_ACCEPTED` | Khối lượng đã nghiệm thu | Tổng điểm khối lượng việc nghiệm thu trong kỳ |
| `TASK_QUALITY_AVG` | Chất lượng nghiệm thu | Trung bình điểm chất lượng 1–5 |
| `TASK_RETURN_RATE` | Tỷ lệ việc bị trả lại | % việc nghiệm thu trong kỳ từng bị trả lại; theo mốc ≤10% → 100, ≤20% → 80, ≤30% → 50, trên → 0 |
| `TASK_DONE_COUNT` | Số việc hoàn thành | Số việc nghiệm thu trong kỳ |
| `TASK_OVERDUE_OPEN` | Việc quá hạn còn mở | Việc được đếm chưa báo xong đã quá hạn hiện tại |
| `ATTENDANCE` | Chuyên cần | 100 − 2 × số lần đi muộn − 5 × số ngày vắng không phép, trong 0–100; số liệu đã trừ giải trình, bù công đã duyệt (hàm tính công của báo cáo công, D-Q7) |

Ví dụ S-20 (kpi-research mục 7.4): đúng hạn 75 trên mức 90, khối lượng 46 trên 40, chất lượng 4,2 trên 4, trả lại 16,7%,
chuyên cần 96, trọng số 30/30/20/10/10 → 25,0 + 34,5 + 21,0 + 8,0 + 9,6 = **98,1 điểm, B**.

## 4. Dữ liệu

### 4.1 Dòng danh sách phiếu (`KpiReviewListItemDto`)

`id`, `period { id, name, type, startDate, endDate, status }`, `employee { id, fullName, employeeCode, avatarUrl }`,
`department { id, name } | null` (phòng lúc mở kỳ), `reviewer { id, fullName, employeeCode, avatarUrl }`,
`template { id, name }`, `templateVersion`, `status`, `statusLabel`, `totalScore | null` (tạm tính khi chưa gửi đánh giá),
`grade | null`, `computedAt | null` ("Tính lúc …"), `reviewedAt`, `feedbackDueAt`, `finalizedAt`, `publishedAt`,
`employeeInactive` (người có phiếu đã nghỉ việc). Ảnh đại diện đã ký sẵn.

### 4.2 Chi tiết phiếu (`KpiReviewDetailDto` = dòng danh sách + các trường sau)

| Trường | Ý nghĩa |
|---|---|
| `workDaysRatio` | Tỷ lệ ngày công (0–1), null khi chưa tính |
| `scoreComplete` | Mọi dòng áp dụng đã có kết quả; `false` thì tổng điểm là tạm tính (còn chỉ tiêu nhập tay chưa chấm) |
| `grades` | Thang của kỳ, cao xuống thấp `[{ label, minScore }]` |
| `reviewerComment`, `employeeFeedback`, `feedbackAgreed`, `feedbackAt` | Nhận xét của người chấm, phản hồi của nhân viên |
| `finalizedBy { id, fullName } \| null`, `reopenCount` | Người chốt, số lần mở lại |
| `lines[]` | Mục 4.3 |
| `events[]` | `{ id, type, actor { id, fullName } \| null, payload, createdAt }`; `type`: `CREATED`, `REVIEW_STARTED`, `LINE_UPDATED`, `SUBMITTED`, `FEEDBACK`, `FEEDBACK_EXPIRED`, `FINALIZED`, `PUBLISHED`, `REOPENED`, `REVIEWER_CHANGED`, `EMPLOYEE_TERMINATED`; `actor` null là hệ thống. `REVIEWER_CHANGED` có `payload { from, to }` là **id** người chấm cũ, mới (tên tra trong danh bạ) |
| `permissions` | `canScore`, `canSubmit`, `canFeedback`, `canFinalize`, `canPublish`, `canReopen`, `canChangeReviewer` |
| `taskStats` | Số việc của nhân viên (mục 13.2): `{ open, inReview, overdue, acceptedInPeriod }` |

### 4.3 Dòng chỉ tiêu (`KpiReviewLineDto`)

Cấu hình chụp lúc mở kỳ (BR-28, sửa danh mục hay mẫu về sau không đổi phiếu): `indicatorId`, `name`, `unit`, `direction`
(+ `directionLabel`), `source` (`AUTO` | `MANUAL`), `autoKey`, `manualScale` (chấm 1–5 bằng năm nút), `capPercent`,
`floorPercent`, `bands`, `target`, `weight`. Kết quả: `effectiveTarget`, `effectiveWeight`, `autoValue` (số hệ thống tính),
`value` (số dùng để chấm), `adjusted` + `adjustReason` + `adjustedBy` (số tự động đã chỉnh: hiện `autoValue` gạch ngang, `value`
và lý do), `applicable`, `notApplicableReason` (mục 13.1), `completionPct`, `score`, `reviewerNote`, `hasEvidence` (số gạch
chân, bấm mở bằng chứng).

### 4.4 Bằng chứng (`GET /kpi/reviews/:id/lines/:lineId/evidence`, F-24)

- `kind: 'tasks'`: `total` (số việc xét), `matched` (số việc đạt), `items[] { id, code, title, canView, matched, status,
  points, qualityScore, returnCount, originalDueDate, dueDate, firstSubmittedAt, acceptedAt }`. Việc người xem không xem được
  (phạm vi xem việc ở `docs/bridges/tasks.md` mục 1.1) có `title: null`, `canView: false`: hiện số hiệu và ngày, không mở
  được. Đúng hạn: tập xét là việc được đếm, `matched` là việc đúng hạn. Khối lượng, số việc hoàn thành: việc nghiệm thu. Chất
  lượng: việc có điểm. Trả lại: việc nghiệm thu, `matched` là việc từng bị trả lại. Quá hạn: việc quá hạn còn mở.
- Từ 26/11/2026 hạn và điểm của công việc không bắt buộc: `points: number | null` (null cộng 0 vào khối lượng),
  `originalDueDate`, `dueDate: string | null` (việc không hạn xếp vào kỳ theo ngày tạo, không bao giờ trễ hay quá hạn). Giao
  diện hiện "Chưa có hạn", "Chưa có điểm".
- `kind: 'attendance'`: `lateCount`, `lateDays[]`, `absentDays[]`, `workingDays`.
- `kind: 'none'`: chỉ tiêu nhập tay.

Bằng chứng được lưu cùng lần tính, nên sau khi gửi đánh giá (số đã khoá) danh sách vẫn khớp con số.

### 4.5 Kỳ (`KpiPeriodDto`, `KpiPeriodDetailDto`)

`id`, `type` (`MONTH` | `QUARTER`), `typeLabel`, `name` ("Tháng 10/2026", "Quý IV/2026"), `startDate`, `endDate`, `status`,
`statusLabel`, `gradeScale { id, effectiveFrom, grades }`, `feedbackDays`, `counts { OPEN, MANAGER_REVIEW, FEEDBACK,
PENDING_FINAL, PUBLISHED }`, `total`, `createdAt`. Chi tiết thêm `missing[] { employee, department, reason, reasonLabel }`
(người đang làm chưa tạo được phiếu vì `KPI_TEMPLATE_MISSING` chưa có mẫu hoặc `KPI_REVIEWER_MISSING` không tìm được người chấm; người đã đủ điều kiện mà chưa có phiếu, như người mới vào hay vừa có mẫu, **không** nằm trong danh sách này, `POST …/add-missing` sẽ tạo phiếu cho họ) và
`terminatedWarnings[] { reviewId, status, statusLabel, employee, terminationDate }` (phiếu chưa công bố của người đã nghỉ việc,
mục 10: HR đổi người chấm hoặc xử lý tay; hệ thống không tự đổi).

### 4.6 Cài đặt

- Chỉ tiêu (`KpiIndicatorDto`): `id`, `name`, `unit`, `direction`, `directionLabel`, `source`, `sourceLabel`, `autoKey`,
  `autoKeyLabel`, `capPercent`, `floorPercent`, `bands [{ upTo | null, percent }]`, `manualScale`, `isActive`.
- Mẫu (`KpiTemplateDto`): `id`, `name`, `department`, `position`, `scope` (`POSITION` | `DEPARTMENT` | `GENERAL`), `version`,
  `previousId`, `regulationNo`, `regulationDate`, `isActive`, `totalWeight`, `reviewCount`, `items [{ indicator, target,
  weight }]`. Mẫu của một người: theo vị trí, rồi theo phòng, rồi mẫu chung (không phòng, không vị trí) mới nhất.
- Thang (`KpiGradeScaleDto`): `id`, `effectiveFrom`, `grades` (cao xuống thấp), `createdAt`.

## 5. API

Mọi route dưới `/v1`, gắn `@RequireModule('TASKS')`.

| Phương thức | Đường dẫn | Ai | Ghi chú |
|---|---|---|---|
| GET | `/kpi/indicators?includeInactive=` | `kpi:manage` | Danh mục chỉ tiêu (UI-12) |
| POST | `/kpi/indicators` | `kpi:manage` | Chỉ tạo chỉ tiêu nhập tay `{ name, unit, direction, manualScale?, capPercent?, floorPercent?, bands? }`; bỏ trống trần thì 120 với kiểu tỷ lệ; `BANDS` bắt buộc bảng mốc; chấm 1–5 chỉ với `HIGHER` |
| PATCH | `/kpi/indicators/:id` | `kpi:manage` | Chỉ tiêu tự động chỉ đổi `capPercent`, `floorPercent`, `bands`, `isActive` (đổi khác: 400 `KPI_INDICATOR_AUTO_LOCKED`) |
| GET | `/kpi/templates?includeInactive=`, `/kpi/templates/:id` | `kpi:manage` | Kèm `reviewCount` |
| POST | `/kpi/templates` | `kpi:manage` | `{ name, departmentId?, positionId?, regulationNo?, regulationDate?, items[{ indicatorId, target, weight }] }`; tổng trọng số khác 100: 400 `KPI_WEIGHT_NOT_100`, câu "Tổng trọng số đang là 95%, còn thiếu 5%…", `details { sum, missing }` (S-23) |
| PATCH | `/kpi/templates/:id` | `kpi:manage` | Mẫu chưa có phiếu sửa tại chỗ; mẫu đã có phiếu thì trả **mẫu mới** (id mới, `version + 1`, `previousId`), bản cũ `isActive: false`. Chỉ `isActive` thì không tạo phiên bản |
| GET, POST | `/kpi/grade-scales` | `kpi:manage` | `{ effectiveFrom, grades[{ label, minScore }] }`; 2–10 mức, tên không trùng, ngưỡng không trùng, phải có mức 0 |
| GET | `/kpi/periods` | `kpi:manage` | Kèm số phiếu theo bước. Giám đốc, trưởng phòng không gọi được: lấy kỳ từ các phiếu họ xem được (`GET /kpi/reviews`) |
| POST | `/kpi/periods` | `kpi:manage` | `{ type: 'MONTH' \| 'QUARTER', startDate, gradeScaleId?, feedbackDays? }`; tháng bắt đầu ngày 1, quý ngày 1 tháng 1/4/7/10; `YEAR` 400 (kết quả năm ở `/kpi/year-results`); trùng 409 `KPI_PERIOD_EXISTS`. Trả chi tiết kỳ kèm `missing` |
| GET | `/kpi/periods/:id` | `kpi:manage` | Chi tiết kỳ (mục 4.5) |
| POST | `/kpi/periods/:id/add-missing` | `kpi:manage` | Tạo phiếu cho người còn thiếu (sau khi thêm mẫu, người mới vào); kỳ đã công bố hết 409 `KPI_PERIOD_STATE_INVALID` |
| POST | `/kpi/periods/:id/recompute` | `kpi:manage` | Tính lại ngay phiếu Đang mở, Chờ cấp trên đánh giá; trả `{ computed, failed }` |
| POST | `/kpi/periods/:id/remind` | `kpi:manage` | Nhắc người chấm còn phiếu Chờ cấp trên đánh giá (mục 13.3); trả `{ reminded, skipped, reviews }` |
| POST | `/kpi/periods/:id/publish` | `kpi:manage` | Công bố mọi phiếu Chờ chốt (chốt luôn); trả `{ published, skippedOwn }` |
| GET | `/kpi/periods/:id/results?departmentId=` | `kpi:manage`, ADMIN, DIRECTOR; trưởng phòng (phòng mình) | `{ period, rows[KpiReviewListItemDto], distribution[{ department, total, graded, byGrade }], overall }` (F-29, RP-10) |
| GET | `/kpi/periods/:id/results/export?departmentId=` | như trên | File `.xlsx`: sheet "Kết quả" (STT, mã NV, họ tên, phòng, người đánh giá, bước, tổng điểm, xếp loại; tiêu đề cột ở dòng 4), "Phân bố theo phòng" và "Chi tiết chỉ tiêu" (từ 27/11/2026: mỗi người mỗi chỉ tiêu một dòng, mục 13.4) |
| GET | `/kpi/year-results?year=&departmentId=` | như trên | Trung bình điểm các kỳ con **đã công bố** của từng người, xếp loại theo thang áp dụng ngày cuối năm |
| GET | `/kpi/reviews?mine=&toReview=&periodId=&status=&departmentId=&q=&page=&limit=` | Theo quyền xem | `mine=true` KPI của tôi (UI-10), `toReview=true` phiếu tôi chấm (UI-11) |
| GET | `/kpi/reviews/:id` | Người xem được | Mục 4.2 |
| GET | `/kpi/reviews/:id/lines/:lineId/evidence` | Người xem được | Mục 4.4 |
| PATCH | `/kpi/reviews/:id/lines/:lineId` | Người chấm ở `MANAGER_REVIEW`; `kpi:manage` ở `PENDING_FINAL` trước khi chốt | `{ value?, reason?, note?, resetToAuto? }` (mục 6) |
| POST | `/kpi/reviews/:id/submit` | Người chấm | `{ comment? }`; còn chỉ tiêu nhập tay chưa chấm: 400 `KPI_MANUAL_SCORE_MISSING`, `details.lines` là mảng **tên** chỉ tiêu |
| POST | `/kpi/reviews/:id/feedback` | Nhân viên của phiếu | `{ agreed, feedback? }`; không đồng ý thì bắt buộc `feedback` (400 `KPI_FEEDBACK_REQUIRED`) |
| POST | `/kpi/reviews/:id/finalize` | `kpi:manage` | Chốt; sau đó không sửa dòng |
| POST | `/kpi/reviews/:id/publish` | `kpi:manage` | Công bố (chốt luôn nếu chưa) |
| POST | `/kpi/reviews/:id/reopen` | `kpi:manage` | `{ reason }` bắt buộc (400 `KPI_REASON_REQUIRED`) |
| PATCH | `/kpi/reviews/:id/reviewer` | `kpi:manage` | `{ reviewerId, reason? }`, phiếu `OPEN` hoặc `MANAGER_REVIEW`; người mới phải đang làm, khác nhân viên của phiếu |

Các route ghi trả lại chi tiết phiếu (hoặc chi tiết kỳ) mới nhất, giao diện thay thẳng.

## 6. Chấm và chỉnh số (F-25, S-21)

- Chỉ tiêu nhập tay: gửi `value` (chấm 1–5 thì số nguyên 1–5; đạt hoặc không đạt thì 1 hoặc 0; sai: 400
  `KPI_LINE_VALUE_INVALID`). `value: null` xoá điểm đã chấm.
- Chỉ tiêu tự động: gửi `value` khác `autoValue` thì **bắt buộc `reason`** (400 `KPI_ADJUST_REASON_REQUIRED`); phiếu giữ cả
  `autoValue` và `value`. Gửi `value` bằng `autoValue`, `value: null` hay `resetToAuto: true` là bỏ chỉnh. Dòng không áp dụng
  không chỉnh được (400 `KPI_LINE_NOT_APPLICABLE`).
- `note` là ghi chú của dòng (gửi `null` để xoá). Mỗi lần sửa ghi sự kiện `LINE_UPDATED { lineId, name, from, to, reason?, note? }`
  và tính lại điểm.

## 7. Mã lỗi

| Mã | HTTP | Khi nào |
|---|---|---|
| `KPI_FORBIDDEN` | 403 | Không có `kpi:manage` (cài đặt, kỳ); không phải HR, giám đốc, trưởng phòng (kết quả); trưởng phòng xin phòng khác |
| `KPI_INDICATOR_NOT_FOUND` / `KPI_TEMPLATE_NOT_FOUND` / `KPI_GRADE_SCALE_NOT_FOUND` / `KPI_PERIOD_NOT_FOUND` | 404 | |
| `KPI_INDICATOR_NAME_EXISTS` | 409 | Tên chỉ tiêu trùng (không phân biệt hoa thường) |
| `KPI_INDICATOR_AUTO_LOCKED` | 400 | Đổi tên, đơn vị, kiểu, chấm 1–5 của chỉ tiêu tự động |
| `KPI_INDICATOR_INVALID` | 400 | Theo mốc thiếu bảng mốc, sàn không nhỏ hơn trần, chấm 1–5 với kiểu khác càng cao càng tốt |
| `KPI_WEIGHT_NOT_100` | 400 | Tổng trọng số mẫu khác 100 (`details.sum`, `details.missing`) |
| `KPI_TEMPLATE_INVALID` | 400 | Chỉ tiêu lặp, đã tắt, không có; mức giao 0 với càng cao càng tốt; phòng, vị trí không có; sửa phiên bản đã ngừng dùng |
| `KPI_GRADE_SCALE_INVALID` | 400 | Thang sai |
| `KPI_PERIOD_INVALID` | 400 | Ngày đầu sai, kỳ năm, chưa có thang |
| `KPI_PERIOD_EXISTS` | 409 | Kỳ cùng loại, cùng ngày đầu đã mở |
| `KPI_PERIOD_STATE_INVALID` | 409 | Tạo phần còn thiếu khi kỳ đã công bố hết |
| `KPI_REVIEW_NOT_FOUND` | 404 | Không có phiếu hoặc không xem được |
| `KPI_REVIEW_FORBIDDEN` | 403 | Xem được nhưng không đúng vai (nhân viên sửa dòng, người không phải người chấm gửi đánh giá…) |
| `KPI_REVIEW_SELF` | 403 | Người có `kpi:manage` thao tác trên phiếu của chính mình |
| `KPI_REVIEW_STEP_INVALID` | 409 | Sai bước (T-16), đã chốt, hoặc phiếu vừa đổi bước (`details.status`) |
| `KPI_LINE_NOT_FOUND` | 404 | |
| `KPI_LINE_VALUE_INVALID` / `KPI_LINE_NOT_APPLICABLE` / `KPI_ADJUST_REASON_REQUIRED` | 400 | Mục 6 |
| `KPI_MANUAL_SCORE_MISSING` | 400 | Gửi đánh giá khi còn chỉ tiêu nhập tay chưa chấm (`details.lines`: tên các chỉ tiêu) |
| `KPI_FEEDBACK_REQUIRED` | 400 | Không đồng ý mà không ghi phản hồi |
| `KPI_REASON_REQUIRED` | 400 | Mở lại không lý do |
| `KPI_REVIEWER_INVALID` | 400 | Người chấm mới là chính nhân viên, trùng người cũ, hoặc không đang làm |

## 8. Thông báo (deep link)

Category `TASK`, `actionType: 'NAVIGATE_ONLY'`. Nội dung ở `docs/notifications/notification-content-map.md` mục "KPI".

| `type` | Khi nào | Người nhận | `refType` / mở |
|---|---|---|---|
| `KPI_REVIEW_NEEDED` | J-05 chuyển phiếu sang chờ đánh giá; HR đổi người chấm khi phiếu đang Chờ cấp trên đánh giá (phiếu còn Đang mở thì không gửi, người chấm mới nhận khi J-05 chuyển bước); J-05 nhắc phiếu giữ quá 3 ngày | Người chấm (email gom) | `kpi_review`, `/kpi/danh-gia?reviewId={id}` |
| `KPI_FEEDBACK_NEEDED` | Người chấm gửi đánh giá | Nhân viên (email) | `kpi_review`, `/kpi?reviewId={id}` |
| `KPI_PUBLISHED` | HR công bố | Nhân viên (email) | `kpi_review`, `/kpi?reviewId={id}` |
| `KPI_REVIEW_OVERDUE` | J-05: phiếu chờ người chấm quá 3 ngày, một lần mỗi kỳ | Người có `kpi:manage` (email) | `kpi_period`, `/management/kpi/ky?periodId={id}` |
| `KPI_REVIEW_NEEDED` (nhắc tay) | Người quản lý KPI bấm Nhắc người chấm (mục 13.3) | Người chấm còn phiếu chờ (email gom) | `kpi_review`, `/kpi/danh-gia?reviewId={id}` |
| `KPI_REVIEW_PENDING_FINAL` | Nhân viên phản hồi, phiếu sang Chờ chốt; gom một tin mỗi kỳ mỗi ngày (phiếu sang Chờ chốt vì hết hạn phản hồi thì không gửi) | Người có `kpi:manage` | `kpi_period`, `/management/kpi/ky?periodId={id}` |

Từ 27/11/2026 thông báo "cần đánh giá" của người chấm chuyển đã đọc khi họ gửi phiếu, thông báo "cần phản hồi" của nhân viên
chuyển đã đọc khi họ phản hồi.

## 9. Màn hình web (thiết kế mục 9.1, 9.2)

| Mã | Đường dẫn | Gọi |
|---|---|---|
| UI-10 KPI của tôi | `/kpi` | `GET /kpi/reviews?mine=true`, chi tiết, bằng chứng, `POST …/feedback` |
| UI-11 Đánh giá nhân viên | `/kpi/danh-gia` | `GET /kpi/reviews?toReview=true&status=MANAGER_REVIEW`, chi tiết, `PATCH …/lines/:lineId`, `POST …/submit`; nút Phiếu kế tiếp lấy phiếu kế trong danh sách |
| UI-12 Cài đặt KPI | `/management/kpi/cai-dat` | Chỉ tiêu, mẫu, thang |
| UI-13 Kỳ đánh giá | `/management/kpi/ky` | Kỳ, chi tiết kỳ (đếm theo bước, chưa có phiếu, cảnh báo nghỉ việc), tính lại, tạo phần còn thiếu, chốt, công bố từng phiếu và cả kỳ, mở lại, đổi người chấm, kết quả, xuất Excel, kết quả năm |

Quy tắc phiếu (mục 9.2): bảng chỉ tiêu, mức giao, kết quả, tỷ lệ, trọng số, điểm; số tự động gạch chân, bấm mở bằng chứng;
dòng "Tính lúc {computedAt theo giờ Việt Nam}"; chấm tay bằng năm nút 1–5 khi `manualScale`; số đã chỉnh hiện `autoValue` gạch
ngang, `value` và `adjustReason`; dòng không áp dụng ghi "Không áp dụng" và trọng số hiệu lực của các dòng còn lại; bước Chờ
phản hồi có câu nói rõ bấm Đồng ý không làm mất quyền phản hồi; `scoreComplete: false` thì ghi "Điểm tạm tính".

## 10. Kịch bản phải thử trên web (P4 lô 3)

1. HR (UI-12): xem 8 chỉ tiêu tự động; thêm "Chuyên môn" chấm 1–5; đổi tên chỉ tiêu tự động bị chặn với câu báo; đổi trần.
2. HR: lưu mẫu tổng 95% thấy "còn thiếu 5%" ngay trên form; lưu mẫu đúng 100%; sửa mẫu đã có phiếu thấy phiên bản mới.
3. HR: thêm thang mới; kỳ đang mở vẫn hiện thang cũ.
4. HR (UI-13): mở kỳ tháng; ngày đầu sai báo lỗi; danh sách "chưa có phiếu" kèm lý do; tạo phần còn thiếu; tính lại ngay;
   cảnh báo phiếu của người đã nghỉ; đổi người chấm.
5. Nhân viên (UI-10): giữa kỳ thấy điểm tạm tính và "Tính lúc …"; bấm số đúng hạn ra danh sách việc, việc không xem được hiện
   số hiệu không có tiêu đề; màn hẹp 390 điểm ảnh dùng được.
6. Người chấm (UI-11): phiếu Đang mở không sửa được; sau khi kỳ khép, chấm "Chuyên môn" bằng nút 1–5; chỉnh số tự động không
   lý do bị chặn, có lý do thì thấy số gốc gạch ngang; gửi khi chưa chấm đủ bị chặn kèm tên chỉ tiêu; gửi xong không sửa được.
7. Nhân viên: không đồng ý mà không ghi gì bị chặn; đồng ý xong vẫn ghi thêm phản hồi được.
8. HR: sửa dòng ở Chờ chốt; chốt; sửa sau chốt bị chặn; công bố; mở lại phải có lý do; công bố cả kỳ; phiếu của chính mình
   không có nút chốt, công bố.
9. Trưởng phòng: kết quả chỉ phòng mình; giám đốc: mọi phòng, phân bố xếp loại; xuất Excel mở được, đúng cột, không có chữ
   nào về lương.
10. Mọi vai: phiếu người khác mở bằng link trực tiếp thấy "Không tìm thấy phiếu"; module chỉ xem thì nút ghi ẩn hoặc báo lỗi
    module.
11. Thông báo N-22, N-23, N-24 mở đúng màn; `kpiReviews` trên huy hiệu trang KPI, không cộng vào Duyệt đơn.

## 11. Mobile

Bản đầu web làm trước. Mobile làm sau theo cùng API: KPI của tôi (UI-10), phản hồi, mở deep link N-23, N-24; người chấm mở
N-22 sang web nếu mobile chưa có màn đánh giá.

## 12. Trạng thái xem nằm trên đường dẫn web (26/11/2026)

Chỉ đổi ở web, API không đổi. Quy ước chung như `docs/bridges/tasks.md` mục 22: giá trị mặc định không ghi lên đường dẫn, đổi
bộ lọc thay đường dẫn tại chỗ; F5 hay gửi đường dẫn vẫn ra đúng màn trong phạm vi quyền của người mở (API chặn quyền, phiếu
người khác vẫn là "Không tìm thấy phiếu").

| Màn | Tham số (mặc định) |
|---|---|
| KPI của tôi `/kpi` | `reviewId` (phiếu chưa công bố mới nhất, không có thì phiếu mới nhất) |
| Đánh giá nhân viên `/kpi/danh-gia` | `tab` = `all` (Chờ tôi chấm); `q` (tìm tên, mã, ghi sau 350 ms); `reviewId` |
| Kết quả KPI `/kpi/ket-qua` (giám đốc, trưởng phòng) | `view` = `year` (Theo kỳ); `periodId` (kỳ mới nhất); `dept` dùng chung hai thẻ (trưởng phòng một phòng thì chọn sẵn phòng đó); `year` (năm nay); `reviewId` |
| Cài đặt KPI `/management/kpi/cai-dat` | `tab` = `templates` \| `grades` (Chỉ tiêu); `inactive=1` hiện chỉ tiêu, mẫu ngừng dùng |
| Kỳ đánh giá `/management/kpi/ky` | `periodId`; `view` = `results` \| `year` (Phiếu); `status` (bước phiếu, bấm số đếm); `dept` dùng chung ba thẻ; `q`; `year` (năm nay); `reviewId` |

`dept` trên đường dẫn chỉ là lựa chọn ban đầu của ô Phòng. Trưởng phòng mở đường dẫn có `dept` phòng khác thì API kết quả trả
403 "Bạn chỉ xem được kết quả KPI của phòng mình." (mục 1), web hiện câu đó, không lộ thêm gì.

Kịch bản phải thử: tìm tên ở Đánh giá nhân viên và Kỳ đánh giá rồi F5 vẫn còn chữ; chọn phòng ở thẻ Kết quả, chọn năm và phòng
ở Kết quả năm rồi F5 giữ; bật hiện chỉ tiêu ngừng dùng rồi F5 giữ; gửi đường dẫn có `reviewId` cho người không xem được phiếu
thì thấy "Không tìm thấy phiếu".

---

## 13. Sửa sau thử nghiệm người dùng (27/11/2026)

### 13.1 Vì sao chỉ tiêu không áp dụng

`KpiReviewLineDto.notApplicableReason`: câu lý do khi dòng tự động không áp dụng (`applicable: false`), `null` khi áp dụng hoặc
dòng nhập tay. Ví dụ "Trong kỳ không có việc người khác giao có hạn ban đầu (việc tự giao, việc con, việc chưa có hạn không
tính).". Web hiện câu này dưới dòng chỉ tiêu, kèm câu "Trọng số chia sang các chỉ tiêu còn lại" (đã có `effectiveWeight`).
Tỷ lệ đúng hạn giờ chỉ tính việc **có hạn** (việc chưa có hạn không còn được tính là đúng hạn), nên phiếu của người chỉ có
việc chưa hạn sẽ không áp dụng hai chỉ tiêu đúng hạn.

### 13.2 Số việc của nhân viên trên phiếu

`KpiReviewDetailDto.taskStats: { open, inReview, overdue, acceptedInPeriod }`: việc đang mở, đang chờ nghiệm thu, quá hạn mà
chưa báo xong (tính tại hôm nay), đã nghiệm thu trong kỳ của phiếu. Ai mở được phiếu thì thấy (người chấm, người quản lý
KPI, giám đốc, trưởng phòng, chính nhân viên). Đây là cách người quản lý KPI (HR) xem số việc của một người mà không xem nội
dung việc (Q-U2). Web hiện một dải bốn số ở đầu phiếu, chỉ là con số, không mở danh sách việc.

### 13.3 Nhắc người chấm

`POST /kpi/periods/:id/remind` (`kpi:manage`): mỗi người chấm còn phiếu Chờ cấp trên đánh giá nhận một thông báo cho mỗi phiếu
và một thư gom, câu "HR nhắc bạn đánh giá phiếu KPI {kỳ} của {nhân viên}". Mỗi người chấm tối đa một lần mỗi ngày mỗi kỳ:
bấm lần hai trong ngày thì `reminded: 0`, `skipped` là số người đã nhắc hôm nay. Trả `{ reminded, skipped, reviews }`
(`reviews` là số phiếu đang chờ chấm). Web: nút **Nhắc người chấm** ở màn Kỳ đánh giá, hiện kết quả "Đã nhắc {n} người chấm
({m} người đã được nhắc hôm nay)".

### 13.4 Excel chi tiết chỉ tiêu

Sheet thứ ba "Chi tiết chỉ tiêu", tiêu đề: Mã nhân viên, Họ tên, Chỉ tiêu, Đơn vị, Mức giao, Trọng số (%), Số tự động, Kết
quả dùng, Lý do chỉnh, Hoàn thành (%), Điểm. Dòng không áp dụng ghi rõ. API không đổi.

Sheet này **chỉ có phiếu người tải mở được** (như `GET /kpi/reviews/:id`): người quản lý KPI, giám đốc, ADMIN có mọi phiếu;
trưởng phòng chỉ có phiếu mình chấm và phiếu của chính mình, các phiếu khác trong phòng vẫn có điểm, xếp loại ở sheet "Kết
quả" nhưng không có dòng chi tiết.

### 13.5 Huy hiệu và thông báo

- `GET /approval/counts.kpiPendingFinal`: số phiếu Chờ chốt, chỉ đếm cho người quản lý KPI; không cộng vào `total`. Web hiện
  số đỏ cạnh mục **Kỳ đánh giá**.
- `KPI_REVIEW_PENDING_FINAL` (mục 8): người quản lý KPI biết có phiếu chờ chốt, nêu số phiếu nhân viên không đồng ý trước.

### 13.6 Kịch bản phải thử trên web

1. Phiếu có chỉ tiêu không áp dụng hiện câu lý do; phiếu có `taskStats` hiện dải bốn số.
2. Kỳ đánh giá: bấm Nhắc người chấm hai lần trong ngày, lần hai báo đã nhắc rồi; người chấm nhận tin "HR nhắc bạn…".
3. Nhân viên phản hồi không đồng ý: người quản lý KPI có tin chờ chốt, số đỏ cạnh Kỳ đánh giá tăng; tin "cần phản hồi" của
   nhân viên đã đọc.
4. Người chấm gửi phiếu: tin "cần đánh giá" của họ đã đọc.
5. Xuất Excel có sheet Chi tiết chỉ tiêu.
