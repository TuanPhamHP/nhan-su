<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import { useLogService } from '~/services/log.service';

	definePageMeta({
		title: 'Tools',
		middleware: [
			function () {
				const auth = useAuthStore();
				if (auth.user?.role !== 'ADMIN') return navigateTo('/');
			},
		],
	});

	const router = useRouter();
	const logService = useLogService();

	interface ToolCard {
		label: string;
		description: string;
		route: string;
		tag: string;
		icon: string;
		/** Action name trong system-log — chỉ ghi khi tool thực sự áp dụng, dry-run không ghi. */
		logAction?: string;
	}

	const tools: ToolCard[] = [
		// {
		// 	label: 'Tính lại phép năm & công lương',
		// 	description:
		// 		'Tính lại phần có lương / không lương của đơn phép đã duyệt, rồi cộng lại số dư đã dùng. Dùng sau khi quy tắc nghỉ nửa ngày đổi sang trừ 0.5 ngày quỹ.',
		// 	route: '/management/tools/leave-recalculate',
		// 	tag: 'Nghỉ phép',
		// 	icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
		// 	logAction: 'leave_request.recalculate_split',
		// },
	];

	const lastRuns = ref<Record<string, string | null>>({});

	async function loadLastRuns() {
		const entries = await Promise.all(
			tools
				.filter(t => t.logAction)
				.map(async t => {
					const res = await logService.findAll({ action: t.logAction, limit: 1 }).catch(() => null);
					return [t.route, res?.data[0]?.createdAt ?? null] as const;
				}),
		);
		lastRuns.value = Object.fromEntries(entries);
	}

	function openTool(route: string) {
		router.push(route);
	}

	onMounted(loadLastRuns);
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Tools</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
				Công cụ sửa dữ liệu dành cho quản trị viên. Mọi tool đều có chế độ xem trước trước khi ghi.
			</p>
		</div>

		<!-- Cảnh báo chung -->
		<div class="flex gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
			<svg
				class="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
				/>
			</svg>
			<p class="text-sm text-amber-800 dark:text-amber-200">
				Các tool ở đây ghi thẳng vào cơ sở dữ liệu. Luôn xem trước và đọc kỹ bảng thay đổi trước khi áp dụng.
			</p>
		</div>

		<!-- Tool cards -->
		<div class="grid gap-4 sm:grid-cols-2">
			<div
				v-for="tool in tools"
				:key="tool.route"
				class="flex flex-col gap-3 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl"
			>
				<div class="flex items-start gap-3">
					<div
						class="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex-shrink-0"
					>
						<svg
							class="w-5 h-5 text-brand-600 dark:text-brand-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.8"
						>
							<path stroke-linecap="round" stroke-linejoin="round" :d="tool.icon" />
						</svg>
					</div>
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ tool.label }}</h2>
							<span
								class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
							>
								{{ tool.tag }}
							</span>
						</div>
						<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ tool.description }}</p>
					</div>
				</div>

				<div class="flex items-center justify-between gap-3 mt-auto pt-2">
					<span class="text-xs text-gray-500 dark:text-gray-400">
						Lần chạy gần nhất:
						<strong>{{ lastRuns[tool.route] ? formatDateTime(lastRuns[tool.route]) : 'chưa từng' }}</strong>
					</span>
					<CommonAppButton size="sm" @click="openTool(tool.route)">Mở công cụ</CommonAppButton>
				</div>
			</div>
		</div>
	</div>
</template>
