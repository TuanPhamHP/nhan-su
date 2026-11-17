# FE prompt — Nhãn chủ đề trợ lý cho playbook Tài sản, Tuyển dụng (web)

> Handoff cho agent FE (RULE #2, pha P3). Backend xong 16/11/2026: 14 tool đọc, 5 playbook mới, smoke 41/41 trên
> sandbox, bench router 169 ca sạch. Tự chứa: người nhận không thấy hội thoại bên BE.

Trợ lý AI vừa có 5 playbook mới cho hai module bán riêng (Tài sản, Tuyển dụng). Màn thống kê trợ lý
(`/agent-usage`), bảng đánh giá và bản ghi hội thoại hiện tên chủ đề qua bảng `PLAYBOOK_LABELS`; id nào thiếu
trong bảng thì hiện id thô (`asset-my`). Bảng này còn thiếu sẵn 3 playbook cũ. Việc của web chỉ là **bổ sung
nhãn**. Không có endpoint, sự kiện SSE hay kiểu dữ liệu mới.

## ① Repo và nhánh

- Làm trong worktree **`/home/tuanpham/work/hr-system/.worktrees/fe-agent-modules`**, nhánh
  `feat/agent-asset-recruit` của `nhan-su`, tách từ `develop` (4dcee4e). Không làm ở checkout chính
  `/home/tuanpham/work/hr-system/nhan-su` (đang có thay đổi chưa commit của phiên khác, đừng đụng).
- `node_modules` là symlink sang `nhan-su/node_modules`. **Không thêm package mới.**
- Nhánh đã có thay đổi chưa commit: `docs/backend/bridges/ai-agent.md` và file này
  (`docs/backend/bridges/_fe-prompt-agent-asset-recruit.md`), đồng bộ từ BE. Giữ nguyên, đừng sửa.
- `.env.sandbox` (đã tạo, git bỏ qua) trỏ API vào sandbox `http://localhost:3140`.
- BE ở worktree `/home/tuanpham/work/hr-system/.worktrees/be-agent-modules` (nhánh cùng tên, chưa commit).

## ② Đọc trước khi viết dòng code đầu tiên

1. `fe-agent-modules/CLAUDE.md`.
2. `fe-agent-modules/docs/backend/bridges/ai-agent.md`, mục **"Playbook & tool — để hiển thị cho đúng"**
   (bảng `playbookId`) và mục **"Tool đọc thêm ngày 16/11/2026"**.
3. File này.
4. `app/types/agent-analytics.types.ts` (`PLAYBOOK_LABELS`), và ba chỗ dùng nó:
   `app/components/modules/agent/AgentTopicTable.vue`, `AgentFeedbackPanel.vue`, `AgentConversationTranscript.vue`.

## ③ Thay đổi API

Không đổi contract. Trường `playbookId` (sự kiện `status`/`done`, `topics` của analytics, phản hồi đánh giá) có
thể mang thêm 5 giá trị mới. Ba giá trị cũ đã có từ trước nhưng web chưa có nhãn.

## ④ File phải sửa

Chỉ `app/types/agent-analytics.types.ts`, thêm vào `PLAYBOOK_LABELS` (nhãn ngắn, cùng giọng với các dòng đang có):

| `playbookId` | Nhãn |
|---|---|
| `asset-my` | Tài sản của tôi |
| `asset-lookup` | Tra cứu tài sản |
| `asset-value` | Giá trị, chi phí tài sản |
| `recruit-my` | Phỏng vấn của tôi |
| `recruit-overview` | Tổng quan tuyển dụng |
| `request-history` | Tra đơn từ |
| `request-history-denied` | Hỏi đơn của người khác |
| `navigation` | Chỉ đường màn hình |

Không thêm gợi ý câu hỏi mới vào khung chat (`SUGGESTIONS` trong `AgentChatPanel.vue`): công ty có thể chưa bật
hai module.

## ⑤ Kịch bản FE phải smoke (bấm thật, màn rộng và 390 px)

**Môi trường:** sandbox BE đang chạy ở `http://localhost:3140`, đã có 28 lượt chạy giả cho 9 playbook. Web phải
chạy ở **cổng 4010** (CORS sandbox chỉ mở 4010): `npm run build` trong worktree rồi
`node /tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/2c4ab2e8-dc5e-4777-9a3a-40711488c6b8/scratchpad/scripts/serve-web-agent.cjs`
(chạy bản build với `.env.sandbox`), hoặc `npx nuxt dev --dotenv .env.sandbox --port 4010`.
**Tài khoản:** ADMIN `admin@cta.drill`, mật khẩu là hằng `PASSWORD` trong `scripts/tenancy/drills/sandbox.cjs` của BE.

| # | Vai | Thao tác | Mong đợi |
|---|---|---|---|
| F1 | ADMIN | Mở `/agent-usage`, xem bảng chủ đề | Đủ 9 dòng, KHÔNG dòng nào hiện id thô: Tài sản của tôi 5, Tra cứu tài sản 4, Phỏng vấn của tôi 3, Tổng quan tuyển dụng 3, Giá trị, chi phí tài sản 2, Tra đơn từ 2, Chỉ đường màn hình 2, Hỏi đơn của người khác 1, Quỹ phép cá nhân 6 |
| F2 | ADMIN, 390 px | Lặp F1 | Bảng không tràn ngang, nhãn dài không cắt chữ |
| F3 | — | `npm run build`, `npx vitest run` trong worktree | build exit 0; vitest chỉ còn 2 ca đỏ sẵn có ở `tests/leave.test.ts` (TC14, TC45) |

## ⑥ Báo lại cho BE

- File đã sửa.
- **Bảng smoke** `# | Vai | Thao tác | Mong đợi | Thực tế | ✓/✗`, kèm ảnh chụp F1 (màn rộng) và F2 (390 px).
- Exit code của `npm run build`, `npx vitest run`.
- Id playbook nào trên trang còn hiện thô, nếu có.

## ⑦ Giới hạn

- Không sửa repo BE. Không sửa `docs/backend/bridges/ai-agent.md` hay file này.
- **Không tự workaround ở FE một contract sai của BE.** Thấy `playbookId` lạ không có trong bảng ở ④ thì báo lại.
- Không commit, không push: BE gom và commit cả hai repo sau P5.
- Không đổi file nào khác ngoài `app/types/agent-analytics.types.ts`. Không thêm package.
- Không dừng hay khởi động lại sandbox BE (cổng 3140, 55440, 56440). Xong thì tắt web 4010 của mình.
