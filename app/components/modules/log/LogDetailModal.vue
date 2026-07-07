<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import type { SystemLog } from '~/types/log.types';

	const props = defineProps<{
		log: SystemLog;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();

	const metaDataStore = useMetaDataStore();

	const actionColorMap: Record<string, string> = {
		auth: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
		employee: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
		department: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
		position: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
		role: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
	};

	const actionBadgeClass = computed(() => {
		const prefix = props.log.action.split('.')[0];
		return actionColorMap[prefix] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
	});

	const targetTypeLabel: Record<string, string> = {
		employee: 'Nhân viên',
		department: 'Phòng ban',
		position: 'Chức vụ',
		role: 'Vai trò',
	};

	const actionLabelMap: Record<string, string> = {
		'auth.login': 'Đăng nhập',
		'auth.logout': 'Đăng xuất',
		'auth.change_password': 'Đổi mật khẩu',
		'employee.create': 'Tạo nhân viên',
		'employee.update': 'Cập nhật nhân viên',
		'employee.deactivate': 'Vô hiệu hóa nhân viên',
		'department.create': 'Tạo phòng ban',
		'department.update': 'Cập nhật phòng ban',
		'department.deactivate': 'Vô hiệu hóa phòng ban',
		'position.create': 'Tạo chức vụ',
		'position.update': 'Cập nhật chức vụ',
		'position.deactivate': 'Vô hiệu hóa chức vụ',
		'role.create': 'Tạo vai trò',
		'role.update': 'Cập nhật vai trò',
		'role.delete': 'Xóa vai trò',
		'role.assign_permissions': 'Gán quyền cho vai trò',
		'role.add_employees': 'Thêm nhân viên vào vai trò',
		'role.remove_employee': 'Xóa nhân viên khỏi vai trò',
	};

	// Detect payload type and extract sections
	const payloadType = computed<'diff' | 'data' | 'raw' | 'empty'>(() => {
		const p = props.log.payload;
		if (!p || Object.keys(p).length === 0) return 'empty';
		if ('before' in p && 'after' in p) return 'diff';
		if ('data' in p) return 'data';
		return 'raw';
	});

	const payloadBefore = computed(() =>
		payloadType.value === 'diff' ? (props.log.payload!.before as Record<string, unknown>) : null,
	);
	const payloadAfter = computed(() =>
		payloadType.value === 'diff' ? (props.log.payload!.after as Record<string, unknown>) : null,
	);
	const payloadData = computed(() =>
		payloadType.value === 'data' ? (props.log.payload!.data as Record<string, unknown>) : null,
	);

	const diffKeys = computed<string[]>(() => {
		if (!payloadBefore.value && !payloadAfter.value) return [];
		const keys = new Set([
			...Object.keys(payloadBefore.value ?? {}),
			...Object.keys(payloadAfter.value ?? {}),
		]);
		return [...keys];
	});

	function formatValue(val: unknown): string {
		if (val === null || val === undefined) return '—';
		if (typeof val === 'object') return JSON.stringify(val);
		return String(val);
	}

	function hasChanged(key: string): boolean {
		return formatValue(payloadBefore.value?.[key]) !== formatValue(payloadAfter.value?.[key]);
	}

	const payloadJson = computed(() => {
		if (!props.log.payload) return '';
		return JSON.stringify(props.log.payload, null, 2);
	});
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
			>
				<div class="flex items-center gap-3">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chi tiết Log</h2>
					<span class="text-xs text-gray-400 dark:text-gray-500 font-mono">#{{ log.id }}</span>
				</div>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">
				<!-- Top row: timestamp + status -->
				<div class="flex items-center justify-between flex-wrap gap-2">
					<span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(log.createdAt) }}</span>
					<span
						:class="[
							'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
							log.status === 'SUCCESS'
								? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
								: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
						]"
					>
						<span
							:class="[
								'w-1.5 h-1.5 rounded-full',
								log.status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500',
							]"
						/>
						{{ log.status === 'SUCCESS' ? 'Thành công' : 'Thất bại' }}
					</span>
				</div>

				<!-- Action + Target -->
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1">
						<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hành động</p>
						<div class="flex items-center gap-2 flex-wrap">
							<span
								:class="['inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold font-mono', actionBadgeClass]"
							>
								{{ log.action }}
							</span>
						</div>
						<p v-if="actionLabelMap[log.action]" class="text-xs text-gray-500 dark:text-gray-400">
							{{ actionLabelMap[log.action] }}
						</p>
					</div>
					<div v-if="log.targetType" class="space-y-1">
						<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Đối tượng</p>
						<p class="text-sm text-gray-700 dark:text-gray-300">
							{{ targetTypeLabel[log.targetType] ?? log.targetType }}
							<span v-if="log.targetId" class="text-gray-400 dark:text-gray-500 font-mono ml-1">#{{ log.targetId }}</span>
						</p>
					</div>
				</div>

				<!-- Actor -->
				<div class="space-y-2">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tác nhân</p>
					<div class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
						<div
							:class="[
								'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold',
								log.actor.type === 'USER'
									? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
									: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
							]"
						>
							{{ log.actor.type === 'USER' ? (log.actor.name?.charAt(0)?.toUpperCase() ?? '?') : 'SYS' }}
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<p class="text-sm font-medium text-gray-900 dark:text-white">
									{{ log.actor.name ?? 'Hệ thống' }}
								</p>
								<span
									:class="[
										'text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase',
										log.actor.type === 'USER'
											? 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
											: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
									]"
								>
									{{ log.actor.type }}
								</span>
								<span
									v-if="log.actor.role"
									class="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
								>
									{{ metaDataStore.labelForRole(log.actor.role) }}
								</span>
							</div>
							<p v-if="log.actor.email" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
								{{ log.actor.email }}
							</p>
							<p v-if="log.actor.id" class="text-xs text-gray-400 dark:text-gray-500 font-mono">
								ID: {{ log.actor.id }}
							</p>
						</div>
					</div>
				</div>

				<!-- Error message -->
				<div
					v-if="log.status === 'FAILURE' && log.errorMessage"
					class="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 space-y-1"
				>
					<p class="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Lỗi</p>
					<p class="text-sm text-red-700 dark:text-red-300 font-mono break-all">{{ log.errorMessage }}</p>
				</div>

				<!-- Payload -->
				<div v-if="payloadType !== 'empty'" class="space-y-2">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Dữ liệu thay đổi</p>

					<!-- Before / After diff -->
					<template v-if="payloadType === 'diff'">
						<div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
							<table class="w-full text-sm">
								<thead>
									<tr class="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
										<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-1/4">Trường</th>
										<th class="px-3 py-2 text-left text-xs font-semibold text-red-500 dark:text-red-400 w-[37.5%]">Trước</th>
										<th class="px-3 py-2 text-left text-xs font-semibold text-green-600 dark:text-green-400 w-[37.5%]">Sau</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
									<tr
										v-for="key in diffKeys"
										:key="key"
										:class="hasChanged(key) ? 'bg-amber-50/50 dark:bg-amber-900/5' : ''"
									>
										<td class="px-3 py-2 font-mono text-xs font-medium text-gray-600 dark:text-gray-400">
											{{ key }}
										</td>
										<td
											:class="[
												'px-3 py-2 font-mono text-xs break-all',
												hasChanged(key) ? 'text-red-600 dark:text-red-400 line-through opacity-70' : 'text-gray-500 dark:text-gray-400',
											]"
										>
											{{ formatValue(payloadBefore?.[key]) }}
										</td>
										<td
											:class="[
												'px-3 py-2 font-mono text-xs break-all',
												hasChanged(key) ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-gray-500 dark:text-gray-400',
											]"
										>
											{{ formatValue(payloadAfter?.[key]) }}
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</template>

					<!-- Data object -->
					<template v-else-if="payloadType === 'data' && payloadData">
						<div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
							<table class="w-full text-sm">
								<thead>
									<tr class="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
										<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-1/3">Trường</th>
										<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Giá trị</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
									<tr v-for="(val, key) in payloadData" :key="String(key)">
										<td class="px-3 py-2 font-mono text-xs font-medium text-gray-600 dark:text-gray-400">{{ key }}</td>
										<td class="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 break-all">
											{{ formatValue(val) }}
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</template>

					<!-- Raw JSON fallback -->
					<template v-else>
						<pre
							class="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all border border-gray-200 dark:border-gray-700"
						>{{ payloadJson }}</pre>
					</template>
				</div>

				<div v-else class="text-xs text-gray-400 dark:text-gray-500 italic">Không có dữ liệu payload.</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<CommonAppButton variant="outline" class="w-full justify-center" @click="emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
