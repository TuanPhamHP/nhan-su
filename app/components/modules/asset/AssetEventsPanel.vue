<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import { formatDateTime } from '~/utils/date';
	import { describeAssetEvent } from '~/utils/asset.utils';
	import type { AssetEvent, AssetEventType } from '~/types/asset.types';

	const props = defineProps<{ assetId: number }>();

	const service = useAssetService();

	const events = ref<AssetEvent[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);

	/** Chấm màu theo nhóm sự kiện để lướt dọc dòng thời gian cho nhanh. */
	const DOT_CLASS: Partial<Record<AssetEventType, string>> = {
		CREATED: 'bg-brand-500',
		ASSIGNED: 'bg-blue-500',
		RETURNED: 'bg-gray-400',
		ASSIGNMENT_CONFIRMED: 'bg-emerald-500',
		ASSIGNMENT_DISPUTED: 'bg-rose-500',
		ASSIGNMENT_DISPUTE_RESOLVED: 'bg-blue-500',
		REPAIR_OPENED: 'bg-amber-500',
		REPAIR_CLOSED: 'bg-emerald-500',
		STATUS_CHANGED: 'bg-amber-500',
		RENEWED: 'bg-emerald-500',
		LICENSE_KEY_CHANGED: 'bg-violet-500',
	};

	/**
	 * Tải lỗi thì hiện khung lỗi có nút Thử lại tại chỗ. Trước đây lỗi chỉ hiện toast vài giây
	 * rồi để lại câu "Chưa có sự kiện nào", khiến người xem tin là tài sản chưa có lịch sử.
	 */
	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			events.value = await service.findEvents(props.assetId);
		} catch (e) {
			events.value = [];
			loadError.value =
				e instanceof Error ? e.message : 'Chưa tải được lịch sử của tài sản này. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	/** Dịch payload kỹ thuật sang câu tiếng Việt; xem `describeAssetEvent`. */
	const detailsOf = (ev: AssetEvent) => describeAssetEvent(ev.type, ev.payload);
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
		<h3 class="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">Lịch sử</h3>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<div v-else-if="loadError" class="flex flex-col items-center gap-3 py-10 text-center">
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<p v-else-if="!events.length" class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
			Chưa có sự kiện nào.
		</p>

		<ol v-else class="space-y-0">
			<li v-for="(ev, i) in events" :key="ev.id" class="relative flex gap-4 pb-5">
				<!-- Đường nối dọc, bỏ ở mục cuối -->
				<span
					v-if="i < events.length - 1"
					class="absolute left-[5px] top-4 h-full w-px bg-gray-200 dark:bg-gray-700"
					aria-hidden="true"
				/>
				<span
					class="relative mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
					:class="DOT_CLASS[ev.type] ?? 'bg-gray-300 dark:bg-gray-600'"
				/>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium text-gray-900 dark:text-white">{{ ev.typeLabel }}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{{ formatDateTime(ev.occurredAt) }}
						<span v-if="ev.actor"> · {{ ev.actor.name }}</span>
						<span v-else> · Hệ thống</span>
					</p>
					<p
						v-for="line in detailsOf(ev)"
						:key="line"
						class="mt-0.5 break-words text-sm text-gray-600 dark:text-gray-300"
					>
						{{ line }}
					</p>
				</div>
			</li>
		</ol>
	</section>
</template>
