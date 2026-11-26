<script setup lang="ts">
	import type { FeatureGuide } from '~/types/guide.types';

	/**
	 * Nút Hướng dẫn dính mép phải màn hình: bấm mở danh sách hướng dẫn theo tính năng của phân hệ
	 * đang mở, chọn một cái thì chạy tour tương ứng (chuyển trang nếu cần).
	 *
	 * Danh sách đổi theo phân hệ và đã lọc theo quyền (`useFeatureGuides`), nên phân hệ không có
	 * hướng dẫn nào cho người này thì nút không hiện. Nút cũng ẩn khi tour đang chạy để không đè
	 * lên hộp hướng dẫn.
	 */
	const { currentApp } = useAppModules();
	const { guides, manageGuides, staffGuides, openGuide } = useFeatureGuides();
	const { state } = useTour();
	const overlayOpen = useOverlayOpen();

	const open = ref(false);
	const panel = ref<HTMLElement | null>(null);
	const trigger = ref<HTMLElement | null>(null);

	interface GuideGroup {
		key: string;
		label: string;
		items: FeatureGuide[];
	}

	/** Hướng dẫn không có `group` đứng trước, rồi tới từng nhóm theo thứ tự xuất hiện trong danh mục. */
	function splitGroups(items: FeatureGuide[]): { loose: FeatureGuide[]; groups: GuideGroup[] } {
		const loose: FeatureGuide[] = [];
		const groups: GuideGroup[] = [];
		for (const guide of items) {
			if (!guide.group) {
				loose.push(guide);
				continue;
			}
			let group = groups.find(g => g.label === guide.group);
			if (!group) {
				group = { key: guide.group, label: guide.group, items: [] };
				groups.push(group);
			}
			group.items.push(guide);
		}
		return { loose, groups };
	}

	const sections = computed(() =>
		[
			{ key: 'manage', label: 'Quản lý', ...splitGroups(manageGuides.value), count: manageGuides.value.length },
			{ key: 'staff', label: 'Nhân viên', ...splitGroups(staffGuides.value), count: staffGuides.value.length },
		].filter(s => s.count > 0),
	);

	/**
	 * Nhóm đang mở. Phân hệ chỉ có một nhóm thì nhóm đó mở sẵn, khỏi bắt bấm thêm một lần; nhiều
	 * nhóm thì đóng hết để người dùng thấy đủ các nhóm trước rồi mới chọn.
	 */
	const expanded = ref(new Set<string>());
	const groupCount = computed(() => sections.value.reduce((n, s) => n + s.groups.length, 0));

	function groupKey(sectionKey: string, group: GuideGroup) {
		return `${sectionKey}:${group.key}`;
	}

	function isExpanded(sectionKey: string, group: GuideGroup) {
		return groupCount.value === 1 || expanded.value.has(groupKey(sectionKey, group));
	}

	function toggleGroup(sectionKey: string, group: GuideGroup) {
		const key = groupKey(sectionKey, group);
		const next = new Set(expanded.value);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expanded.value = next;
	}

	function choose(guide: FeatureGuide) {
		open.value = false;
		openGuide(guide);
	}

	function onDocumentClick(event: MouseEvent) {
		const target = event.target as Node;
		if (panel.value?.contains(target) || trigger.value?.contains(target)) return;
		open.value = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') open.value = false;
	}

	watch(open, value => {
		if (value) {
			document.addEventListener('mousedown', onDocumentClick);
			document.addEventListener('keydown', onKeydown);
		} else {
			document.removeEventListener('mousedown', onDocumentClick);
			document.removeEventListener('keydown', onKeydown);
		}
	});

	// Sang phân hệ khác thì danh sách cũ không còn đúng nữa.
	watch(
		() => currentApp.value?.code,
		() => {
			open.value = false;
			expanded.value = new Set();
		},
	);

	onBeforeUnmount(() => {
		document.removeEventListener('mousedown', onDocumentClick);
		document.removeEventListener('keydown', onKeydown);
	});
</script>

