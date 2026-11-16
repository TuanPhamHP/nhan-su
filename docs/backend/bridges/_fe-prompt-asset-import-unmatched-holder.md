# FE prompt — Nhập Excel tài sản: người không xác định được thì vẫn nhập vào kho (web)

> Handoff cho agent FE (RULE #2, pha P3). Backend xong, smoke 23/23 trên sandbox ngày 16/11/2026.
> Tự chứa: người nhận không thấy hội thoại bên BE.

Phòng Hành chính Nhân sự nhập file Excel tài sản thì cả dòng bị trả lỗi "Không tìm thấy nhân viên …" và tài sản không vào
hệ thống. Nay backend đổi: ô **Người sử dụng** không xác định được ai (không tìm thấy, trùng tên nhiều người, người không
còn làm việc) thì tài sản **vẫn được tạo**, nằm trong kho ở trạng thái Sẵn sàng, chưa cấp phát cho ai. Response có thêm
mảng `warnings` liệt kê các dòng đó. Sheet Dịch vụ tương tự với ô **Người phụ trách**: người nhập file thành người phụ
trách. Việc của web là **hiện `warnings` riêng với `errors`** trong hộp nhập Excel.

## ① Repo và nhánh

- Làm trong worktree **`/home/tuanpham/work/hr-system/.worktrees/fe-asset-import`**, nhánh
  `feat/asset-import-unmatched-holder` của `nhan-su`, tách từ `develop` (7baa4d3). Không làm ở checkout chính
  `/home/tuanpham/work/hr-system/nhan-su`.
- `node_modules` là symlink sang `nhan-su/node_modules`. **Không thêm package mới.** Nếu build báo thiếu gói vì
  `node_modules` chính cũ hơn `package.json`, xoá symlink rồi `npm ci` ngay trong worktree, đừng cài vào checkout chính.
- Nhánh đã có sẵn thay đổi chưa commit: `docs/backend/bridges/assets.md` và file này
  (`docs/backend/bridges/_fe-prompt-asset-import-unmatched-holder.md`), đồng bộ từ BE. Giữ nguyên, đừng sửa.
- `.env.sandbox` (đã tạo, git bỏ qua) trỏ API vào sandbox `http://localhost:3140`.
- BE ở worktree `/home/tuanpham/work/hr-system/.worktrees/be-asset-import` (nhánh cùng tên, **chưa commit**, chưa có
  trên môi trường nào).

## ② Đọc trước khi viết dòng code đầu tiên

1. `fe-asset-import/CLAUDE.md`.
2. `fe-asset-import/docs/backend/bridges/assets.md`, mục **"Nhập Excel"** (`POST /v1/asset-imports`): ví dụ response có
   `warnings`, các gạch đầu dòng về luồng mới; và kiểu `ImportResult` trong phần TypeScript types.
3. File này.
4. **Type đối chiếu với `/home/tuanpham/work/hr-system/.worktrees/be-asset-import/docs/openapi.json`** (schema
   `ImportResultDto`, `ImportRowWarningDto`). Không dùng `hr-system-be/docs/openapi.json` hay `nhan-su/docs/api-endpoint.json`.
5. Code hiện có: `app/components/modules/asset/AssetImportModal.vue` (toàn bộ), `app/types/asset.types.ts`
   (`AssetImportResult`), `app/services/asset.service.ts` (`importFromExcel`).

## ③ Thay đổi API

Không có endpoint mới. `POST /v1/asset-imports` (201) thêm **một trường**, mọi trường cũ giữ nguyên:

```ts
warnings: {
  sheet: 'Tài sản' | 'Dịch vụ';
  row: number;          // số dòng trong Excel, dòng 1 là tiêu đề
  messages: string[];   // câu đầy đủ cho người dùng, hiện nguyên văn
  assetId: number;      // tài sản đã tạo từ dòng này
  assetCode: string;    // VD "CTYSTH000012"
}[];
```

- `created.physical` / `created.service` **đã tính** các dòng trong `warnings`.
- Dòng có lỗi khác (ngày sai, thiếu loại...) vẫn nằm ở `errors` như cũ; `messages` khi đó có thêm câu về người.
- Câu mẫu trong `warnings`:
  - `Không tìm thấy nhân viên Trieu Thai Nguyen, có phải Triệu Thái Nguyên (EMP054)? Tài sản CTA000006 đã vào kho, chưa cấp phát cho ai. Bạn cấp phát trên trang tài sản, đừng nhập lại dòng này.`
  - `Không tìm thấy nhân viên Không Có Ai. Bạn đang là người phụ trách dịch vụ CTA000010. Bạn đổi người phụ trách trên trang dịch vụ, đừng nhập lại dòng này.`
- Không có mã lỗi mới, không có thông báo (chuông) nào khi nhập.

## ④ Màn hình và file phải sửa

| File | Việc |
|---|---|
| `app/types/asset.types.ts` | `AssetImportResult` thêm `warnings: AssetImportRowWarning[]`, khai `AssetImportRowWarning` đúng shape ở ③ |
| `app/components/modules/asset/AssetImportModal.vue` | Xem dưới |

`AssetImportModal.vue`:

1. **Màn chọn file:** thêm một câu vào khối giới thiệu (cạnh câu "Loại và nhà cung cấp chưa có sẽ được tạo tự động"):
   *"Người sử dụng không tìm thấy trên hệ thống thì tài sản vẫn được nhập vào kho, chưa cấp phát cho ai."*
2. **Màn kết quả, hàng ô tổng:** thêm ô thứ ba **"Chưa gắn người dùng"** = `warnings.length`, tông hổ phách (amber) khi
   lớn hơn 0, xám khi bằng 0, cùng kiểu với hai ô "Đã nhập", "Dòng lỗi". Trên màn 390 px ba ô không được tràn hay cắt chữ.
3. **Bảng cảnh báo**, đặt **trước** bảng lỗi, chỉ hiện khi có `warnings`:
   - Tiêu đề nhỏ: *"Đã nhập nhưng chưa gắn người dùng"*.
   - Cột: Sheet · Dòng · Tài sản · Nội dung. Cột Tài sản là `assetCode` dạng link tới `/management/assets/{assetId}`,
     **mở tab mới** để danh sách cảnh báo trong hộp vẫn còn.
   - Nội dung là `messages.join(' ')`, chữ màu amber, không đổi câu của BE.
   - Dưới bảng: *"Các tài sản trên đã có trong hệ thống. Bạn mở từng tài sản để cấp phát, đừng nhập lại các dòng này vì sẽ
     tạo trùng tài sản."*
4. **Bảng lỗi giữ nguyên**, câu dưới bảng lỗi giữ nguyên ("Các dòng hợp lệ đã được nhập. Sửa những dòng trên…").
5. **Toast sau khi nhập**, viết lại để nói cả ba con số khi có (câu trọn, không dùng dấu ngoặc):
   - Có tạo, không cảnh báo, không lỗi: như cũ.
   - Có cảnh báo: *"Đã nhập N tài sản, gồm X thiết bị và Y dịch vụ. Trong đó W tài sản chưa gắn người dùng, bạn xem bảng
     bên dưới."* Có thêm lỗi thì nối *"Còn E dòng lỗi."*
   - Không tạo được gì: như cũ.

## ⑤ Kịch bản FE phải smoke (bấm thật trên UI, cả màn rộng và màn 390 px)

**Môi trường:** sandbox BE đang chạy ở `http://localhost:3140` (Postgres, Redis trong container dùng một lần; dữ liệu đã
có sẵn từ lần smoke BE). Web phải chạy ở **cổng 4010** (CORS sandbox chỉ mở 4010):
`npm run build` trong worktree rồi `node /tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/2c4ab2e8-dc5e-4777-9a3a-40711488c6b8/scratchpad/scripts/serve-web.cjs`
(chạy bản build với `.env.sandbox`), hoặc `npx nuxt dev --dotenv .env.sandbox --port 4010`.

**Tài khoản** (mật khẩu là hằng `PASSWORD` trong `scripts/tenancy/drills/sandbox.cjs` của BE): HR `hr01@cta.drill` · Trưởng phòng `mgr01@cta.drill` · Nhân viên
`nv010@cta.drill`. Thư mục file test:
`/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/2c4ab2e8-dc5e-4777-9a3a-40711488c6b8/scratchpad/scripts/`.

| # | Vai | Thao tác | Mong đợi |
|---|---|---|---|
| F1 | HR | Tài sản → Nhập Excel → chọn `smoke-import-file.xlsx` | Ô: Đã nhập 12 (9 thiết bị, 3 dịch vụ), Chưa gắn người dùng 5, Dòng lỗi 1. Bảng cảnh báo 5 dòng (4 sheet Tài sản, 1 sheet Dịch vụ), mỗi dòng có mã tài sản. Bảng lỗi 1 dòng (dòng 10) có 2 câu. Toast nói đủ ba số |
| F2 | HR | Bấm mã tài sản ở dòng cảnh báo "Trieu Thai Nguyen" | Tab mới mở trang chi tiết; trạng thái Sẵn sàng; ghi chú có "Người sử dụng ghi trong file nhập: Trieu Thai Nguyen". Hộp nhập ở tab cũ vẫn còn bảng |
| F3 | HR | Ở trang đó: Tác vụ → Cấp phát cho Triệu Thái Nguyên | Cấp phát thành công (chỉ xác nhận luồng nối được, không sửa gì ở màn này) |
| F4 | HR | Nhập file khác → `fe-file-all-matched.xlsx` | Đã nhập 2, Chưa gắn người dùng 0 (ô xám), không có bảng cảnh báo, không có bảng lỗi; toast như cũ |
| F5 | HR | Nhập file khác → `fe-file-warnings-only.xlsx` | Đã nhập 2, Chưa gắn người dùng 2, Dòng lỗi 0; có bảng cảnh báo, không có bảng lỗi và không có câu "Sửa những dòng trên…" |
| F6 | HR, màn 390 px | Lặp F1 | Ba ô đọc được, bảng cuộn ngang hoặc xuống dòng gọn, link bấm được, nút Xong và Nhập file khác không bị che |
| F7 | Trưởng phòng, nhân viên | Mở `/management/assets` (nhân viên: thử gõ thẳng URL) | Không có nút Nhập Excel, như hiện tại |
| F8 | — | `npm run build` và `npx vitest run` trong worktree | Xanh. In exit code |

## ⑥ Báo lại cho BE

- Danh sách file đã sửa.
- **Bảng smoke** `# | Vai | Thao tác | Mong đợi | Thực tế | ✓/✗`, kèm ảnh chụp F1 (màn rộng) và F6 (390 px).
- Exit code của `npm run build`, `npx vitest run`.
- Chỗ lệch giữa bridge doc, `openapi.json` của worktree BE và response thật, nếu có.

## ⑦ Giới hạn

- Không sửa repo BE. Không sửa `docs/backend/bridges/assets.md` hay file này.
- **Không tự workaround ở FE một contract sai của BE.** Response khác ③ thì dừng và báo lại, không đoán.
- Không commit, không push: BE gom và commit cả hai repo sau P5.
- Không đổi màn khác ngoài hai file ở ④. Không thêm package.
- Không dừng hay khởi động lại sandbox BE (cổng 3140, 55440, 56440); nó dùng chung với BE.
