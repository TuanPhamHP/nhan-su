# Bridge Docs — Hồ sơ mở rộng (lô 3a)

> Thiết kế: `docs/modules/02-employee.md` mục "Lô 3a". Phiếu: `docs/templates/hr-profile/ho-so-nhan-su.md` (F-01..F-06, F-18).
> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ `{ success, data, meta }`. Tài liệu nhân viên ở
> [employee-documents.md](./employee-documents.md).

Lô 3a thêm cho mỗi nhân viên: hồ sơ mở rộng (quốc tịch, hôn nhân, email cá nhân, trình độ, ngân hàng, MST riêng), thân nhân
(người phụ thuộc, liên hệ khẩn cấp), kinh nghiệm trước khi vào công ty, lịch sử công tác, và luồng **yêu cầu thay đổi**: trường
liên hệ nhân viên tự sửa, trường nhạy cảm nhân viên gửi yêu cầu, HR duyệt mới ghi vào hồ sơ.

---

## 1. Quyền và phạm vi

| Quyền | Mặc định | Dùng cho |
|---|---|---|
| `employee:read` | Mọi vai trò | Xem hồ sơ cơ bản, kinh nghiệm, lịch sử, **trong phạm vi** |
| `employee:update` | HR | Sửa hồ sơ mở rộng, thân nhân, kinh nghiệm của người khác |
| `employee:private:read` | HR | Xem ngân hàng, MST, thân nhân, liên hệ khẩn cấp, giấy tờ nhạy cảm của **người khác**. Mỗi lần xem ghi nhật ký `employee.private_view` |
| `employee:profile-change:approve` | HR | Duyệt, từ chối yêu cầu thay đổi |
| `employee:document-type:manage` | HR | Thêm, sửa, tắt loại giấy tờ |

ADMIN bỏ qua mọi quyền. Các route mới **không gắn `@Roles`**: tick quyền cho vai trò nào ở màn phân quyền là vai trò đó dùng được.

**Phạm vi (Q-04):** `ADMIN`, `HR`, `DIRECTOR`, `CHIEF` xem toàn công ty; `MANAGER` chỉ nhân viên có `departmentId` là phòng mình
(không có phòng thì chỉ chính mình); `EMPLOYEE` chỉ chính mình. Áp cho `GET /employees/:id`, tài liệu, hồ sơ mở rộng, kinh nghiệm,
lịch sử công tác. Ngoài phạm vi trả **403 `EMPLOYEE_SCOPE_FORBIDDEN`**. Trước lô 3a trưởng phòng xem được mọi phòng.

**Thêm, sửa, xoá thân nhân của người khác cần cả `employee:update` và `employee:private:read`** (response có số định danh).

---

## 2. TypeScript types

