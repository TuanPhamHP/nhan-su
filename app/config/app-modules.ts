import { ALL_APPROVE_PERMISSIONS } from '~/utils/permission';
import type { AppGroup, AppModuleDef } from '~/types/navigation.types';

/**
 * Bản đồ APP của khu quản trị — nguồn sự thật duy nhất cho lưới chọn app và sidebar.
 *
 * Vì sao tách khỏi `ModuleCode`: `ModuleCode` là đơn vị BÁN HÀNG (công ty mua gói nào),
 * còn app ở đây là đơn vị ĐIỀU HƯỚNG. Phần lớn màn hình nằm trong `CORE` nên lấy
 * `ModuleCode` làm nhóm menu sẽ ra một nhóm khổng lồ. Từng mục vẫn khai `module` để ẩn
 * khi công ty chưa mở gói — hai thứ bù nhau chứ không thay nhau.
 *
 * KHÔNG nằm trong app nào, có chủ đích:
 * - `/management` (Tổng quan) và `/` — trang chủ, sidebar luôn ghim ở trên cùng.
 * - `/assistant` (Trợ lý AI) — là khung chat, sống ở nút nổi `AppAgentFab` nên không
 *   chiếm một ô app; tách ra thành app riêng sẽ khiến người dùng phải rời màn hình đang
 *   làm việc chỉ để hỏi một câu.
 *
 * File này được sinh lần đầu từ `navSections` cũ trong AppSidebar.vue; sửa tiếp bằng tay.
 */
