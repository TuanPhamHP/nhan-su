# Hướng dẫn theo tính năng (guide tour)

Tài liệu cho người và agent thêm hướng dẫn từng bước vào một phân hệ. Đọc hết trước khi viết tour
mới; checklist ở mục 6 là điều kiện để coi một hướng dẫn là xong.

## Mục lục

1. [Tính năng là gì](#1-tính-năng-là-gì)
2. [Thành phần](#2-thành-phần)
3. [Luồng chạy](#3-luồng-chạy)
4. [Phân quyền](#4-phân-quyền)
5. [Quy tắc viết tour](#5-quy-tắc-viết-tour)
6. [Thêm hướng dẫn cho một phân hệ: checklist](#6-thêm-hướng-dẫn-cho-một-phân-hệ-checklist)
7. [Danh mục hiện có](#7-danh-mục-hiện-có)
8. [Giới hạn đã biết](#8-giới-hạn-đã-biết)

---

## 1. Tính năng là gì

Mép phải màn hình có một tab dọc **Hướng dẫn**. Bấm vào thì mở danh sách hướng dẫn của **phân hệ đang
mở** (Hành chính văn phòng, Tài sản…), chia hai nhóm **Quản lý** và **Nhân viên**. Mỗi hướng dẫn là
**một việc cụ thể** ("Mở kỳ văn phòng phẩm", "Đặt phòng họp"), không phải "giới thiệu trang". Chọn
một hướng dẫn thì hệ thống đưa người dùng tới đúng trang (nếu đang ở trang khác) rồi chạy tour từng
bước trên chính giao diện thật.

- Danh sách lọc theo vai trò, quyền và gói module, cùng luật với menu bên trái. Người không làm được
  việc đó thì không thấy hướng dẫn của việc đó.
- Phân hệ không có hướng dẫn nào cho người đang xem thì tab không hiện. Tab cũng ẩn trong lúc tour
  đang chạy.
- Hướng dẫn theo tính năng **không tự bật** cho người mới. Tự bật một lần là việc của tour trang
  (`usePageTour`, đang dùng ở ba trang Tài sản); một tour có thể vừa tự bật vừa nằm trong danh sách.
- Tour không gọi API và không ghi dữ liệu. Bước nào mở khung nhập thì khi tour kết thúc khung tự
  đóng, không lưu gì.

## 2. Thành phần

| File | Vai trò |
|---|---|
| `app/types/guide.types.ts` | `FeatureGuide`: `tourId`, `app`, `audience`, `group` (tuỳ chọn), `title`, `description`, `to`, `access` |
| `app/config/feature-guides.ts` | `FEATURE_GUIDES`: danh mục mọi hướng dẫn, gom theo phân hệ |
| `app/composables/useFeatureGuides.ts` | Lọc danh mục theo phân hệ đang mở và quyền; `openGuide()` chuyển trang rồi chạy tour |
| `app/components/layout/AppGuideFab.vue` | Tab "Hướng dẫn" dính mép phải và bảng danh sách; gắn ở `layouts/default.vue` và `layouts/employee.vue` |
| `app/composables/useTour.ts` | Lõi tour. `useGuideTour(id, factory)` đăng ký tour của trang, không tự bật. `startWhenReady(id)` chạy ngay hoặc chờ trang đích đăng ký |
| `app/tours/<phân-hệ>-<trang>.ts` | Định nghĩa tour: các bước, trỏ vào phần tử `[data-tour="..."]` |
| `app/components/ui/TourOverlay.vue`, `app/composables/useTourDriver.ts` | Vẽ lớp phủ, ô sáng, hộp hướng dẫn; chờ phần tử, khoá bấm, phím Esc. Không cần sửa khi thêm hướng dẫn |

Phân hệ (`app`) là mã trong `app/config/app-modules.ts` (`chr`, `tal`, `rec`, `ast`, `apv`, `adm`,
`tsk`, `eng`, `pay`, `ana`, `sys`). "Phân hệ đang mở" là `useAppModules().currentApp`, tính theo tiền tố
route dài nhất trong `routes` của phân hệ.

## 3. Luồng chạy

1. Người dùng chọn một hướng dẫn trong `AppGuideFab`.
2. `openGuide()` gọi `tour.startWhenReady(tourId)`:
   - trang hiện tại đã đăng ký tour đó thì tour chạy ngay;
   - chưa đăng ký thì ghi `tourId` vào `pending` rồi `navigateTo(guide.to)`.
3. Trang đích mount, `useGuideTour` gọi `register()`. Thấy `pending` trùng `tourId` thì đợi 300 ms
   cho trang vẽ xong rồi chạy tour.
4. Sau 8 giây mà trang đích vẫn chưa đăng ký tour thì huỷ `pending` và báo toast. Thường là quên gọi
   `useGuideTour` ở trang, hoặc gõ sai `tourId`.
5. Mỗi bước chờ phần tử của nó tối đa 4 giây. Không thấy thì bỏ qua bước đó và đánh lại số bước.
   Đây là lý do mốc `data-tour` bị xoá khi sửa giao diện sẽ làm tour hỏng mà không báo lỗi.

## 4. Phân quyền

`access` của hướng dẫn dùng **đúng luật của mục menu** (`NavItem`): `roles`, `management`,
`permission`, `module`, `alsoFor`, `showWhen`, và được kiểm bằng `canSeeItem` của `useAppModules`.
Mục menu chỉ hiện cho một số người theo dữ liệu (`showWhen: 'taskReports'`, `'kpiReviewer'`) thì
hướng dẫn chép nguyên `showWhen` đó.

- **Chép `access` từ mục menu dẫn tới trang đích** trong `app-modules.ts`, rồi siết thêm nếu việc đó
  cần quyền cao hơn quyền xem trang. Ví dụ trang Kỳ văn phòng phẩm mở được với
  `office:supply:report`, nhưng hướng dẫn "Mở kỳ" đòi `office:supply:manage`, vì người chỉ có quyền
  xem không có nút Mở kỳ mới.
- Mục menu của trang cá nhân (`scope: 'personal'`) thường chỉ có `module`: hướng dẫn cũng vậy.
- `audience: 'manage'` cho việc quản lý, `'staff'` cho việc mọi nhân viên làm. Đây chỉ là nhóm hiển
  thị, không phải quyền.
- Điều kiện không diễn tả được bằng vai trò, quyền (ví dụ "là trưởng phòng của phòng mình", chỉ biết
  sau khi gọi API của trang) thì để `access` rộng hơn một chút, và **trong tour** thêm một bước
  `when: () => !điềuKiện()` nói thẳng đây là việc của ai. Ví dụ là hướng dẫn "Chọn người nhận
  hàng". Không được để tour chạy vào một nút người dùng không có.
- `access` chỉ để gọn mắt. Chặn thật vẫn là `permission-guard.global.ts` và API.

### Nhóm con trong phân hệ lớn

Phân hệ có nhiều mục menu (Hồ sơ & Hợp đồng có Nhân viên, Phòng ban, Chức vụ, Hợp đồng) thì đặt
`group` bằng tên mục menu. Danh sách hướng dẫn hiện thành cây `Nhân viên > Thêm một nhân viên`:
- hướng dẫn không có `group` đứng trước;
- các nhóm xếp theo thứ tự xuất hiện trong `FEATURE_GUIDES`;
- bấm tiêu đề nhóm để mở hay thu gọn.

Phân hệ chỉ có một nhóm thì nhóm đó mở sẵn; nhiều nhóm thì đóng hết lúc mở bảng. Phân hệ nhỏ
(Truyền thông, Tài sản) không cần `group`.

## 5. Quy tắc viết tour

### Mốc `data-tour`

- Mỗi bước trỏ vào `[data-tour="<tiền tố trang>-<phần>"]`, ví dụ `supply-import`, `period-open`,
  `room-calendar`. Không trỏ bằng class Tailwind hay cấu trúc DOM: giao diện đổi là hỏng.
- Gắn mốc lên phần tử bọc **đúng vùng cần giải thích**: một nút, một form, một bộ lọc. Đừng gắn lên
  cả trang.
- Danh sách dài thì chỉ gắn mốc lên **phần tử đầu tiên**:
  `:data-tour="index === 0 ? 'supply-lines' : undefined"`. Ô sáng ôm vài chục dòng thì không chỉ
  được gì.
- Nhiều phần tử cùng mốc thì ô sáng bao trọn những phần tử đang hiện. Dùng cách này khi máy tính là
  bảng, điện thoại là thẻ.
- `CommonAppButton` nhận thẳng `data-tour` (thuộc tính đi xuống phần tử gốc).
- Thêm mốc vào trang của phân hệ khác hay trang người khác đang sửa thì báo lại tên mốc và vị trí,
  để họ giữ mốc khi dựng lại giao diện.

### Bước

| Trường | Quy tắc |
|---|---|
| `id` | Ngắn, duy nhất trong tour; chỉ dùng cho log, kiểm thử |
| `target` | Bỏ trống thì hộp nằm giữa màn: dùng cho bước mở đầu, kết luận, hoặc "chưa làm được vì…" |
| `title` | 2–5 chữ, nói việc: "Thêm mặt hàng", "Chọn phòng ban" |
| `body` | Một tới ba câu nói người dùng làm gì và điều gì xảy ra. Tên nút, thẻ, cột, khối hay ô nhập viết đúng chữ trên giao diện và **in đậm** bằng `**Tên nút**` (xem dưới bảng) |
| `mode: 'click'` | Chỉ dùng khi bước sau nằm trong khung mà bước này mở ra (nút Thêm, Mở kỳ mới), hoặc khi bấm là chuyển sang trang chạy tiếp tour (mục 8). Kèm `action`: "Bạn bấm thử vào nút **…**, chỉ xem thôi, chưa lưu gì." |
| `when` | Mọi bước phụ thuộc quyền, dữ liệu hay trạng thái phải có `when`. Đọc lại mỗi lần đi qua, nên truyền hàm, không truyền giá trị |
| `onEnter` | Chuẩn bị chỗ để trỏ: chuyển đúng thẻ (`showTab`), mở phần đang thu gọn, đóng khung khi quay lại bước `click` |

**In đậm tên trên giao diện.** Trong `body` và `action`, mọi chữ người dùng phải tìm thấy trên màn
hình đều viết đúng như giao diện rồi bọc trong `**…**`. Đó là tên nút, thẻ, cột, khối, ô nhập, ô
tick, trạng thái hay mục menu. Ví dụ: `'Bấm **Tải file mẫu** rồi điền, xong thì bấm **Import**.'`.
- Không dùng ngoặc kép để đánh dấu tên nút nữa.
- Không in đậm cả câu hay chữ thường để nhấn mạnh.
- `title` của bước không cần, vì đã in đậm sẵn.

Hộp hướng dẫn tách chữ bằng `tourTextParts` (`app/utils/tour.ts`) và vẽ từng đoạn bằng `{{ }}`,
không dùng `v-html`. Vì vậy chỉ `**…**` có tác dụng, còn thẻ HTML viết vào sẽ hiện nguyên chữ.

### Tour

- Một tour, một việc, **3–6 bước**. Việc dài thì tách thành hai hướng dẫn.
- Bước đầu đưa trang về đúng trạng thái: chuyển thẻ, mở phần thu gọn. Người dùng có thể mở hướng dẫn
  khi đang đứng ở thẻ khác của cùng trang.
- Dữ liệu rỗng hoặc thiếu điều kiện tiên quyết (chưa có văn phòng, chưa có kỳ) thì thêm bước không
  `target` giải thích và chỉ đường, đi cùng `when`. Đừng để tour chỉ còn 0 bước hay trỏ vào chỗ trống.
- Tour mở khung nhập thì có `onEnd` đóng khung. Bước cuối trong khung nói "Lần này bạn bấm Xong để
  đóng lại".
- Không gọi API, không đổi dữ liệu thật trong `onEnter`, `onExit`, `onEnd`.
- `version` bắt đầu từ 1; chỉ ảnh hưởng tour tự bật (`usePageTour`), tăng khi đổi nội dung lớn.
- Văn phong theo câu tiếng Việt trọn vẹn, xưng "bạn", không viết tắt, không mũi tên.

### Trang đích

Tour nhận một `context` gồm các hàm đọc trạng thái của trang, không import store hay service. Trang
đăng ký ở cuối `<script setup>`:

```ts
import { officeRoomBookingTour } from '~/tours/office-rooms';

// Hướng dẫn "Đặt phòng họp", mở từ nút Hướng dẫn nổi bên phải.
useGuideTour('office-room-booking', () =>
	officeRoomBookingTour({
		hasSites: () => sites.value.length > 0,
		canBook: () => rooms.value.length > 0 && canBook.value,
		showGrid: () => (activeTab.value = 'grid'),
	}),
);
```

Một trang có thể đăng ký nhiều tour (trang Cài đặt hành chính có hai). Tour nào vừa tự bật cho người
mới vừa nằm trong danh sách thì đăng ký bằng `usePageTour` thay cho `useGuideTour`, không gọi cả hai.

## 6. Thêm hướng dẫn cho một phân hệ: checklist

1. **Chọn việc.** Liệt kê việc chính theo từng nhóm người: quản lý (cài đặt, mở kỳ, duyệt, chốt…) và
   nhân viên (đăng ký, tạo đơn, xem của tôi…). Mỗi việc là một hướng dẫn; tên là động từ + đối tượng,
   giống chữ trên nút.
2. **Xác định trang và quyền.** Mỗi việc chạy trên đúng một trang (`to`, kèm `?tab=` nếu trang có
   thẻ). Lấy `access` theo mục 4.
3. **Gắn mốc** `data-tour` cho từng phần tử mà các bước trỏ tới (mục 5).
4. **Viết tour** ở `app/tours/<phân-hệ>-<trang>.ts`: export interface `XxxTourContext` và hàm
   `xxxTour(ctx): TourDefinition`, mỗi hàm có comment một dòng nói tour cho việc gì, ở trang nào.
5. **Đăng ký** trong trang bằng `useGuideTour('<tourId>', () => xxxTour(ctx))`.
6. **Thêm dòng** vào `FEATURE_GUIDES`, đặt dưới tiêu đề phân hệ, thứ tự: quản lý trước, nhân viên sau.
7. **Cập nhật mục 7** của tài liệu này.
8. **Kiểm tra:**
   - `npm run build` xanh (IDE báo "Cannot find name …" cho auto-import là báo giả).
   - Chạy thử trên trình duyệt bằng tài khoản **từng nhóm quyền**: người có quyền thấy và chạy hết các
     bước, người không có quyền không thấy hướng dẫn.
   - Chạy thử khi **đang ở trang khác** (hướng dẫn phải tự chuyển trang) và khi **dữ liệu rỗng**
     (bước giải thích hiện, không có bước trỏ vào chỗ trống).
   - Đi lùi từ bước sau bước `click` thì khung đã mở được đóng lại.
   - Không còn tour nào chỉ có 0 bước với một nhóm quyền nào đó.

## 7. Danh mục hiện có

| Phân hệ | `tourId` | Hướng dẫn | Trang | Ai thấy | File tour |
|---|---|---|---|---|---|
| `chr` (nhóm Nhân viên) | `employee-create` | Thêm một nhân viên | `/management/employees` (bước bấm Thêm nhân viên), chạy tiếp ở `/management/employees/new` | ADMIN, HR + `employee:create` | `employee-list.ts` (nửa đầu), `employee-new.ts` (nửa sau) |
| `chr` (nhóm Nhân viên) | `employee-import` | Nhập nhân viên từ Excel | `/management/employees` | ADMIN, HR + `employee:import` | `employee-list.ts` |
| `chr` (nhóm Nhân viên) | `employee-view` | Xem thông tin nhân viên | `/management/employees` (bước bấm mã nhân viên dòng đầu), chạy tiếp ở hồ sơ; đang ở một hồ sơ thì chạy thẳng phần hồ sơ | quản lý + `employee:read` | `employee-list.ts`, `employee-detail.ts` |
| `chr` (nhóm Nhân viên) | `employee-account` | Reset mật khẩu, khóa tài khoản | như trên | ADMIN, HR + `employee:update` hoặc `employee:delete`; đang sửa hồ sơ hoặc tài khoản đã khóa thì tour giải thích | `employee-list.ts`, `employee-detail.ts` |
| `chr` (nhóm Hợp đồng) | `contract-create` | Thêm hợp đồng | `/management/contracts` (bước bấm Xem chi tiết dòng đầu), chạy tiếp ở thẻ Hợp đồng của hồ sơ; đang ở một hồ sơ thì chạy thẳng phần hồ sơ | ADMIN, HR + `contract:create`, gói `CONTRACT_INSURANCE`; danh sách hợp đồng trống thì tour chỉ đường qua mục Nhân viên | `contract-list.ts` (nửa đầu), `employee-detail.ts` (nửa sau) |
| `adm` | `office-supply-catalog` | Tạo danh mục văn phòng phẩm | `/management/office/settings?tab=supplies` | quản lý + `office:manage` | `office-settings.ts` |
| `adm` | `office-supply-quota` | Đặt định mức theo phòng | `/management/office/settings?tab=quotas` | quản lý + `office:manage` | `office-settings.ts` |
| `adm` | `office-supply-period-open` | Mở kỳ văn phòng phẩm | `/management/office/supply-periods` | quản lý + `office:supply:manage` | `office-supply-period.ts` |
| `adm` | `office-supply-register` | Đăng ký văn phòng phẩm | `/office/supplies` | mọi nhân viên | `office-supplies.ts` |
| `adm` | `office-supply-contact` | Chọn người nhận hàng | `/office/supplies` | vai trò quản lý; không phải trưởng phòng thì tour giải thích | `office-supplies.ts` |
| `adm` | `office-room-booking` | Đặt phòng họp | `/office/rooms` | mọi nhân viên | `office-rooms.ts` |
| `eng` | `announcement-create` | Tạo thông báo | `/management/announcements` (bước bấm Tạo thông báo), chạy tiếp ở `/management/announcements/create`; đang ở trang tạo thì chạy thẳng phần form | ADMIN, HR + `announcement:read-admin` | `announcement-list.ts` (nửa đầu), `announcement-create.ts` (nửa sau) |
| `eng` | `announcement-recall` | Thu hồi thông báo | `/management/announcements` | ADMIN, HR + `announcement:read-admin`; phân hệ chỉ xem hoặc chưa có thông báo nào đang hiển thị thì tour giải thích | `announcement-list.ts` |
| `eng` | `announcement-search` | Tìm kiếm thông báo | `/management/announcements` | vai trò quản lý trong menu + `announcement:read-admin` | `announcement-list.ts` |
| `tsk` | `tasks-report` | Xem báo cáo công việc | `/cong-viec/bao-cao` (bước đầu chuyển về thẻ Tiến độ) | `TASKS` + `showWhen: 'taskReports'` | `tasks.ts` (tour trang, tự bật) |
| `tsk` | `kpi-review` | Chấm KPI nhân viên | `/kpi/danh-gia` | `TASKS` + `showWhen: 'kpiReviewer'`; chưa có phiếu thì tour giải thích | `kpi.ts` (tour trang, tự bật) |
| `tsk` | `kpi-periods` | Mở kỳ đánh giá KPI | `/management/kpi/ky` | `TASKS` + `kpi:manage`; chưa có kỳ thì tour giải thích | `kpi.ts` (tour trang, tự bật) |
| `tsk` | `kpi-settings` | Cài đặt chỉ tiêu KPI | `/management/kpi/cai-dat` | `TASKS` + `kpi:manage` | `kpi.ts` (tour trang, tự bật) |
| `tsk` | `tasks-my` | Làm việc được giao | `/cong-viec` (bước đầu chuyển về Danh sách) | mọi nhân viên, gói `TASKS` | `tasks.ts` (tour trang, tự bật) |
| `tsk` | `tasks-board` | Kéo việc trên Bảng việc | `/cong-viec?mode=board`; đang ở thẻ Việc của một dự án thì chạy trên bảng của dự án | như trên | `tasks.ts` (tour trang, tự bật) |
| `tsk` | `tasks-timeline` | Đổi hạn trên biểu đồ Tiến độ | `/cong-viec/du-an` (bước bấm mở dự án đầu tiên), chạy tiếp ở trang dự án; đang ở một dự án thì chạy thẳng | như trên | `tasks.ts` (`tasksProjectOpenTour` nửa đầu, `tasksTimelineTour` nửa sau) |
| `tsk` | `tasks-sprints` | Xếp việc vào đợt | như trên; dự án chưa bật đợt thì tour giải thích | như trên | `tasks.ts` (`tasksProjectOpenTour`, `tasksSprintTour`) |
| `tsk` | `tasks-recurrences` | Đặt việc định kỳ | `/cong-viec/dinh-ky` | như trên | `tasks.ts` (tour trang, tự bật) |
| `tsk` | `kpi-my` | Xem KPI của tôi | `/kpi` | như trên; chưa có phiếu thì tour giải thích | `kpi.ts` (tour trang, tự bật) |
| `ast` | `asset-list` | Quản lý tài sản | `/management/assets` | quản lý + `asset:read` | `asset-list.ts` (tour trang, tự bật) |
| `ast` | `asset-my` | Tài sản của tôi | `/assets/my` | mọi nhân viên | `asset-my.ts` (tour trang, tự bật) |

Mốc `data-tour` đang dùng:

| Trang | Mốc |
|---|---|
| `management/employees/index.vue` | `emp-create-open`, `emp-import-open`, `emp-filters`, `emp-row-open` (mã nhân viên dòng đầu) |
| `components/modules/employee/EmployeeImportModal.vue` | `emp-import-template`, `emp-import-upload`, `emp-import-submit` |
| `management/employees/new.vue` | `emp-new-account`, `emp-new-work`, `emp-new-personal`, `emp-new-submit` |
| `management/employees/[id].vue` | `emp-detail-head`, `emp-detail-tabs`, `emp-detail-info`, `emp-detail-edit`, `emp-reset`, `emp-lock`, `emp-terminate` |
| `components/modules/employee/EmployeeContracts.vue` (thẻ Hợp đồng của hồ sơ) | `contract-add`, `contract-form-basics` (số, loại, ngày), `contract-form-terms` (lương, chức vụ, ghi chú, file), `contract-form-submit` |
| `management/contracts/index.vue` | `contract-import`, `contract-row-open` (Xem chi tiết của dòng đầu) |
| `management/office/settings.vue` (thẻ Văn phòng phẩm ở `components/modules/office/SupplyCatalogTab.vue`) | `supply-import` (nút Nhập từ Excel), `supply-toolbar`, `supply-item-add`, `supply-item-groups` (dòng mặt hàng đầu tiên), `supply-group-add`, `quota-department`, `quota-rows` |
| `management/office/supply-periods/index.vue` | `period-open`, `period-list` (nhóm Đang diễn ra; chưa có kỳ đang diễn ra thì cả nhóm Đã đóng), `period-suggest` (khung gợi ý mở kỳ tháng sau, chỉ khi có gợi ý) |
| `management/office/supply-periods/[id].vue` (chưa có tour; mốc đặt sẵn) | `period-stage`, `period-departments`, `period-next-step` (chỉ khi có việc tiếp theo), `period-unpriced` (chỉ khi có mặt hàng thiếu đơn giá), `period-summary`, `period-save-bar` |
| `components/modules/office/PeriodCreateModal.vue` | `period-form-basics`, `period-form-departments`, `period-form-submit` |
| `office/supplies.vue` (và `components/modules/office/SupplyContactPicker.vue`) | `supply-period-bar`, `supply-contact`, `supply-contact-pick`, `supply-contact-form` (popover neo nút Đổi), `supply-request-tabs` (thẻ phiếu đang đăng ký, hoặc nút Phiếu khác khi chỉ có một phiếu mở), `supply-copy-previous`, `supply-toolbar`, `supply-lines` (dòng đầu tiên của nhóm đầu: cả nhóm vài chục dòng thì ô sáng không chỉ được gì), `supply-custom`, `supply-footer` |
| `office/rooms.vue` | `room-tabs`, `room-filters`, `room-calendar`, `room-book` |
| `management/announcements/index.vue` | `ann-create-open`, `ann-search`, `ann-date`, `ann-reset`, `ann-row` (dòng đầu), `ann-status`, `ann-recall`, `ann-recall-menu` (ba mốc sau chỉ ở thông báo chưa thu hồi đầu tiên) |
| `cong-viec/index.vue` (và `TaskFilterBar`, `TaskMyRow`, `TaskBoard`) | `task-create`, `task-review`, `task-groups`, `task-row` (dòng đầu), `task-board-tab`, `task-board`; bước kéo thẻ trỏ `[data-sortable-id]` |
| `cong-viec/du-an/index.vue` | `project-card` (thẻ dự án đầu tiên) |
| `cong-viec/du-an/[code].vue` (`TaskTimeline`, `TaskSprintPlanner`) | `task-timeline`, `task-sprint`, `task-backlog`, cùng các mốc bảng việc ở trên |
| `cong-viec/dinh-ky.vue` | `task-recurrence-create`, `task-recurrence-row` |
| `cong-viec/bao-cao.vue` | `task-report-filters`, `task-report-table`, `task-report-export` |
| `kpi/index.vue`, `kpi/danh-gia.vue` | `kpi-periods`, `kpi-review-list`, `kpi-next`; các bước còn lại trỏ `data-testid` `kpi-score`, `kpi-lines`, `kpi-feedback-box`, `kpi-submit-box` |
| `management/kpi/ky.vue`, `management/kpi/cai-dat.vue` | `kpi-open-period`, `kpi-counts`, `kpi-publish-all`, `kpi-tab-results`, `kpi-tab-indicators`, `kpi-tab-templates`, `kpi-tab-grades` |
| `management/announcements/create.vue` | `ann-create-basics`, `ann-create-body`, `ann-create-extras` (liên kết và file đính kèm), `ann-create-recipients`, `ann-create-actions` |

## 8. Giới hạn đã biết

- Một tour chạy trên **một trang**: đổi trang là tour tắt. Việc trải qua nhiều trang (chốt rồi cấp
  hàng ở trang chi tiết kỳ) thì tách thành nhiều hướng dẫn, hoặc kết thúc bằng một bước không `target`
  chỉ đường sang trang sau.
- Ngoại lệ là việc **bắt đầu bằng một nút chuyển trang**, ví dụ "Tạo thông báo": cả hai trang cùng
  đăng ký một `tourId`. Trang đầu có bước `click` vào nút, và `@click` của nút đặt
  `tour.pending.value = '<tourId>'` khi tour đó đang chạy. Trang sau đăng ký cùng `tourId` nên tự
  chạy tiếp phần của nó. `to` của hướng dẫn là trang đầu; đang đứng ở trang sau thì hướng dẫn chạy
  thẳng phần của trang sau. `useGuideTour` gỡ đăng ký theo đúng hàm của trang nên hai trang không
  xoá tour của nhau.
- Trang có `[id]` trong đường dẫn không làm `to` được, vì `to` phải là đường dẫn cố định. Có hai
  cách:
  - Bắt đầu ở trang danh sách bằng bước bấm mở một dòng, rồi trang `[id]` chạy tiếp theo cách
    chuyển trang ở trên. Hồ sơ nhân viên đang làm vậy, với mã nhân viên dòng đầu là một
    `NuxtLink` thật để "Bấm giúp tôi" bấm được.
  - Mở tour bằng nút Hướng dẫn cạnh tiêu đề (`UiTourButton`), như chi tiết tài sản.
- "Là trưởng phòng" chưa có trên `user` lúc đăng nhập, nên hướng dẫn "Chọn người nhận hàng" hiện cho
  mọi vai trò quản lý (mục 4).
- Danh mục hướng dẫn viết ở FE, nên mobile chưa dùng chung được. Khi mobile cần thì chuyển danh mục
  sang BE như `app-catalog`.