```typescript
// types/hr-profile.types.ts

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
export type EducationLevel = 'NONE' | 'ELEMENTARY_VOCATIONAL' | 'INTERMEDIATE' | 'COLLEGE' | 'UNIVERSITY' | 'MASTER' | 'DOCTOR';
export type RelativeRelationship = 'CHILD' | 'SPOUSE' | 'FATHER' | 'MOTHER' | 'FATHER_IN_LAW' | 'MOTHER_IN_LAW' | 'SIBLING' | 'OTHER';
export type DependentRegistration = 'NOT_REGISTERED' | 'SUBMITTED' | 'REGISTERED' | 'UNVERIFIED';
export type ProfileChangeSection = 'BASIC' | 'BANK' | 'TAX' | 'CITIZEN_ID' | 'RELATIVE' | 'EXPERIENCE';
export type ProfileChangeAction = 'UPDATE' | 'CREATE' | 'DELETE';
export type ProfileChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** Phần không nhạy cảm. */
export interface EmployeeProfile {
  employeeId: number;
  nationality: string | null;          // null hiểu là Việt Nam
  maritalStatus: MaritalStatus | null;
  maritalStatusLabel: string | null;   // 'Đã kết hôn'
  personalEmail: string | null;
  educationLevel: EducationLevel | null;
  educationLevelLabel: string | null;  // 'Đại học'
  updatedAt: string | null;
}

export interface MyProfile extends EmployeeProfile {
  email: string;           // email công việc, đổi qua yêu cầu BASIC
  phone: string | null;    // tự sửa
  address: string | null;  // tự sửa
}

export interface Relative {
  id: number;
  fullName: string;
  relationship: RelativeRelationship;
  relationshipLabel: string;           // 'Con', 'Vợ hoặc chồng', ...
  dateOfBirth: string | null;
  identityNumber: string | null;       // số định danh 12 số, cũng là MST người phụ thuộc
  occupation: string | null;
  phone: string | null;
  isEmergencyContact: boolean;
  isPrimaryEmergency: boolean;         // mỗi nhân viên một người
  isDependent: boolean;
  dependentFrom: string | null;        // ngày 1 của tháng bắt đầu giảm trừ
  dependentTo: string | null;          // ngày 1 của tháng cuối; null là đang giảm trừ
  livesWith: boolean;
  registration: DependentRegistration | null;
  registrationLabel: string | null;
  note: string | null;
  updatedAt: string;
}

/** Ngân hàng, MST, liên hệ khẩn cấp. Chỉ qua endpoint có ghi nhật ký. */
export interface PrivateProfile {
  employeeId: number;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  taxCode: string | null;              // MST riêng (người nước ngoài, MST 10 số cũ)
  effectiveTaxCode: string | null;     // MST dùng thật: taxCode, không có thì số CCCD
  effectiveTaxCodeSource: 'TAX_CODE' | 'CITIZEN_ID' | null;
  emergencyContacts: Relative[];
}
export interface MyPrivateProfile extends PrivateProfile {
  relatives: Relative[];               // mọi thân nhân của chính mình
}

export interface WorkExperience {
  id: number;
  companyName: string;
  title: string | null;
  fromMonth: string | null;            // ngày 1 của tháng
  toMonth: string | null;
  description: string | null;
  leaveReason: string | null;
  source: 'MANUAL' | 'RECRUITMENT';
  sourceLabel: string;                 // 'Nhập tay' | 'Từ hồ sơ ứng viên'
}

export interface EmploymentHistoryItem {
  id: number;
  department: { id: number; name: string } | null;
  position: { id: number; name: string } | null;
  manager: { id: number; name: string } | null;
  employmentType: string;
  employmentTypeLabel: string;
  changeType: 'INITIAL' | 'HIRE' | 'DEPARTMENT' | 'POSITION' | 'MANAGER' | 'EMPLOYMENT_TYPE' | 'MULTIPLE';
  changeTypeLabel: string;             // 'Đổi phòng ban', 'Thay đổi công tác', ...
  source: 'SYSTEM_INIT' | 'MANUAL' | 'IMPORT' | 'RECRUITMENT';
  sourceLabel: string;
  startedAt: string;
  endedAt: string | null;              // null là giai đoạn đang mở
  note: string | null;
  createdBy: { id: number; name: string } | null;
  createdAt: string;
}

export interface ProfileChangeField {
  key: string;            // 'bankAccountNumber'
  label: string;          // 'Số tài khoản'
  before: string | null;  // giá trị lúc gửi, đã đổi sang chữ (mã enum → nhãn, ngày dd/MM/yyyy, tháng MM/yyyy)
  after: string | null;   // giá trị đề nghị; null với DELETE
  current?: string | null; // chỉ ở chi tiết cho người duyệt
}

export interface ProfileChange {
  id: number;
  employee: { id: number; employeeCode: string; fullName: string; departmentName: string | null };
  section: ProfileChangeSection;
  sectionLabel: string;    // 'Tài khoản ngân hàng'
  action: ProfileChangeAction;
  actionLabel: string;     // 'Sửa' | 'Thêm' | 'Xoá'
  targetId: number | null;
  changedFields: string[];
  documentCount: number;
  status: ProfileChangeStatus;
  statusLabel: string;
  cancelReason: string | null;   // 'Thay bằng yêu cầu số 16' | 'Người gửi tự huỷ'
  decidedBy: { id: number; name: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;   // ghi chú duyệt hoặc lý do từ chối
  createdAt: string;
}
/** Yêu cầu của chính mình: có giá trị. */
export interface MyProfileChange extends ProfileChange {
  fields: ProfileChangeField[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}
/** Chi tiết cho người duyệt. */
export interface ProfileChangeDetail extends MyProfileChange {
  current: Record<string, unknown> | null;
  documents: { id: number; fileName: string; type: string; typeLabel: string; uploadedAt: string }[];
  warnings: string[];      // BR-04
}
```

