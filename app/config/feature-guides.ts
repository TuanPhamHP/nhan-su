import { OFFICE_PERMISSIONS } from '~/utils/permission';
import type { FeatureGuide } from '~/types/guide.types';

/**
 * Danh mục hướng dẫn theo tính năng, gom theo phân hệ (`app` là mã trong `APP_MODULES`).
 *
 * Thêm hướng dẫn mới: viết tour ở `app/tours/`, cho trang đích đăng ký tour bằng `useGuideTour`
 * (hoặc `usePageTour` nếu tour cũng tự hiện cho người mới), rồi thêm một dòng ở đây. `access`
 * dùng đúng luật của mục menu dẫn tới trang đó, để không ai thấy hướng dẫn cho trang mình không
 * vào được.
 */
export const FEATURE_GUIDES: FeatureGuide[] = [
	// ─── Hồ sơ & Hợp đồng ─────────────────────────────────────────────────────────
	// Phân hệ lớn nên chia nhóm theo mục menu (`group`): Nhân viên, rồi Phòng ban, Hợp đồng…
	// Máy chủ chỉ cho HR và ADMIN thêm, nhập, reset mật khẩu và khóa tài khoản, nên các hướng dẫn
	// đó siết thêm `roles` so với mục menu Nhân viên.
	{
		tourId: 'employee-create',
		app: 'chr',
		audience: 'manage',
		group: 'Nhân viên',
		title: 'Thêm một nhân viên',
		description: 'Điền tài khoản, công việc và thông tin cá nhân của một người mới.',
		to: '/management/employees',
		access: { roles: ['ADMIN', 'HR'], permission: 'employee:create' },
	},
	{
		tourId: 'employee-import',
		app: 'chr',
		audience: 'manage',
		group: 'Nhân viên',
		title: 'Nhập nhân viên từ Excel',
		description: 'Tải file mẫu, điền nhiều người rồi nhập một lần.',
		to: '/management/employees',
		access: { roles: ['ADMIN', 'HR'], permission: 'employee:import' },
	},
	{
		tourId: 'employee-view',
		app: 'chr',
		audience: 'manage',
		group: 'Nhân viên',
		title: 'Xem thông tin nhân viên',
		description: 'Tìm một người, mở hồ sơ và xem từng phần của hồ sơ.',
		to: '/management/employees',
		access: { management: true, permission: 'employee:read' },
	},
	{
		tourId: 'employee-account',
		app: 'chr',
		audience: 'manage',
		group: 'Nhân viên',
		title: 'Reset mật khẩu, khóa tài khoản',
		description: 'Gửi link đặt lại mật khẩu, hoặc chặn một người đăng nhập.',
		to: '/management/employees',
		access: { roles: ['ADMIN', 'HR'], permission: ['employee:update', 'employee:delete'] },
	},
	{
		tourId: 'contract-create',
		app: 'chr',
		audience: 'manage',
		group: 'Hợp đồng',
		title: 'Thêm hợp đồng',
		description: 'Thêm hợp đồng lao động trong hồ sơ một nhân viên, rồi kích hoạt khi có hiệu lực.',
		// Bắt đầu ở danh sách hợp đồng với bước bấm Xem chi tiết; đang ở một hồ sơ thì chạy thẳng ở đó.
		to: '/management/contracts',
		// Menu Hợp đồng mở cho cả DIRECTOR, nhưng máy chủ chỉ cho HR và ADMIN có `contract:create` tạo.
		access: { management: true, module: 'CONTRACT_INSURANCE', roles: ['ADMIN', 'HR'], permission: 'contract:create' },
	},

	// ─── Hành chính văn phòng ─────────────────────────────────────────────────────
	{
		tourId: 'office-supply-catalog',
		app: 'adm',
		audience: 'manage',
		title: 'Tạo danh mục văn phòng phẩm',
		description: 'Nhập danh mục một lần từ Excel, rồi tìm, lọc và sửa giá mặt hàng ngay trên danh sách.',
		to: '/management/office/settings?tab=supplies',
		access: { management: true, permission: OFFICE_PERMISSIONS.manage, module: 'OFFICE' },
	},
	{
		tourId: 'office-supply-quota',
		app: 'adm',
		audience: 'manage',
		title: 'Đặt định mức theo phòng',
		description: 'Giới hạn số mỗi tháng một phòng được xin cho từng mặt hàng.',
		to: '/management/office/settings?tab=quotas',
		access: { management: true, permission: OFFICE_PERMISSIONS.manage, module: 'OFFICE' },
	},
	{
		tourId: 'office-supply-period-open',
		app: 'adm',
		audience: 'manage',
		title: 'Mở kỳ văn phòng phẩm',
		description: 'Mở kỳ đăng ký tháng sau cho các phòng: văn phòng, tháng, hạn chót điền sẵn theo kỳ trước.',
		to: '/management/office/supply-periods',
		access: { management: true, permission: OFFICE_PERMISSIONS.supplyManage, module: 'OFFICE' },
	},
	{
		tourId: 'office-supply-register',
		app: 'adm',
		audience: 'staff',
		title: 'Đăng ký văn phòng phẩm',
		description: 'Gõ số mình cần ngay trên danh mục của tháng, số tự lưu; lấy số tháng trước, ghi chú, thêm mặt hàng ngoài danh mục.',
		to: '/office/supplies',
		access: { module: 'OFFICE' },
	},
	{
		tourId: 'office-supply-contact',
		app: 'adm',
		audience: 'staff',
		title: 'Chọn người nhận hàng',
		description: 'Trưởng phòng chỉ định một người trong phòng nhận văn phòng phẩm thay mình.',
		to: '/office/supplies',
		// Chỉ trưởng phòng chỉ định được đầu mối; nhân viên thường không bao giờ làm việc này.
		access: { management: true, module: 'OFFICE' },
	},
	{
		tourId: 'office-room-booking',
		app: 'adm',
		audience: 'staff',
		title: 'Đặt phòng họp',
		description: 'Xem lịch phòng, giữ một khung giờ trống và mời người dự.',
		to: '/office/rooms',
		access: { module: 'OFFICE' },
	},

	// ─── Công việc và KPI ─────────────────────────────────────────────────────────
	// Mọi mục menu của phân hệ là `personal` với module `TASKS`; ai cũng giao việc, tạo dự án. Ba trang
	// chỉ hiện cho một số người thì chép `showWhen` của mục menu, Kỳ đánh giá và Cài đặt KPI chép
	// `permission`. Các tour này cũng tự bật một lần cho người mới (`usePageTour`).
	{
		tourId: 'tasks-report',
		app: 'tsk',
		audience: 'manage',
		title: 'Xem báo cáo công việc',
		description: 'Chọn khoảng ngày và phạm vi, bấm từng con số để xem việc, rồi xuất Excel.',
		to: '/cong-viec/bao-cao',
		access: { module: 'TASKS', showWhen: 'taskReports' },
	},
	{
		tourId: 'kpi-review',
		app: 'tsk',
		audience: 'manage',
		title: 'Chấm KPI nhân viên',
		description: 'Chấm từng chỉ tiêu trong phiếu của người bạn quản lý, ghi nhận xét rồi gửi.',
		to: '/kpi/danh-gia',
		access: { module: 'TASKS', showWhen: 'kpiReviewer' },
	},
	{
		tourId: 'kpi-periods',
		app: 'tsk',
		audience: 'manage',
		title: 'Mở kỳ đánh giá KPI',
		description: 'Mở kỳ tháng hay quý, theo dõi phiếu ở từng bước, công bố và xem kết quả.',
		to: '/management/kpi/ky',
		access: { module: 'TASKS', permission: 'kpi:manage' },
	},
	{
		tourId: 'kpi-settings',
		app: 'tsk',
		audience: 'manage',
		title: 'Cài đặt chỉ tiêu KPI',
		description: 'Thêm chỉ tiêu, gom thành mẫu đánh giá cho phòng hay vị trí, đặt thang xếp loại.',
		to: '/management/kpi/cai-dat',
		access: { module: 'TASKS', permission: 'kpi:manage' },
	},
	{
		tourId: 'tasks-my',
		app: 'tsk',
		audience: 'staff',
		title: 'Làm việc được giao',
		description: 'Xem việc theo hạn, báo xong ngay trên dòng, nghiệm thu việc người khác báo xong và giao việc mới.',
		to: '/cong-viec',
		access: { module: 'TASKS' },
	},
	{
		tourId: 'tasks-board',
		app: 'tsk',
		audience: 'staff',
		title: 'Kéo việc trên Bảng việc',
		description: 'Đổi trạng thái việc bằng cách kéo thẻ sang cột khác.',
		// Đang ở thẻ Việc của một dự án thì chạy luôn trên bảng của dự án đó.
		to: '/cong-viec?mode=board',
		access: { module: 'TASKS' },
	},
	{
		tourId: 'tasks-timeline',
		app: 'tsk',
		audience: 'staff',
		title: 'Đổi hạn trên biểu đồ Tiến độ',
		description: 'Kéo thanh việc để đổi hạn và nối hai việc phải chờ nhau.',
		// Tiến độ chỉ có trong dự án: bắt đầu ở danh sách Dự án với bước mở dự án đầu tiên.
		to: '/cong-viec/du-an',
		access: { module: 'TASKS' },
	},
	{
		tourId: 'tasks-sprints',
		app: 'tsk',
		audience: 'staff',
		title: 'Xếp việc vào đợt',
		description: 'Kéo việc chờ xếp vào đợt và đóng đợt khi hết hạn.',
		to: '/cong-viec/du-an',
		access: { module: 'TASKS' },
	},
	{
		tourId: 'tasks-recurrences',
		app: 'tsk',
		audience: 'staff',
		title: 'Đặt việc định kỳ',
		description: 'Đặt một lần cho việc lặp lại, hệ thống tự giao mỗi kỳ; dừng khi cần.',
		to: '/cong-viec/dinh-ky',
		access: { module: 'TASKS' },
	},
	{
		tourId: 'kpi-my',
		app: 'tsk',
		audience: 'staff',
		title: 'Xem KPI của tôi',
		description: 'Xem điểm từng kỳ, mở các việc làm nên con số và phản hồi đánh giá của cấp trên.',
		to: '/kpi',
		access: { module: 'TASKS' },
	},

	// ─── Truyền thông nội bộ ──────────────────────────────────────────────────────
	{
		tourId: 'announcement-create',
		app: 'eng',
		audience: 'manage',
		title: 'Tạo thông báo',
		description: 'Soạn thông báo, đính kèm file, chọn người nhận rồi gửi.',
		// Bắt đầu ở danh sách với bước bấm Tạo thông báo; đang ở trang tạo thì chạy thẳng phần form.
		to: '/management/announcements',
		// Menu cho cả trưởng phòng xem danh sách, nhưng máy chủ chỉ cho HR và ADMIN gửi.
		access: { management: true, permission: 'announcement:read-admin', module: 'ANNOUNCEMENT', roles: ['ADMIN', 'HR'] },
	},
	{
		tourId: 'announcement-recall',
		app: 'eng',
		audience: 'manage',
		title: 'Thu hồi thông báo',
		description: 'Gỡ một thông báo đã gửi để nhân viên không còn thấy nữa.',
		to: '/management/announcements',
		// Như Tạo thông báo: máy chủ chỉ cho HR và ADMIN thu hồi.
		access: { management: true, permission: 'announcement:read-admin', module: 'ANNOUNCEMENT', roles: ['ADMIN', 'HR'] },
	},
	{
		tourId: 'announcement-search',
		app: 'eng',
		audience: 'manage',
		title: 'Tìm kiếm thông báo',
		description: 'Tìm thông báo đã gửi theo chữ trong tiêu đề, nội dung và theo ngày tạo.',
		to: '/management/announcements',
		access: {
			management: true,
			permission: 'announcement:read-admin',
			module: 'ANNOUNCEMENT',
			roles: ['ADMIN', 'HR', 'CHIEF', 'DIRECTOR', 'MANAGER'],
		},
	},

	// ─── Tài sản ──────────────────────────────────────────────────────────────────
	{
		tourId: 'asset-list',
		app: 'ast',
		audience: 'manage',
		title: 'Quản lý tài sản',
		description: 'Xem nhanh, tìm tài sản và thêm tài sản mới.',
		to: '/management/assets',
		access: { management: true, permission: 'asset:read', module: 'ASSET' },
	},
	{
		tourId: 'asset-my',
		app: 'ast',
		audience: 'staff',
		title: 'Tài sản của tôi',
		description: 'Xem tài sản bạn đang giữ, báo hỏng hay báo mất.',
		to: '/assets/my',
		access: { module: 'ASSET' },
	},
];
