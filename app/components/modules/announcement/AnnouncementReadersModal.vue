<script setup lang="ts">
	import { computed, ref } from 'vue';
	import { format, parseISO } from 'date-fns';
	import type { AnnouncementRecipientStatus } from '~/types/announcement.types';

	const props = defineProps<{
		modelValue: boolean;
		recipients: AnnouncementRecipientStatus[];
		readCount: number;
		totalCount: number;
	}>();

	const emit = defineEmits<{
		'update:modelValue': [value: boolean];
	}>();

	const activeFilter = ref<'read' | 'unread'>('read');

	const unreadCount = computed(() => props.totalCount - props.readCount);

	const progressPercent = computed(() => {
		if (props.totalCount === 0) return 0;
		return Math.round((props.readCount / props.totalCount) * 100);
	});

	const filteredList = computed(() => {
		const list = props.recipients || [];
		return activeFilter.value === 'read'
			? list.filter(r => r.isRead)
			: list.filter(r => !r.isRead);
	});

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(-2)
			.map(w => w.charAt(0).toUpperCase())
			.join('');
	}

	function formatReadAt(iso: string | null): string {
		if (!iso) return '';
		try {
			return format(parseISO(iso), 'dd/MM HH:mm');
		} catch {
			return iso;
		}
	}

	function handleClose() {
		emit('update:modelValue', false);
	}
</script>

<template>
	<Teleport to="body">
		<div
			v-if="modelValue"
			class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
			@click.self="handleClose"
		>
			<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
				<!-- Header -->
				<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
					<div>
						<h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
							<span>Danh sách người nhận</span>
						</h2>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
							Đã đọc <strong class="text-emerald-600 dark:text-emerald-400">{{ readCount }}/{{ totalCount }}</strong> người
							<span class="mx-1">·</span>
							{{ progressPercent }}%
						</p>
					</div>
					<button
						type="button"
						class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						@click="handleClose"
					>
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<!-- Filter bar -->
				<div class="flex items-center gap-2 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
					<button
						type="button"
						:class="[
							'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
							activeFilter === 'read'
								? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
								: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700',
						]"
						@click="activeFilter = 'read'"
					>
						Đã đọc ({{ readCount }})
					</button>
					<button
						type="button"
						:class="[
							'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
							activeFilter === 'unread'
								? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
								: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700',
						]"
						@click="activeFilter = 'unread'"
					>
						Chưa đọc ({{ unreadCount }})
					</button>
				</div>

				<!-- Employee List -->
				<div class="flex-1 overflow-y-auto p-6">
					<div v-if="filteredList.length === 0" class="py-12 text-center text-sm text-gray-400">
						<template v-if="activeFilter === 'read'">Chưa có ai đọc thông báo này</template>
						<template v-else>Tất cả nhân viên đã đọc thông báo</template>
					</div>

					<div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
						<div
							v-for="r in filteredList"
							:key="r.employeeId"
							class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all"
						>
							<div
								:class="[
									'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden text-xs font-bold',
									r?.isRead
										? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
										: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
								]"
							>
								<img v-if="r?.avatarUrl" :src="r?.avatarUrl" :alt="r?.fullName" class="w-full h-full object-cover" />
								<span v-else>{{ initials(r.fullName) }}</span>
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
									{{ r?.fullName }}
								</p>
								<p v-if="r?.isRead && r?.readAt" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
									<span>✓ Đã đọc lúc {{ formatReadAt(r?.readAt) }}</span>
								</p>
								<p v-else class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
									Chưa đọc
								</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Footer -->
				<div class="flex items-center justify-end px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 flex-shrink-0">
					<button
						type="button"
						class="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium transition-colors"
						@click="handleClose"
					>
						Đóng
					</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>