---

## 3. Hồ sơ mở rộng của người khác

| Method | Path | Quyền | Response |
|---|---|---|---|
| GET | `/v1/employees/:id/profile` | `employee:read` + phạm vi | `EmployeeProfile` |
| GET | `/v1/employees/:id/private-profile` | `employee:private:read` + phạm vi | `PrivateProfile`, ghi `employee.private_view` |
| PATCH | `/v1/employees/:id/profile` | `employee:update` + phạm vi | `EmployeeProfile` |

**PATCH body** (mọi trường tuỳ chọn; **không gửi là giữ nguyên, `null` hoặc `""` là xoá**):

| Trường | Kiểm |
|---|---|
| `nationality` | ≤ 60 ký tự |
| `maritalStatus` | `MaritalStatus` |
| `personalEmail` | email |
| `educationLevel` | `EducationLevel` |
| `taxCode` | 10, 12 hoặc 13 chữ số. **Chỉ nhập khi MST khác số CCCD**; trống thì MST là số CCCD |
| `bankName`, `bankBranch` | ≤ 150 |
| `bankAccountNumber` | Server bỏ khoảng trắng, dấu chấm, gạch rồi kiểm **6 đến 20 chữ số** (BR-03) |
| `bankAccountHolder` | ≤ 100 |

Đổi ngân hàng hoặc MST của người khác thì nhân viên đó nhận **N-03** (mục 10). Nhật ký `employee.profile_update` chỉ giữ 4 số cuối
của số tài khoản và MST.

UI-01: khối "Thông tin thêm" gọi `/profile`; khối "Ngân hàng và thuế" ẩn, nút **Xem** (chỉ hiện khi có `employee:private:read`) mới
gọi `/private-profile`. Không gọi `/private-profile` khi tải trang, vì mỗi lần gọi là một dòng nhật ký.

---

## 4. Thân nhân của người khác

| Method | Path | Quyền |
|---|---|---|
| GET | `/v1/employees/:id/relatives` | `employee:private:read` + phạm vi, ghi `employee.private_view` |
| POST | `/v1/employees/:id/relatives` | `employee:update` **và** `employee:private:read` |
| PATCH | `/v1/employees/:id/relatives/:relativeId` | như trên |
| DELETE | `/v1/employees/:id/relatives/:relativeId` | như trên, xoá mềm, 204 |

**POST body:** `fullName` (2–100, bắt buộc), `relationship` (bắt buộc), `dateOfBirth`, `identityNumber` (12 số), `occupation`,
`phone`, `isEmergencyContact`, `isPrimaryEmergency`, `isDependent`, `dependentFrom`, `dependentTo`, `livesWith`, `registration`,
`note`. PATCH nhận mọi trường, tuỳ chọn.

Luật (server áp, FE nên áp trước để báo sớm):
- `isPrimaryEmergency: true` kéo theo `isEmergencyContact: true`; đặt người chính mới thì người chính cũ tự bỏ cờ.
- Người phụ thuộc (`isDependent`) phải có `dependentFrom`; `dependentTo` không trước `dependentFrom`; quan hệ `OTHER` phải
  `livesWith: true`. Sai → 400 `EMPLOYEE_RELATIVE_INVALID`.
