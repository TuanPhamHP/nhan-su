<script setup lang="ts">
const props = defineProps<{
	checkInPhotoUrl: string | null;
	checkOutPhotoUrl: string | null;
	employeeName: string;
	date: string;
}>();

const emit = defineEmits<{
	close: [];
}>();

const zoomUrl = ref<string | null>(null);

function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		if (zoomUrl.value) {
			zoomUrl.value = null;
		} else {
			emit('close');
		}
	}
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
		@click.self="emit('close')"
	>
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700">
			<!-- Header -->
			<div class="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<div class="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
					<svg class="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
					</svg>
				</div>
				<div class="flex-1 min-w-0">
					<h3 class="text-base font-semibold text-gray-900 dark:text-white truncate">{{ props.employeeName }}</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400">{{ props.date }}</p>
				</div>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Photos -->
			<div class="grid grid-cols-2 gap-4 p-6">
				<!-- Check-in photo -->
				<div class="flex flex-col gap-2">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ảnh check-in</p>
					<div
						class="aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
					>
						<button
							v-if="props.checkInPhotoUrl"
							class="w-full h-full"
							@click="zoomUrl = props.checkInPhotoUrl"
						>
							<img :src="props.checkInPhotoUrl" alt="Ảnh check-in" class="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
						</button>
						<div v-else class="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600">
							<svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
							</svg>
							<span class="text-xs">Chưa có ảnh</span>
						</div>
					</div>
				</div>

				<!-- Check-out photo -->
				<div class="flex flex-col gap-2">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ảnh check-out</p>
					<div
						class="aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
					>
						<button
							v-if="props.checkOutPhotoUrl"
							class="w-full h-full"
							@click="zoomUrl = props.checkOutPhotoUrl"
						>
							<img :src="props.checkOutPhotoUrl" alt="Ảnh check-out" class="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
						</button>
						<div v-else class="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600">
							<svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
							</svg>
							<span class="text-xs">Chưa có ảnh</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Zoom overlay -->
		<Teleport to="body">
			<Transition
				enter-active-class="transition ease-out duration-150"
				enter-from-class="opacity-0 scale-95"
				enter-to-class="opacity-100 scale-100"
				leave-active-class="transition ease-in duration-100"
				leave-from-class="opacity-100 scale-100"
				leave-to-class="opacity-0 scale-95"
			>
				<div
					v-if="zoomUrl"
					class="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 cursor-zoom-out"
					@click="zoomUrl = null"
				>
					<img :src="zoomUrl" alt="Phóng to" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
					<button
						class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
						@click.stop="zoomUrl = null"
					>
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>
