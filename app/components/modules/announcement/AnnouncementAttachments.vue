<script setup lang="ts">
	import AttachmentImageGallery from '~/components/modules/announcement/AttachmentImageGallery.vue';
	import type { AnnouncementAttachment, AnnouncementLink } from '~/types/announcement.types';

	const props = defineProps<{
		attachments: AnnouncementAttachment[];
		links: AnnouncementLink[];
	}>();

	// Nhận diện ảnh theo đuôi file — BE không trả mime.
	const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|bmp|svg)(\?.*)?$/i;

	function isImage(a: AnnouncementAttachment): boolean {
		return IMAGE_EXT.test(a.url) || IMAGE_EXT.test(a.name);
	}

	const images = computed(() => props.attachments.filter(isImage));
	const files = computed(() => props.attachments.filter(a => !isImage(a)));
	const imageUrls = computed(() => images.value.map(i => i.url));

	const imageViewer = useImageViewerStore();

	function openImage(idx: number) {
		imageViewer.open(imageUrls.value, idx);
	}

	function fileIcon(name: string): string {
		const lower = name.toLowerCase();
		if (lower.endsWith('.pdf')) return '📕';
		if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return '📊';
		if (lower.endsWith('.docx') || lower.endsWith('.doc')) return '📝';
		return '📎';
	}

	function formatDomain(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	const hasLinks = computed(() => (props.links?.length ?? 0) > 0);
	const hasFiles = computed(() => files.value.length > 0);
	const hasAnything = computed(
		() => images.value.length > 0 || hasLinks.value || hasFiles.value,
	);
</script>

<template>
	<div v-if="hasAnything" class="space-y-4 mt-4">
		<AttachmentImageGallery :images="images" @image-click="openImage" />

		<!-- Links: giữ layout card 2 cột -->
		<div v-if="hasLinks" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<a
				v-for="(l, i) in links"
				:key="`link-${i}`"
				:href="l.url"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-all text-sm group"
			>
				<div
					class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-lg flex-shrink-0 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
						/>
					</svg>
				</div>
				<div class="flex-1 min-w-0">
					<p class="font-semibold text-gray-800 dark:text-gray-200 truncate">
						{{ l.label || l.url }}
					</p>
					<p class="text-xs text-gray-400 dark:text-gray-500 truncate">
						{{ formatDomain(l.url) }}
					</p>
				</div>
			</a>
		</div>

		<!-- Non-image files: có label kèm số lượng -->
		<div v-if="hasFiles" class="space-y-2">
			<div class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
				<svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
					/>
				</svg>
				<span>File đính kèm ({{ files.length }})</span>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<a
					v-for="(f, i) in files"
					:key="`file-${i}`"
					:href="f.url"
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-all text-sm group"
				>
					<div
						class="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300 text-lg flex-shrink-0 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60 transition-colors"
					>
						<span>{{ fileIcon(f.name) }}</span>
					</div>
					<div class="flex-1 min-w-0">
						<p class="font-semibold text-gray-800 dark:text-gray-200 truncate">{{ f.name }}</p>
					</div>
				</a>
			</div>
		</div>
	</div>
</template>