- Ngày gửi lên cho `dependentFrom`, `dependentTo` được đưa về **ngày 1 của tháng** (giảm trừ tính theo tháng).
- Người phụ thuộc chưa có `registration` thì là `NOT_REGISTERED`. Thôi là người phụ thuộc thì khoảng giảm trừ và trạng thái đăng
  ký bị xoá. Dữ liệu chuyển từ hồ sơ BHXH cũ có `registration: 'UNVERIFIED'` (Chưa xác nhận), HR cần rà lại.

**Response POST, PATCH:** `{ relative: Relative, warnings: string[] }`. `warnings` có câu **BR-04** khi số định danh đang là người
phụ thuộc của nhân viên khác trong công ty; chỉ cảnh báo, vẫn lưu. FE hiện cảnh báo vàng sau khi lưu.

Thêm, sửa, xoá thân nhân **là người phụ thuộc** (trước hoặc sau khi sửa) thì nhân viên nhận **N-03**.

---

## 5. Kinh nghiệm, lịch sử công tác

| Method | Path | Quyền |
|---|---|---|
| GET | `/v1/employees/:id/work-experiences` | `employee:read` + phạm vi → `WorkExperience[]` |
| POST | `/v1/employees/:id/work-experiences` | `employee:update` + phạm vi |
| PATCH | `/v1/employees/:id/work-experiences/:experienceId` | như trên |
| DELETE | `/v1/employees/:id/work-experiences/:experienceId` | như trên, xoá mềm, 204 |
| GET | `/v1/employees/:id/employment-history` | `employee:read` + phạm vi → `EmploymentHistoryItem[]`, mới nhất trước |

Kinh nghiệm: `companyName` (2–200, bắt buộc), `title`, `fromMonth`, `toMonth` (`YYYY-MM-DD`, lưu ngày 1 của tháng; kết thúc trước
bắt đầu → 400), `description` (≤ 2000), `leaveReason` (≤ 255). Lỗi không tìm thấy: 404 `EMPLOYEE_EXPERIENCE_NOT_FOUND`.

Lịch sử công tác: mỗi dòng là **một giai đoạn** với phòng ban, chức vụ, quản lý, loại lao động lúc đó. Giao diện là lô 3d; API có
sẵn để kiểm. Cách ghi xem mục 9 (`PATCH /employees/:id`).

---

## 6. Tự phục vụ (`/v1/me/...`)