export const APP_MODULES: AppModuleDef[] = [
	{
		/** CHR — Hồ sơ nhân sự & Hợp đồng. */
		code: 'chr',
		label: 'Hồ sơ & Hợp đồng',
		description: 'Vòng đời nhân viên: hồ sơ, phòng ban, chức vụ, hợp đồng lao động.',
		group: 'Quản trị nhân sự',
		tone: 'bg-sky-500',
		icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
		home: '/management/employees',
		routes: ['/management/employees', '/management/departments', '/management/positions', '/management/contracts'],
		items: [
			{
					label: 'Nhân viên',
					route: '/management/employees',
					icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
					management: true,
					permission: 'employee:read',
			},
			{
					label: 'Phòng ban',
					route: '/management/departments',
					icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
					management: true,
					permission: 'department:read',
			},
			{
					label: 'Chức vụ',
					route: '/management/positions',
					icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z',
					roles: ['ADMIN', 'HR'],
			},
			{
					label: 'Hợp đồng',
					route: '/management/contracts',
					icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
					roles: ['ADMIN', 'HR', 'DIRECTOR'],
					management: true,
					module: 'CONTRACT_INSURANCE',
			},
		],
	},
	{
		/**
		 * Chấm công và đơn từ đi chung MỘT phân hệ, không tách.
		 *
		 * Mọi loại đơn ở đây (nghỉ phép, làm thêm, làm online, công tác, bù công, vi phạm
		 * chuyên cần) đều tồn tại để điều chỉnh bảng công — duyệt một đơn nghỉ là sửa một
		 * ô trong bảng công. Tách thành hai ô riêng là chia theo hình thức màn hình chứ
		 * không theo nghiệp vụ, và bắt người làm công tác nhảy qua lại hai phân hệ cho một
		 * việc duy nhất.
		 */
		/** TAL — Chấm công & Đơn từ. */
		code: 'tal',
		label: 'Chấm công & Đơn từ',
		description: 'Ca làm việc, dữ liệu chấm công, đơn nghỉ/OT/công tác, quỹ phép, bảng công.',
		group: 'Quản trị nhân sự',
		tone: 'bg-emerald-500',
		icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
		home: '/management/attendance',
		routes: ['/management/attendance', '/management/approval', '/management/leave', '/management/overtime',
			'/management/online-work', '/management/violations', '/management/makeup-attendance',
			'/management/business-trips', '/attendance/my', '/attendance/check-in', '/users/leave-requests', '/overtime', '/online-work', '/violations', '/makeup-attendance', '/business-trips'],
		items: [
			{
					label: 'Chấm công',
					route: '/management/attendance',
					icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
					management: true,
					permission: 'attendance:read',
			},
			{
					label: 'Duyệt đơn',
					route: '/management/approval',
					icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
					management: true,
					permission: ALL_APPROVE_PERMISSIONS,
					badgeKey: 'approval',
			},
			{
					label: 'Nghỉ phép',
					route: '/management/leave',
					icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
					management: true,
					permission: 'leave:read',
			},
			{
					label: 'Làm thêm giờ',
					route: '/management/overtime',
					icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
					management: true,
					permission: 'overtime:read',
					module: 'OVERTIME',
			},
			{
					label: 'Làm online',
					route: '/management/online-work',
					icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
					management: true,
					permission: 'online-work:read',
					module: 'ONLINE_WORK',
			},
			{
					label: 'Vi phạm chuyên cần',
					route: '/management/violations',
					icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
					management: true,
					permission: 'violation:read',
			},
			{
					label: 'Bù công',
					route: '/management/makeup-attendance',
					icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
					management: true,
					permission: 'makeup:read',
			},
			{
					label: 'Công tác',
					route: '/management/business-trips',
					icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
					management: true,
					permission: 'business-trip:read',
					module: 'BUSINESS_TRIP',
					dataTour: 'nav-business-trips',
			},
			{
					label: 'Chấm công của tôi',
					route: '/attendance/my',
					icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
				scope: 'personal',
			},
			{
					label: 'Check-in / Check-out',
					route: '/attendance/check-in',
					icon: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1',
				scope: 'personal',
			},
			{
					label: 'Đơn xin nghỉ phép',
					route: '/users/leave-requests',
					icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
				scope: 'personal',
			},
			{
					label: 'Đơn OT của tôi',
					route: '/overtime/my',
					icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
					module: 'OVERTIME',
				scope: 'personal',
			},
			{
					label: 'Đơn Online của tôi',
					route: '/online-work/my',
					icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
					module: 'ONLINE_WORK',
				scope: 'personal',
			},
			{
					label: 'Vi phạm chuyên cần',
					route: '/violations/my',
					icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
				scope: 'personal',
			},
			{
					label: 'Đơn bù công của tôi',
					route: '/makeup-attendance/my',
					icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
				scope: 'personal',
			},
			{
					label: 'Đơn công tác của tôi',
					route: '/business-trips',
					icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
					dataTour: 'nav-my-business-trips',
					module: 'BUSINESS_TRIP',
				scope: 'personal',
			},
		],
	},
	{
		/**
		 * REC — Tuyển dụng. Module bán riêng (`RECRUIT`): công ty chưa mua thì mọi mục ẩn,
		 * kể cả với ADMIN.
		 *
		 * "Phỏng vấn của tôi" là mục `personal` nên nhân viên ngồi hội đồng cũng thấy ô phân
		 * hệ này — họ dùng nhóm route `/recruitment/**`, không vào được `/management/**`.
		 */
		code: 'rec',
		label: 'Tuyển dụng',
		description: 'Định biên, yêu cầu tuyển, tin tuyển dụng, kho ứng viên, phỏng vấn, offer.',
		group: 'Thu hút & Phát triển',
		tone: 'bg-amber-500',
		icon: 'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z',
		home: '/management/recruitment',
		routes: ['/management/recruitment', '/recruitment'],
		items: [
			{
					label: 'Tổng quan tuyển dụng',
					route: '/management/recruitment',
					icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605',
					management: true,
					permission: 'recruitment:read',
					module: 'RECRUIT',
			},
			{
					label: 'Định biên',
					route: '/management/recruitment/headcount',
					icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
					management: true,
					permission: 'recruitment:read',
					module: 'RECRUIT',
			},
			{
					label: 'Yêu cầu tuyển',
					route: '/management/recruitment/requisitions',
					icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
					management: true,
					permission: 'recruitment:read',
					module: 'RECRUIT',
			},
			{
					label: 'Chờ tôi duyệt',
					route: '/management/recruitment/approvals',
					icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
					management: true,
					permission: 'recruitment:read',
					module: 'RECRUIT',
			},
			{
					label: 'Tin tuyển dụng',
					route: '/management/recruitment/jobs',
					icon: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
					management: true,
					permission: 'recruitment:read',
					module: 'RECRUIT',
			},
			{
					label: 'Lịch phỏng vấn',
					route: '/management/recruitment/interviews',
					icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
					management: true,
					permission: 'recruitment:read',
					module: 'RECRUIT',
			},
			{
					label: 'Kho ứng viên',
					route: '/management/recruitment/candidates',
					icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
					management: true,
					permission: 'recruitment:read',
					module: 'RECRUIT',
			},
			{
					label: 'Thư mời nhận việc',
					route: '/management/recruitment/offers',
					icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
					management: true,
					permission: 'recruitment:read',
					module: 'RECRUIT',
			},
			{
					label: 'Báo cáo tuyển dụng',
					route: '/management/recruitment/reports',
					icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
					management: true,
					// Cố ý là `recruitment:read`, KHÔNG phải `recruitment:report:read`: phễu (RP-01)
					// và định biên (RP-03) chỉ cần quyền đọc theo phạm vi, nên trưởng phòng vẫn
					// vào được trang. Ba báo cáo toàn công ty được ẩn ở từng tab trong trang.
					permission: 'recruitment:read',
					module: 'RECRUIT',
			},
			{
					label: 'Cài đặt tuyển dụng',
					route: '/management/recruitment/settings',
					icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
					management: true,
					permission: 'recruitment:manage',
					module: 'RECRUIT',
			},
			{
					label: 'Phỏng vấn của tôi',
					route: '/recruitment/my-interviews',
					icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
					module: 'RECRUIT',
				scope: 'personal',
			},
		],
	},
	{
		/** AST — Quản lý tài sản. */
		code: 'ast',
		label: 'Quản lý tài sản',
		description: 'Tài sản hữu hình và vô hình, cấp phát, bảo trì, kiểm kê, thanh lý.',
		group: 'Hành chính & Vận hành',
		tone: 'bg-violet-500',
		icon: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
		home: '/management/assets',
		routes: ['/management/assets', '/assets'],
		items: [
			{
					label: 'Tài sản',
					route: '/management/assets',
					icon: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
					management: true,
					permission: 'asset:read',
					module: 'ASSET',
			},
			{
					label: 'Dịch vụ thuê bao',
					route: '/management/assets/services',
					icon: 'M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z',
					management: true,
					permission: 'asset:read',
					module: 'ASSET',
			},
			{
					label: 'Sửa chữa',
					route: '/management/assets/maintenances',
					icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
					management: true,
					permission: 'asset:read',
					module: 'ASSET',
			},
			{
					label: 'Nhà cung cấp',
					route: '/management/assets/vendors',
					icon: 'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z',
					management: true,
					permission: 'asset:read',
					module: 'ASSET',
			},
			{
					label: 'Báo cáo tài sản',
					route: '/management/assets/reports',
					icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
					management: true,
					permission: 'asset:read',
					module: 'ASSET',
			},
			{
					label: 'Cài đặt tài sản',
					route: '/management/assets/settings',
					icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
					management: true,
					permission: 'asset:manage',
					module: 'ASSET',
			},
			{
					label: 'Tài sản của tôi',
					route: '/assets/my',
					icon: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
					badgeKey: 'pendingAsset',
					module: 'ASSET',
				scope: 'personal',
			},
		],
	},
	{
		/** ENG — Truyền thông & Gắn kết nội bộ. Mới có bảng tin; khảo sát, vinh danh, góp ý chưa làm. */
		code: 'eng',
		label: 'Truyền thông nội bộ',
		description: 'Bảng tin, quy chế và thông báo gửi tới toàn công ty.',
		group: 'Quản trị & Phân tích',
		tone: 'bg-rose-500',
		icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46',
		home: '/management/announcements',
		routes: ['/management/announcements', '/announcements'],
		items: [
			{
					label: 'Thông báo công ty',
					route: '/management/announcements',
					icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46',
					management: true,
					permission: 'announcement:read-admin',
					module: 'ANNOUNCEMENT',
					dataTour: 'nav-announcements',
					roles: ['ADMIN', 'HR', 'CHIEF', 'DIRECTOR', 'MANAGER'],
			},
			{
					label: 'Thông báo công ty',
					route: '/announcements',
					icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46',
					dataTour: 'nav-announcements',
					badgeKey: 'unreadAnnouncement',
					module: 'ANNOUNCEMENT',
				scope: 'personal',
			},
		],
	},
	{
		/**
		 * PAY — Tính lương & Thuế TNCN. Thuộc nhóm Quản trị nhân sự, KHÔNG phải nhóm phân
		 * tích: bảng lương là nghiệp vụ chi trả, không phải báo cáo để đọc.
		 */
		code: 'pay',
		label: 'Tính lương & Thuế TNCN',
		description: 'Công thức lương, phụ cấp, thưởng, khấu trừ, thuế TNCN, phiếu lương, chi trả.',
		group: 'Quản trị nhân sự',
		tone: 'bg-teal-500',
		icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		home: '/management/payroll',
		routes: ['/management/payroll'],
		items: [
			{
					label: 'Bảng lương',
					route: '/management/payroll',
					icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
					roles: ['ADMIN', 'HR'],
			},
		],
	},
	{
		/** ANA — Báo cáo & Phân tích nhân sự. */
		code: 'ana',
		label: 'Báo cáo & Phân tích',
		description: 'Dashboard điều hành, báo cáo biến động, chi phí nhân sự, báo cáo nhà nước.',
		group: 'Quản trị & Phân tích',
		tone: 'bg-indigo-500',
		icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
		home: '/management/reports',
		routes: ['/management/reports'],
		items: [
			{
					label: 'Báo cáo',
					route: '/management/reports',
					icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
					management: true,
					permission: 'report:read',
					module: 'REPORTS',
			},
		],
	},
	{
		/** Không có trong bức tranh nghiệp vụ: đây là quản trị kỹ thuật của chính phần mềm. */
		code: 'sys',
		label: 'Quản trị hệ thống',
		description: 'Phân quyền, cấu hình, nhật ký và công cụ nội bộ.',
		group: 'Hệ thống',
		tone: 'bg-slate-500',
		icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
		home: '/management/settings',
		routes: ['/management/roles', '/management/settings', '/management/tools', '/management/system-logs', '/management/notifications'],
		items: [
			{
					label: 'Phân quyền',
					route: '/management/roles',
					icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
					roles: ['ADMIN'],
			},
			{
					label: 'Cài đặt',
					route: '/management/settings',
					icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
					roles: ['ADMIN', 'HR'],
			},
			{
					label: 'Tools',
					route: '/management/tools',
					icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
					roles: ['ADMIN'],
			},
			{
					label: 'Logs',
					route: '/management/system-logs',
					icon: 'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776',
					roles: ['ADMIN'],
			},
			{
					label: 'Test Notification',
					route: '/management/notifications/test',
					icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M10.5 8.25h3l-3 4.5h3',
					roles: ['ADMIN'],
			},
		],
	},
];

