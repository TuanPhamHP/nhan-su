<script setup lang="ts">
	import DOMPurify from 'dompurify';
	import { format } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import AttachmentImageGallery from '~/components/modules/announcement/AttachmentImageGallery.vue';
	import { ANNOUNCEMENT_TYPE_CONFIG, type AnnouncementLink, type AnnouncementType } from '~/types/announcement.types';

	const props = defineProps<{
		modelValue: boolean;
		title: string;
		body: string;
		announcementType: AnnouncementType;
		links: AnnouncementLink[];
		attachments: File[];
	}>();

	const emit = defineEmits<{
		'update:modelValue': [value: boolean];
	}>();

	const { user } = useAuth();
	const imageViewer = useImageViewerStore();

	const attachmentsRef = computed(() => props.attachments);
	const { getUrl, isImage } = useFileImagePreviews(attachmentsRef);

	const sanitizedBody = computed(() =>
		DOMPurify.sanitize(props.body || '<p class="text-gray-400 italic">(Nội dung chưa có)</p>'),
	);

	const config = computed(() => ANNOUNCEMENT_TYPE_CONFIG[props.announcementType]);

	const nowDisplay = computed(() => format(new Date(), "HH:mm 'ngày' dd/MM/yyyy", { locale: vi }));

	const imageAttachments = computed(() => props.attachments.filter(isImage));
	const fileAttachments = computed(() => props.attachments.filter(f => !isImage(f)));

	const galleryImages = computed(() =>
		imageAttachments.value.map(f => ({ url: getUrl(f), name: f.name })),
	);

	function openImage(idx: number) {
		imageViewer.open(
			galleryImages.value.map(g => g.url),
			idx,
		);
	}

	function fileIcon(f: File): string {
		if (f.type === 'application/pdf') return '📕';
		if (f.type.includes('spreadsheet') || f.name.endsWith('.xlsx')) return '📊';
		if (f.type.includes('word') || f.name.endsWith('.docx')) return '📝';
		return '📎';
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
		>
			<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
				<!-- Header -->
				<div
					class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
				>
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Xem trước thông báo</h2>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bản nháp — chưa gửi</p>
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

				<!-- Preview body -->
				<div class="flex-1 overflow-y-auto">
					<!-- Simulated email header -->
					<div class="px-8 py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
						<p class="text-xs font-medium tracking-wide opacity-90">📢 THÔNG BÁO TỪ CÔNG TY</p>
					</div>

					<div class="px-8 py-6 space-y-5">
						<!-- Type badge + title -->
						<div class="space-y-2">
							<div
								class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold"
							>
								<span>{{ config.icon }}</span>
								<span>{{ config.label }}</span>
							</div>
							<h1 class="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
								{{ title || '(Chưa có tiêu đề)' }}
							</h1>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Gửi bởi: {{ user?.fullName ?? 'HR' }}
								<span class="mx-1.5">·</span>
								{{ nowDisplay }}
							</p>
						</div>

						<!-- Body -->
						<div class="announcement-body text-gray-800 dark:text-gray-200" v-html="sanitizedBody" />

						<!-- Image gallery (Facebook-style) -->
						<AttachmentImageGallery
							v-if="imageAttachments.length > 0"
							:images="galleryImages"
							@image-click="openImage"
						/>

						<!-- Links -->
						<div v-if="links.length > 0" class="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
							<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Liên kết đính kèm
							</p>
							<div class="space-y-1.5">
								<a
									v-for="(l, i) in links"
									:key="i"
									:href="l.url"
									target="_blank"
									rel="noopener noreferrer"
									class="block items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400 hover:underline"
								>
									🔗 {{ l.label || l.url }}
								</a>
							</div>
						</div>

						<!-- Non-image attachments -->
						<div
							v-if="fileAttachments.length > 0"
							class="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800"
						>
							<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								File đính kèm ({{ fileAttachments.length }})
							</p>
							<div class="space-y-1.5">
								<div
									v-for="(f, idx) in fileAttachments"
									:key="`${f.name}-${idx}`"
									class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
								>
									<span>{{ fileIcon(f) }}</span>
									<span class="truncate">{{ f.name }}</span>
								</div>
							</div>
						</div>

						<!-- Action button -->
						<div v-if="config.actionUrl" class="pt-3">
							<span class="inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium">
								{{ config.actionLabel }} →
							</span>
						</div>
					</div>
				</div>

				<!-- Footer -->
				<div
					class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between gap-3"
				>
					<p class="text-xs text-gray-500 dark:text-gray-400 italic">
						Đây là bản xem trước. Nội dung thực tế có thể khác sau khi gửi.
					</p>
					<CommonAppButton variant="outline" type="button" @click="handleClose">Đóng</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