Chỉ cần đăng nhập; mọi route lấy nhân viên từ JWT.

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/v1/me/profile` | `MyProfile` |
| POST | `/v1/me/profile/private` | Body `{ password }` → `MyPrivateProfile`. Như `POST /employees/me/identity`: sai mật khẩu 400 `AUTH_INVALID_CREDENTIALS` (không phải 401), 5 lần khoá 30 phút, 30 lần/5 phút theo IP. **200**, không phải 201 |
| PATCH | `/v1/me/profile/contact` | `{ phone?, personalEmail?, address? }` (`null`/`""` là xoá). **Ghi ngay** → `MyProfile` |
| GET | `/v1/me/emergency-contacts` | `Relative[]` có `isEmergencyContact` |
| POST | `/v1/me/emergency-contacts` | `{ fullName, relationship, phone?, occupation?, isPrimaryEmergency?, note? }`. Ghi ngay, luôn là liên hệ khẩn cấp, **không** là người phụ thuộc |
| PATCH, DELETE | `/v1/me/emergency-contacts/:id` | Người này đang là người phụ thuộc → 409 `PROFILE_RELATIVE_NEEDS_REQUEST` (phải gửi yêu cầu mục RELATIVE) |
| GET | `/v1/me/work-experiences` | Chỉ xem; đổi thì gửi yêu cầu mục EXPERIENCE |
| GET | `/v1/employees/me/documents` | Có sẵn (thiết kế ghi `/v1/me/documents`, không làm thêm route trùng) |

---

## 7. Yêu cầu thay đổi thông tin

### 7.1 Nhân viên gửi

| Method | Path | Ghi chú |
|---|---|---|
| POST | `/v1/me/profile-change-requests` | Body bên dưới → 201 `{ request: MyProfileChange, supersededIds: number[] }` |
| GET | `/v1/me/profile-change-requests` | `MyProfileChange[]`, 100 yêu cầu gần nhất |
| POST | `/v1/me/profile-change-requests/:id/cancel` | Chỉ khi PENDING → 200 `MyProfileChange` (`cancelReason: 'Người gửi tự huỷ'`) |
| POST | `/v1/me/profile-change-requests/documents` | Multipart như upload tài liệu (mục POST ở employee-documents.md) → `EmployeeDocumentResponse`. Giấy tờ ở **trạng thái chờ** |

**Body POST:**

```typescript
{
  section: ProfileChangeSection;
  action?: ProfileChangeAction;   // mặc định UPDATE; CREATE/DELETE chỉ cho RELATIVE, EXPERIENCE
  targetId?: number;              // id thân nhân/kinh nghiệm khi UPDATE, DELETE; không gửi khi CREATE
  after: Record<string, unknown>; // chỉ trường muốn đổi; DELETE gửi {}
  documentIds?: number[];         // tối đa 5, từ /me/profile-change-requests/documents
}
```

| `section` | Trường trong `after` | Ghi chú |
|---|---|---|
| `BASIC` | `fullName`, `email` (công việc), `dateOfBirth`, `gender` (nhận `Nam`/`Nữ`/`Khác` hoặc mã) | Q-02 |
| `BANK` | `bankName`, `bankBranch`, `bankAccountNumber`, `bankAccountHolder` | `null` là xoá |
| `TAX` | `taxCode` | `null`/`""` là bỏ MST riêng, dùng số CCCD |
| `CITIZEN_ID` | `citizenIdNumber`, `fullNameOnCard`, `issuedDate`, `expiryDate`, `issuedPlace`, `hometown`, `birthRegistrationPlace`, `permanentAddress` | Chưa có CCCD thì bắt buộc số và ngày cấp. Ảnh hai mặt gửi kèm như giấy tờ loại `ID_CARD` |
| `RELATIVE` | Như POST thân nhân của HR, **trừ `registration`** | CREATE / UPDATE (`targetId`) / DELETE (`targetId`) |
| `EXPERIENCE` | Như POST kinh nghiệm | CREATE / UPDATE / DELETE |

Server:
- Kiểm `after` theo mục, **cấm trường lạ** → 400 `PROFILE_CHANGE_SECTION_INVALID` (câu lỗi tiếng Việt ở `message`).
- **Bỏ trường giống giá trị hiện tại**; không còn gì khác → 400 `PROFILE_CHANGE_NO_DIFF`.
- Chụp giá trị hiện tại vào `before` để lúc duyệt phát hiện người khác đã sửa chen vào.
- **Q-05:** yêu cầu PENDING cũ cùng (mục, bản ghi đích) tự huỷ, `cancelReason: 'Thay bằng yêu cầu số {id mới}'`, id nằm trong
  `supersededIds`. Vì vậy **gửi lại thì gửi đủ các trường muốn đổi**. Yêu cầu CREATE không thay thế nhau (thêm hai người phụ thuộc
  là hai yêu cầu).
- Giấy tờ kèm theo phải là giấy tờ chờ của chính mình, không đang đi kèm yêu cầu PENDING ở mục khác → 400
  `PROFILE_CHANGE_DOCUMENT_INVALID`. Giấy tờ chờ chỉ hiện sau khi duyệt; từ chối, huỷ, bị thay thì bị xoá. Chỉ chọn được loại có
  `employeeVisible`.
- Gửi xong, người có quyền duyệt nhận **N-01**.

FE gợi ý (UI-04): khối nhạy cảm có nút "Đề nghị thay đổi" mở form điền sẵn giá trị hiện tại (lấy từ `POST /me/profile/private`),
khi gửi chỉ đưa trường đã sửa vào `after`. Hiện yêu cầu PENDING của mục đó ngay dưới khối (lọc `/me/profile-change-requests`).

### 7.2 Người duyệt (`employee:profile-change:approve`)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/v1/profile-change-requests` | `?status=&section=&employeeId=&page=&limit=` → `ProfileChange[]` + `meta`. **Không có giá trị** |
| GET | `/v1/profile-change-requests/:id` | `ProfileChangeDetail`. Ghi `employee.private_view` |
| GET | `/v1/profile-change-requests/:id/documents/:documentId/url` | `{ presignedUrl }`, 1 giờ. Ghi `employee.private_view` |
| POST | `/v1/profile-change-requests/:id/approve` | `{ note? }` → 200 `MyProfileChange` |
| POST | `/v1/profile-change-requests/:id/reject` | `{ note }` **bắt buộc** → 200 `MyProfileChange` |