/**
 * Các phân hệ CÓ TRONG BỨC TRANH TỔNG THỂ nhưng CHƯA có màn hình nào.
 *
 * Cố ý KHÔNG render: lưới chọn phân hệ chỉ hiện thứ bấm vào được, bày ô "sắp có" chỉ làm
 * người dùng bấm hụt. Giữ ở đây để bản đồ trong code khớp với bản đồ nghiệp vụ — khi xây
 * xong màn hình đầu tiên của một mã thì chuyển mục tương ứng sang `APP_MODULES`.
 *
 * Lưu ý về `APV`: khác với mục "Duyệt đơn" đang nằm trong TAL. "Duyệt đơn" là duyệt đơn
 * nhân sự (nghỉ phép, OT, công tác); còn APV là phê duyệt điện tử nói chung — tờ trình,
 * đề nghị thanh toán, tạm ứng, mua sắm. Đừng gộp hai thứ này vì trùng chữ "duyệt".
 *
 * `BEN` đã có một phần: màn hình BHXH hiện là một tab trong hồ sơ nhân viên
 * (`EmployeeSocialInsurance.vue`) và một thẻ ở trang hồ sơ cá nhân, chưa có trang quản lý
 * bảo hiểm & phúc lợi cho toàn công ty.
 */
export const PLANNED_MODULES: Array<{ code: string; label: string; group: AppGroup; scope: string }> = [
	{ code: 'BEN', label: 'Bảo hiểm & Phúc lợi', group: 'Quản trị nhân sự', scope: 'BHXH/BHYT/BHTN, ốm đau – thai sản, phúc lợi sinh nhật, hiếu hỉ, lễ tết, khám sức khỏe' },
	{ code: 'ONB', label: 'Hội nhập & Thử việc', group: 'Thu hút & Phát triển', scope: 'Checklist đón nhân viên mới, cấp phát tài khoản/thiết bị, đánh giá thử việc' },
	{ code: 'PER', label: 'Đánh giá hiệu suất (KPI/OKR)', group: 'Thu hút & Phát triển', scope: 'Giao mục tiêu, kỳ đánh giá, xếp loại, gắn kết quả với thưởng/lương' },
	{ code: 'LND', label: 'Đào tạo & Phát triển', group: 'Thu hút & Phát triển', scope: 'Khung năng lực, kế hoạch đào tạo, LMS, cam kết đào tạo, lộ trình & kế nhiệm' },
	{ code: 'APV', label: 'Phê duyệt điện tử', group: 'Hành chính & Vận hành', scope: 'Tờ trình, đề xuất, đề nghị thanh toán/tạm ứng/mua sắm, quy trình duyệt nhiều cấp' },
	{ code: 'ADM', label: 'Hành chính văn phòng', group: 'Hành chính & Vận hành', scope: 'Văn phòng phẩm/vật tư, phòng họp, xe, văn thư công văn, con dấu' },
	{ code: 'TSK', label: 'Quản lý công việc & Dự án', group: 'Hành chính & Vận hành', scope: 'Giao việc, dự án, kanban/gantt, việc định kỳ, timesheet, báo cáo tiến độ' },
];
