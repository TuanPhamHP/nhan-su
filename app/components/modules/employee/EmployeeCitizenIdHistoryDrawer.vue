<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import type { SystemLog } from '~/types/log.types';

	const props = defineProps<{ employeeId: number }>();
	const emit = defineEmits<{ close: [] }>();

	const toast = useToast();
	const { history, historyMeta, historyLoading, fetchCitizenIdHistory } = useEmployeeIdentity();

	const page = ref(1);
	const limit = 20;

	async function load(p = 1) {
		try {
			await fetchCitizenIdHistory(props.employeeId, { page: p, limit });
			page.value = p;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được lịch sử CCCD');
		}
	}

	onMounted(() => load(1));

	const actionLabels: Record<string, string> = {
		'employee.citizen_id.create': 'Tạo CCCD',
		'employee.citizen_id.update': 'Cập nhật thông tin',
		'employee.citizen_id.upload_photos': 'Cập nhật ảnh',
		'employee.citizen_id.delete': 'Xoá CCCD',
	};

	const fieldLabels: Record<string, string> = {
		citizenIdNumber: 'Số CCCD',
		fullNameOnCard: 'Họ tên trên CCCD',
		issuedDate: 'Ngày cấp',
		issuedPlace: 'Nơi cấp',
		hometown: 'Quê quán',
		permanentAddress: 'Địa chỉ thường trú',
		temporaryAddress: 'Địa chỉ tạm trú',
		currentAddress: 'Địa chỉ hiện tại',
		frontPhotoUrl: 'Ảnh mặt trước',
		backPhotoUrl: 'Ảnh mặt sau',
	};

	function actionLabel(action: string) {
		return actionLabels[action] ?? action;
	}

	function changedFields(log: SystemLog): { field: string; from: unknown; to: unknown }[] {
		const payload = log.payload as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
		if (!payload) return [];
		const before = payload.before ?? {};
		const after = payload.after ?? {};
		const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
		keys.delete('employeeId');
		return Array.from(keys).map(k => ({ field: k, from: before[k], to: after[k] }));
	}

	function renderValue(v: unknown, field: string): string {
		if (v === null || v === undefined || v === '') return '—';
		if (field === 'frontPhotoUrl' || field === 'backPhotoUrl') return '(đã cập nhật ảnh)';
		return String(v);
	}
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="emit('close')"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
				>
					<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">Lịch sử thay đổi CCCD</h3>
						<button
							type="button"
							class="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
							@click="emit('close')"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="flex-1 overflow-y-auto p-6 space-y-3">
						<div v-if="historyLoading" class="space-y-3">
							<div v-for="i in 3" :key="i" class="h-16 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
						</div>

						<div v-else-if="!history.length" class="text-center py-10 text-sm text-gray-400 italic">
							Chưa có lịch sử thay đổi
						</div>

						<div
							v-for="log in history"
							v-else
							:key="log.id"
							class="border border-gray-100 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
						>
							<div class="flex flex-wrap items-baseline justify-between gap-2">
								<span class="text-sm font-medium text-gray-900 dark:text-white">
									{{ actionLabel(log.action) }}
								</span>
								<span class="text-xs text-gray-500">{{ formatDateTime(log.createdAt) }}</span>
							</div>
							<p class="text-xs text-gray-500 mt-0.5">
								{{ log.actor?.name || 'Hệ thống' }}
								<span v-if="log.actor?.role" class="ml-1">({{ log.actor.role }})</span>
							</p>

							<div v-if="changedFields(log).length" class="mt-3 space-y-1.5">
								<div
									v-for="c in changedFields(log)"
									:key="c.field"
									class="text-xs text-gray-700 dark:text-gray-300"
								>
									<span class="font-medium">{{ fieldLabels[c.field] ?? c.field }}:</span>
									<span class="text-gray-400 line-through mx-1">{{ renderValue(c.from, c.field) }}</span>
									<span class="text-gray-400">→</span>
									<span class="ml-1 text-brand-600 dark:text-brand-400">{{ renderValue(c.to, c.field) }}</span>
								</div>
							</div>
						</div>
					</div>

					<div
						v-if="historyMeta && historyMeta.totalPages > 1"
						class="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500"
					>
						<span>Trang {{ historyMeta.page }} / {{ historyMeta.totalPages }}</span>
						<div class="flex gap-2">
							<button
								type="button"
								class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
								:disabled="page <= 1"
								@click="load(page - 1)"
							>
								Trước
							</button>
							<button
								type="button"
								class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
								:disabled="page >= historyMeta.totalPages"
								@click="load(page + 1)"
							>
								Sau
							</button>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