UI-05 (trang Phê duyệt, tab `profileChanges`): bảng từ `fields` với ba cột Lúc gửi / Đề nghị / Hiện tại. Dòng có `current` khác
`before` nghĩa là đã có người sửa chen vào; duyệt sẽ bị 409, nên tô cảnh báo và gợi ý từ chối. `warnings` (BR-04) hiện phía trên.

Duyệt áp `after` vào hồ sơ trong một transaction, giấy tờ kèm theo thành tài liệu chính thức, người gửi nhận **N-02**. Lỗi:

| Tình huống | HTTP | `code` |
|---|---|---|
| Tự duyệt/từ chối yêu cầu của chính mình (trừ ADMIN) | 403 | `PROFILE_CHANGE_SELF_DECIDE` |
| Không có | 404 | `PROFILE_CHANGE_NOT_FOUND` |
| Đã duyệt, từ chối, huỷ | 409 | `PROFILE_CHANGE_NOT_PENDING` |
| Giá trị hiện tại khác lúc gửi, hoặc bản ghi đích đã bị xoá | 409 | `PROFILE_CHANGE_STALE` |
| Email công việc vừa bị người khác dùng | 409 | `EMPLOYEE_EMAIL_EXISTS` |
| Số CCCD đã có ở nhân viên khác | 409 | `CITIZEN_ID_EXISTS` |
| Từ chối không ghi lý do | 400 | `PROFILE_CHANGE_REJECT_NOTE_REQUIRED` |

`GET /v1/approval/counts` có thêm `profileChanges`: số PENDING của người khác, 0 nếu không có quyền duyệt.

J-01: 08:00 hằng ngày, yêu cầu PENDING quá **2 ngày làm việc** chưa nhắc → nhắc người duyệt một lần (N-01 bản "Nhắc:").

---

## 8. Danh mục loại giấy tờ

| Method | Path | Quyền |
|---|---|---|
| GET | `/v1/employee-document-types` | Đăng nhập. Mặc định chỉ loại đang dùng; `?includeInactive=true` có tác dụng với người có `employee:document-type:manage` |
| POST | `/v1/employee-document-types` | `employee:document-type:manage` |
| PATCH | `/v1/employee-document-types/:id` | như trên. Không xoá, chỉ tắt (`isActive: false`) |

```typescript
export interface EmployeeDocumentType {
  id: number;
  code: string;            // chữ in hoa, số, gạch dưới; server tự viết hoa
  name: string;
  isSensitive: boolean;
  validityMonths: number | null;  // 1–240
  employeeVisible: boolean;
  isSystem: boolean;       // loại mặc định: không đổi được mã
  isActive: boolean;
  sortOrder: number;
}
```

