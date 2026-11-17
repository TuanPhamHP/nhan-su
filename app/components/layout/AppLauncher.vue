<script setup lang="ts">
	import type { AppModuleDef } from '~/types/navigation.types';

	const emit = defineEmits<{ close: [] }>();

	const { appsByGroup, recentApps, currentApp } = useAppModules();
	const router = useRouter();

	const keyword = ref('');
	const searchInput = ref<HTMLInputElement | null>(null);

	const normalized = computed(() => keyword.value.trim().toLowerCase());

	/** Tìm theo cả tên app lẫn tên từng màn hình bên trong — gõ "bảng lương" phải ra app Phân tích. */
	function matches(app: AppModuleDef): boolean {
		if (!normalized.value) return true;
		const hay = [app.label, app.description, ...app.items.map(i => i.label)].join(' ').toLowerCase();
		return hay.includes(normalized.value);
	}

	const groups = computed(() =>
		appsByGroup.value
			.map(g => ({ ...g, apps: g.apps.filter(matches) }))
			.filter(g => g.apps.length > 0),
	);

	const hasResult = computed(() => groups.value.length > 0);

	function open(app: AppModuleDef): void {
		emit('close');
		router.push(app.home);
	}

	onMounted(() => {
		searchInput.value?.focus();
	});

	function onKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') emit('close');
	}
</script>

<template>
	<!--
		Lưới chọn app. Mở từ nút ở header, thay cho việc đổ cả 26 mục vào sidebar.
		Chỉ hiện app mà người dùng thật sự vào được (xem useAppModules).
	-->
	<Teleport to="body">
		<div class="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" @keydown="onKeydown">
			<div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />

			<div
				class="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900"
			>
				<!-- Thanh tìm kiếm -->
				<div class="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
					<button
						type="button"
						class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
					<div class="relative flex-1">
						<svg
							class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.2-5.2M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
						</svg>
						<input
							ref="searchInput"
							v-model="keyword"
							type="text"
							placeholder="Tìm phân hệ hoặc màn hình…"
							class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>
				</div>

				<div class="flex-1 overflow-y-auto px-4 py-4">
					<!-- Gần đây: chỉ khi không tìm kiếm, và có nhiều hơn 1 app để nhảy qua lại -->
					<template v-if="!normalized && recentApps.length > 1">
						<p class="mb-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Gần đây</p>
						<div class="mb-6 flex flex-wrap gap-2">
							<button
								v-for="app in recentApps"
								:key="app.code"
								type="button"
								class="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-[var(--color-accent)] hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
								@click="open(app)"
							>
								<span :class="['flex h-6 w-6 items-center justify-center rounded-md text-white', app.tone]">
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
										<path stroke-linecap="round" stroke-linejoin="round" :d="app.icon" />
									</svg>
								</span>
								{{ app.label }}
							</button>
						</div>
					</template>

					<div v-for="g in groups" :key="g.group" class="mb-6">
						<p class="mb-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{{ g.group }}</p>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<button
								v-for="app in g.apps"
								:key="app.code"
								type="button"
								:class="[
									'flex items-start gap-3 rounded-xl border p-3 text-left transition',
									currentApp?.code === app.code
										? 'border-[var(--color-accent)] bg-gray-50 dark:bg-gray-800'
										: 'border-gray-200 hover:border-[var(--color-accent)] hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800',
								]"
								@click="open(app)"
							>
								<span
									:class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white', app.tone]"
								>
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
										<path stroke-linecap="round" stroke-linejoin="round" :d="app.icon" />
									</svg>
								</span>
								<span class="min-w-0">
									<span class="block text-sm font-semibold text-gray-900 dark:text-gray-50">
										{{ app.label }}
									</span>
									<span class="mt-0.5 block text-xs leading-snug text-gray-500 dark:text-gray-400">
										{{ app.description }}
									</span>
								</span>
							</button>
						</div>
					</div>

					<p v-if="!hasResult" class="py-12 text-center text-sm text-gray-400">
						Không tìm thấy phân hệ nào khớp “{{ keyword }}”.
					</p>
				</div>
			</div>
		</div>
	</Teleport>
</template>
