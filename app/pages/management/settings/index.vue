<script setup lang="ts">
	import { REQUEST_PERMISSIONS } from '~/utils/permission';

	/**
	 * Trang Cài đặt: lưới thẻ dẫn tới từng màn cấu hình.
	 *
	 * Lô 4a chuyển quản lý loại phiếu đề xuất ra trang riêng
	 * (`/management/settings/request-types`) vì mỗi loại phiếu giờ còn có luồng duyệt nhiều bước;
	 * trước đó nó là một khối bật tắt ngay trong trang này. Thẻ đó chỉ hiện với người có quyền
	 * quản lý loại phiếu, thay cho cách kiểm theo vai trò nhân sự hoặc quản trị viên.
	 */
	definePageMeta({ title: 'Cài đặt' });

	const { hasPermission } = usePermissions();

	interface SettingItem {
		label: string;
		description: string;
		route: string;
		icon: string;
		tag: string;
		/** Thẻ chỉ hiện với người có quyền này; vắng là mọi người vào được trang Cài đặt đều thấy. */
		permission?: string;
	}

	const settingsItems: SettingItem[] = [
		{
			label: 'Địa điểm chấm công',
			description: 'Quản lý địa điểm GPS cho phép nhân viên check-in. Cấu hình bán kính và gán nhân viên.',
			route: '/management/settings/locations',
			icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
			tag: 'Chấm công',
		},
		{
			label: 'Ca làm việc',
			description: 'Tạo khuôn ca, cấu hình giờ vào/ra và ngưỡng trễ. Phân ca theo tuần cho từng nhân viên.',
			route: '/management/settings/shifts',
			icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
			tag: 'Chấm công',
		},
		{
			label: 'Loại giấy tờ',
			description:
				'Danh mục loại giấy tờ nhân viên: thời hạn mặc định, giấy tờ nhạy cảm và loại nhân viên được thấy.',
			route: '/management/settings/document-types',
			icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
			tag: 'Hồ sơ',
		},
		{
			label: 'Ngày lễ & Nghỉ bù',
			description: 'Quản lý ngày lễ quốc gia và ngày nghỉ bù. Tạo nhanh ngày lễ cố định hoặc thêm thủ công.',
			route: '/management/settings/holidays',
			icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
			tag: 'Nghỉ lễ',
		},
		{
			label: 'Loại phiếu đề xuất',
			description:
				'Biểu mẫu, mẫu in, tiền tố số hiệu và luồng duyệt nhiều bước của từng loại phiếu đề xuất.',
			route: '/management/settings/request-types',
			icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
			tag: 'Phê duyệt',
			permission: REQUEST_PERMISSIONS.typeManage,
		},
	];

	const visibleItems = computed(() => settingsItems.filter(item => !item.permission || hasPermission(item.permission)));
</script>

<template>
	<div class="space-y-6">
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Cài đặt</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Quản lý cấu hình hệ thống</p>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<NuxtLink
				v-for="item in visibleItems"
				:key="item.route"
				:to="item.route"
				class="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-600"
			>
				<div class="flex items-start justify-between gap-3">
					<div
						class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 transition-colors group-hover:bg-brand-100 dark:bg-brand-900/30 dark:group-hover:bg-brand-900/50"
					>
						<svg
							class="h-5 w-5 text-brand-600 dark:text-brand-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
						</svg>
					</div>
					<span
						class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
					>
						{{ item.tag }}
					</span>
				</div>

				<div>
					<p
						class="text-sm font-semibold text-gray-900 transition-colors group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-400"
					>
						{{ item.label }}
					</p>
					<p class="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{{ item.description }}</p>
				</div>

				<div class="mt-auto flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
					Mở cài đặt
					<svg
						class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
					</svg>
				</div>
			</NuxtLink>
		</div>
	</div>
</template>