Loại mặc định: `CV`, `RESUME` (Sơ yếu lý lịch), `HEALTH_CERT` (nhạy cảm, 12 tháng), `ID_CARD` (nhạy cảm), `PORTRAIT`, `DEGREE`,
`CONTRACT`, `DEPENDENT_PROOF` (nhạy cảm), `OTHER`. Lỗi: 409 `EMPLOYEE_DOCUMENT_TYPE_CODE_EXISTS`, 400
`EMPLOYEE_DOCUMENT_TYPE_SYSTEM_CODE`, 404 `EMPLOYEE_DOCUMENT_TYPE_NOT_FOUND`. Công ty có sẵn chỉ có `ID_CARD`, `CONTRACT`, `OTHER`
(từ migration) cho tới khi người vận hành chạy `tenancy:seed-all -- --apply`.

---

## 9. Thay đổi ở endpoint có sẵn

| Endpoint | Thay đổi |
|---|---|
| `GET /v1/employees/:id` | Thu hẹp phạm vi trưởng phòng (mục 1) |
| Mọi response nhân viên (`EmployeeResponseDto`) | `gender` **vẫn là nhãn** `'Nam' \| 'Nữ' \| 'Khác'` để app cũ không vỡ; thêm `genderCode: 'MALE' \| 'FEMALE' \| 'OTHER' \| null`. Thêm `terminationReason`, `terminationReasonLabel` |
| `POST /v1/employees`, `PATCH /v1/employees/:id` | `gender` nhận nhãn cũ hoặc mã; chữ lạ → 400 "Giới tính phải là Nam, Nữ hoặc Khác". Form nên chuyển sang ô chọn gửi mã |
| `PATCH /v1/employees/:id` | Thêm `effectiveDate` (`YYYY-MM-DD`, mặc định hôm nay) và `historyNote` (≤ 500). Đổi phòng ban, chức vụ, quản lý, loại lao động thì giai đoạn đang mở kết thúc ngày trước `effectiveDate` và mở giai đoạn mới (BR-02); trùng ngày bắt đầu giai đoạn đang mở thì sửa ngay giai đoạn đó. Sau hôm nay, trước ngày vào làm, trước ngày bắt đầu giai đoạn đang mở → 400 `EMPLOYMENT_EFFECTIVE_DATE_INVALID`. Form chỉ cần hiện ô ngày hiệu lực khi một trong bốn trường đó đổi |
| `POST /v1/employees/:id/terminate` | Thêm `terminationReason` **bắt buộc**: `RESIGNATION`, `CONTRACT_EXPIRED`, `MUTUAL_AGREEMENT`, `PROBATION_FAILED`, `DISMISSAL`, `EMPLOYER_UNILATERAL`, `RETIREMENT`, `DEATH`, `OTHER`. Giai đoạn công tác cuối kết thúc ở ngày nghỉ |
| `PATCH /v1/auth/profile` | Xem [auth-profile.md](./auth-profile.md): họ tên, email công việc, ngày sinh, giới tính tạo yêu cầu BASIC |
| `PUT /v1/social-insurance/:employeeId` | `taxCode`, `dependents`, `dependentDetails` **bị bỏ qua**. Response `taxInfo` đọc từ hồ sơ, xem [social-insurance.md](./social-insurance.md) |
| `/v1/employees/:employeeId/citizen-id` | Thêm `expiryDate`, `birthRegistrationPlace`. Người khác sửa thì nhân viên nhận N-03 |
| `GET /v1/approval/counts` | Thêm `profileChanges` |
| Dashboard `genderBreakdown` | `gender` vẫn là nhãn, thêm `genderCode` |
| `POST /v1/employees/import` | Ba cột tuỳ chọn 25 Ngân hàng, 26 Số tài khoản, 27 Chủ tài khoản (điền một ô thì phải có ngân hàng và số tài khoản). Lưu ngày hết hạn CCCD (cột 17, trước đây đọc nhưng bỏ). Giới tính nhận thêm `Khác`. File mẫu 24 cột cũ vẫn nhập được. Sửa lỗi cũ: cột mã quản lý nhận người đã có trong hệ thống (quản lý đã nghỉ việc thì báo lỗi) |
| `POST`, `PATCH /v1/positions` | Thêm `jobGroup` (`MANAGER` \| `HIGH_SKILL` \| `MID_SKILL` \| `OTHER`, `null` là bỏ); response có `jobGroup`, `jobGroupLabel`. Xem [positions.md](./positions.md) |
| `POST /v1/recruitment/offers/:id/hire` | Nhân viên tạo mới từ ứng viên: chép công ty hiện tại, chức danh thành một kinh nghiệm (`source: RECRUITMENT`); đoán trình độ từ chữ tự do; giai đoạn lịch sử `HIRE` nguồn `RECRUITMENT`; CV gắn loại `CV` |

