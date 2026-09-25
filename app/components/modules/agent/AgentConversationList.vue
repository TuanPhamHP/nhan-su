<script setup lang="ts">
	import { formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import type { AgentConversation } from '~/types/agent.types';

	defineProps<{
		conversations: AgentConversation[];
		activeId?: number;
		disabled?: boolean;
	}>();

	const emit = defineEmits<{
		select: [id: number];
		create: [];
		archive: [id: number];
	}>();

	function ago(iso: string | null): string {
		if (!iso) return '';
		try {
			return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: vi });
		} catch {
			return '';
		}
	}
</script>

<template>
	<aside
		class="flex h-full w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-900/40"
	>
		<div class="p-3">
			<button
				type="button"
				:disabled="disabled"
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
				@click="emit('create')"
			>
				<Icon name="heroicons:pencil-square" class="h-4 w-4" />
				Hội thoại mới
			</button>
		</div>

		<p
			v-if="conversations.length"
			class="px-4 pb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500"
		>
			Gần đây
		</p>

		<div class="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
			<div v-if="!conversations.length" class="flex flex-col items-center gap-2 px-3 py-12 text-center">
				<Icon
					name="heroicons:chat-bubble-oval-left-ellipsis"
					class="h-8 w-8 text-gray-300 dark:text-gray-600"
				/>
				<p class="text-xs text-gray-400 dark:text-gray-500">Chưa có hội thoại nào.</p>
			</div>

			<div
				v-for="c in conversations"
				:key="c.id"
				:class="[
					'group relative flex cursor-pointer items-start gap-2 rounded-xl py-2 pr-1 pl-3 transition',
					c.id === activeId
						? 'bg-white shadow-sm ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10'
						: 'hover:bg-white/70 dark:hover:bg-gray-800/50',
				]"
				@click="emit('select', c.id)"
			>
				<span
					v-if="c.id === activeId"
					class="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-accent)]"
				/>

				<div class="min-w-0 flex-1">
					<p
						:class="[
							'truncate text-sm',
							c.id === activeId
								? 'font-semibold text-gray-900 dark:text-gray-50'
								: 'font-medium text-gray-600 dark:text-gray-300',
						]"
					>
						{{ c.title || 'Hội thoại không tên' }}
					</p>
					<p class="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
						<Icon name="heroicons:chat-bubble-left-right" class="h-3 w-3" />
						{{ c.messageCount }}
						<span class="text-gray-300 dark:text-gray-600">·</span>
						<span class="truncate">{{ ago(c.lastMessageAt ?? c.createdAt) }}</span>
					</p>
				</div>

				<button
					type="button"
					title="Lưu trữ hội thoại"
					class="mt-0.5 shrink-0 rounded-lg p-1.5 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100 dark:hover:bg-red-500/10 dark:hover:text-red-400"
					@click.stop="emit('archive', c.id)"
				>
					<Icon name="heroicons:archive-box" class="h-4 w-4" />
				</button>
			</div>
		</div>
	</aside>
</template>