<template>
	<!--
		Điện thoại: nút tròn nhỏ ở góc dưới, ngay trên nút trợ lý (lề dưới của trang chừa đủ chỗ cho hai nút),
		vì tab dọc giữa mép phải che nút ba chấm của từng việc. Màn rộng: tab dọc dính mép phải như cũ.
		Ẩn khi đang có khung chi tiết hay hộp thoại mở, để không đè lên nút của khung đó.
	-->
	<div
		v-if="guides.length && !state && !overlayOpen"
		class="fixed bottom-40 right-4 z-30 sm:bottom-auto sm:right-0 sm:top-1/2 sm:-translate-y-1/2"
		data-testid="guide-fab"
	>
		<button
			ref="trigger"
			type="button"
			class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 sm:h-auto sm:w-auto sm:flex-col sm:gap-1 sm:rounded-none sm:rounded-l-xl sm:px-1.5 sm:py-3"
			:aria-expanded="open"
			aria-haspopup="dialog"
			aria-label="Hướng dẫn theo tính năng"
			title="Hướng dẫn theo tính năng"
			@click="open = !open"
		>
			<Icon name="heroicons:academic-cap" class="h-5 w-5" />
			<span class="hidden text-[11px] font-medium leading-none [writing-mode:vertical-rl] sm:inline">Hướng dẫn</span>
		</button>

		<Transition
			enter-active-class="transition duration-150 ease-out"
			enter-from-class="translate-x-2 opacity-0"
			leave-active-class="transition duration-100 ease-in"
			leave-to-class="translate-x-2 opacity-0"
		>
			<div
				v-if="open"
				ref="panel"
				role="dialog"
				aria-label="Danh sách hướng dẫn"
				data-overlay-ignore
				class="absolute bottom-full right-0 mb-2 max-h-[60vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl sm:bottom-auto sm:right-full sm:top-1/2 sm:mb-0 sm:mr-2 sm:max-h-[70vh] sm:max-w-[calc(100vw-4rem)] sm:-translate-y-1/2 dark:border-gray-700 dark:bg-gray-900"
			>
				<div class="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
					<p class="text-sm font-semibold text-gray-900 dark:text-white">Hướng dẫn</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{{ currentApp?.label }} · chọn một việc để xem từng bước
					</p>
				</div>
				<div v-for="section in sections" :key="section.key" class="py-1">
					<p
						v-if="sections.length > 1"
						class="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
					>
						{{ section.label }}
					</p>
					<button
						v-for="guide in section.loose"
						:key="guide.tourId"
						type="button"
						class="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-brand-50 focus:bg-brand-50 focus:outline-none dark:hover:bg-gray-800 dark:focus:bg-gray-800"
						@click="choose(guide)"
					>
						<Icon name="heroicons:play-circle" class="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
						<span class="min-w-0">
							<span class="block text-sm font-medium text-gray-900 dark:text-white">{{ guide.title }}</span>
							<span class="block text-xs text-gray-500 dark:text-gray-400">{{ guide.description }}</span>
						</span>
					</button>

					<!-- Nhóm con (Nhân viên, Phòng ban…): bấm tiêu đề để mở hay thu gọn -->
					<div v-for="group in section.groups" :key="group.key">
						<button
							type="button"
							class="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:hover:bg-gray-800 dark:focus:bg-gray-800"
							:aria-expanded="isExpanded(section.key, group)"
							:disabled="groupCount === 1"
							@click="toggleGroup(section.key, group)"
						>
							<Icon
								name="heroicons:chevron-right"
								:class="[
									'h-4 w-4 shrink-0 text-gray-400 transition-transform',
									isExpanded(section.key, group) ? 'rotate-90' : '',
								]"
							/>
							<span class="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ group.label }}</span>
							<span class="text-xs text-gray-400">{{ group.items.length }}</span>
						</button>
						<div v-if="isExpanded(section.key, group)" class="ml-6 border-l border-gray-100 dark:border-gray-800">
							<button
								v-for="guide in group.items"
								:key="guide.tourId"
								type="button"
								class="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-brand-50 focus:bg-brand-50 focus:outline-none dark:hover:bg-gray-800 dark:focus:bg-gray-800"
								@click="choose(guide)"
							>
								<Icon name="heroicons:play-circle" class="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
								<span class="min-w-0">
									<span class="block text-sm font-medium text-gray-900 dark:text-white">{{ guide.title }}</span>
									<span class="block text-xs text-gray-500 dark:text-gray-400">{{ guide.description }}</span>
								</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>