---

## 10. Thông báo

Nội dung chuẩn ở `docs/notifications/notification-content-map.md` mục "Hồ sơ nhân sự". **Không chứa số tài khoản, MST, số CCCD.**

| Mã | `type` | Người nhận | `refType` | `targetUrl` |
|---|---|---|---|---|
| N-01 | `PROFILE_CHANGE_REQUESTED` | Người có quyền duyệt và ADMIN, trừ người gửi | `profile_change_request` | `/management/approval?tab=profileChanges&id={id}` |
| N-02 | `PROFILE_CHANGE_DECIDED` | Người gửi (kèm email) | `my_profile_change_request` | `/profile?tab=requests&id={id}` |
| N-03 | `PROFILE_UPDATED_BY_HR` | Nhân viên bị người khác sửa ngân hàng, MST, người phụ thuộc, CCCD (kèm email) | `my_profile` | `/profile` |

Cả ba `actionType: 'NAVIGATE_ONLY'`, có push. Mobile định tuyến theo [fcm-notification-routing.json](./fcm-notification-routing.json).

---

## 11. Mã lỗi mới

| `code` | HTTP | Khi nào |
|---|---|---|
| `EMPLOYEE_SCOPE_FORBIDDEN` | 403 | Ngoài phạm vi xem |
| `EMPLOYEE_PRIVATE_FORBIDDEN` | 403 | Giấy tờ nhạy cảm của người khác, thiếu `employee:private:read` |
| `EMPLOYEE_RELATIVE_INVALID` | 400 | Vi phạm luật thân nhân, kinh nghiệm (mục 4, 5) |
| `EMPLOYEE_RELATIVE_NOT_FOUND` | 404 / 400 | Thân nhân không thuộc nhân viên |
| `EMPLOYEE_EXPERIENCE_NOT_FOUND` | 404 | |
| `EMPLOYEE_DOCUMENT_TYPE_INVALID` | 400 | Loại giấy tờ không có, đã tắt, hoặc nhân viên không được thấy |
| `EMPLOYEE_DOCUMENT_DATES_INVALID` | 400 | Hết hạn trước ngày cấp |
| `EMPLOYMENT_EFFECTIVE_DATE_INVALID` | 400 | Mục 9 |
| `PROFILE_RELATIVE_NEEDS_REQUEST` | 409 | Tự sửa người phụ thuộc qua liên hệ khẩn cấp |
| `PROFILE_CHANGE_SECTION_INVALID` | 400 | Mục, thao tác, `after` sai |
| `PROFILE_CHANGE_NO_DIFF` | 400 | Đề nghị giống hiện tại |
| `PROFILE_CHANGE_DOCUMENT_INVALID` | 400 | Mục 7.1 |
| `PROFILE_CHANGE_TARGET_NOT_FOUND` | 404 | `targetId` không phải của mình |
| `PROFILE_CHANGE_NOT_FOUND`, `_NOT_PENDING`, `_STALE`, `_SELF_DECIDE`, `_REJECT_NOTE_REQUIRED` | | Mục 7.2 |
| `CITIZEN_ID_EXISTS`, `EMPLOYEE_EMAIL_EXISTS` | 409 | Trùng với nhân viên khác |
| `EMPLOYEE_DOCUMENT_TYPE_CODE_EXISTS`, `_SYSTEM_CODE`, `_NOT_FOUND` | | Mục 8 |
