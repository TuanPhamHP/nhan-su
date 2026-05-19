<script setup lang="ts">
definePageMeta({ title: 'Cài đặt' });

const settingsItems = [
	{
		label: 'Địa điểm chấm công',
		description: 'Quản lý địa điểm GPS cho phép nhân viên check-in. Cấu hình bán kính và gán nhân viên.',
		route: '/settings/locations',
		icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
		tag: 'Chấm công',
	},
	{
		label: 'Ca làm việc',
		description: 'Tạo khuôn ca, cấu hình giờ vào/ra và ngưỡng trễ. Phân ca theo tuần cho từng nhân viên.',
		route: '/settings/shifts',
		icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
		tag: 'Chấm công',
	},
	{
		label: 'Ngày lễ & Nghỉ bù',
		description: 'Quản lý ngày lễ quốc gia và ngày nghỉ bù. Tạo nhanh ngày lễ cố định hoặc thêm thủ công.',
		route: '/settings/holidays',
		icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
		tag: 'Nghỉ lễ',
	},
];
</script>

<template>
	<div class="space-y-6">
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Cài đặt</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Quản lý cấu hình hệ thống</p>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			<NuxtLink
				v-for="item in settingsItems"
				:key="item.route"
				:to="item.route"
				class="group flex flex-col gap-3 p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-sm transition-all"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
						<svg class="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
						</svg>
					</div>
					<span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
						{{ item.tag }}
					</span>
				</div>

				<div>
					<p class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
						{{ item.label }}
					</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
						{{ item.description }}
					</p>
				</div>

				<div class="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium mt-auto">
					Mở cài đặt
					<svg class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
					</svg>
				</div>
			</NuxtLink>
		</div>
	</div>
</template>
