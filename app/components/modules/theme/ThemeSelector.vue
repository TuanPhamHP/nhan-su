<script setup lang="ts">
	import { THEMES } from '~/config/themes';

	const uiStore = useUiStore();
	const { themeId, previewThemeId, activeThemeId } = storeToRefs(uiStore);
	const toast = useToast();

	const hasChanges = computed(() => previewThemeId.value !== null && previewThemeId.value !== themeId.value);

	function handleSelect(id: string) {
		if (id === themeId.value && previewThemeId.value === null) return;
		uiStore.setPreviewTheme(id);
	}

	function handleSave() {
		if (!previewThemeId.value) return;
		uiStore.saveTheme(previewThemeId.value);
		toast.success('Đã áp dụng theme');
	}

	function handleCancel() {
		uiStore.clearPreviewTheme();
	}

	onBeforeUnmount(() => {
		uiStore.clearPreviewTheme();
	});
</script>

<template>
	<div>
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
			<button
				v-for="theme in THEMES"
				:key="theme.id"
				type="button"
				:class="[
					'group relative flex flex-col rounded-xl border-2 overflow-hidden transition-all',
					activeThemeId === theme.id
						? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-800'
						: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
				]"
				@click="handleSelect(theme.id)"
			>
				<!-- Preview swatch: mini header + sidebar layout -->
				<div class="flex h-20 w-full">
					<div
						class="w-1/3 flex flex-col gap-1 p-1.5"
						:style="{ backgroundColor: theme.colors.sidebarBg }"
					>
						<div class="h-1 rounded-full" :style="{ backgroundColor: theme.colors.accent, opacity: 0.9 }" />
						<div class="h-1 rounded-full opacity-40" :style="{ backgroundColor: theme.colors.sidebarText }" />
						<div class="h-1 rounded-full opacity-40" :style="{ backgroundColor: theme.colors.sidebarText }" />
					</div>
					<div class="flex-1 flex flex-col">
						<div
							class="h-4 border-b flex items-center px-1.5"
							:style="{
								backgroundColor: theme.colors.headerBg,
								borderColor: theme.colors.border,
							}"
						>
							<div
								class="h-1 w-1/2 rounded-full opacity-60"
								:style="{ backgroundColor: theme.colors.headerText }"
							/>
						</div>
						<div class="flex-1 bg-gray-50 dark:bg-gray-800" />
					</div>
				</div>

				<!-- Name -->
				<div class="px-3 py-2 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 text-left">
					<p class="text-sm font-medium text-gray-900 dark:text-white">{{ theme.nameEn }}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">{{ theme.nameVi }}</p>
				</div>

				<!-- Active check -->
				<div
					v-if="activeThemeId === theme.id"
					class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center shadow"
				>
					<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
			</button>
		</div>

		<!-- Actions -->
		<div class="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
			<p v-if="hasChanges" class="text-xs text-amber-600 dark:text-amber-400 mr-auto">
				* Bạn có thay đổi chưa lưu
			</p>
			<CommonAppButton type="button" variant="outline" :disabled="!hasChanges" @click="handleCancel">
				Huỷ
			</CommonAppButton>
			<CommonAppButton type="button" variant="primary" :disabled="!hasChanges" @click="handleSave">
				Lưu
			</CommonAppButton>
		</div>
	</div>
</template>
