<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import {
		REASON_KIND_LABELS,
		type RecruitmentReason,
		type RecruitmentReasonKind,
		type RecruitmentSource,
		type RecruitmentTag,
	} from '~/types/recruitment.types';

	/**
	 * Ba danh mục nhỏ dùng khắp module: nguồn ứng viên, lý do, tag.
	 *
	 * Mục có `systemCode` là mục hệ thống — đổi tên hay ngừng dùng đều bị từ chối, nên ô tên
	 * và công tắc của những mục đó bị khoá sẵn. Module KHÔNG có route xoá; ngừng dùng một mục
	 * là tắt công tắc, và mục đã tắt vẫn còn trên các bản ghi cũ.
	 */
	const props = defineProps<{ canManage: boolean }>();

	const toast = useToast();
	const service = useRecruitmentService();

	const sources = ref<RecruitmentSource[]>([]);
	const reasons = ref<RecruitmentReason[]>([]);
	const tags = ref<RecruitmentTag[]>([]);
	const loading = ref(true);
	const error = ref<string | null>(null);
	const saving = ref(false);

	const newSource = ref('');
	const newReasonName = ref('');
	const newReasonKind = ref<RecruitmentReasonKind>('REJECTION');
	const newTag = ref('');

	async function load() {
		loading.value = true;
		error.value = null;
		try {
			// Không lọc `activeOnly` để màn cài đặt thấy cả mục đã ngừng dùng.
			const [sourceList, reasonList, tagList] = await Promise.all([
				service.findSources(),
				service.findReasons(),
				service.findTags(),
			]);
			sources.value = sourceList;
			reasons.value = reasonList;
			tags.value = tagList;
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được danh mục');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	const reasonKindOptions = Object.entries(REASON_KIND_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	async function run(action: () => Promise<unknown>, okMessage: string) {
		if (saving.value) return;
		saving.value = true;
		try {
			await action();
			toast.success(okMessage);
			await load();
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Lưu danh mục thất bại'));
			await load();
		} finally {
			saving.value = false;
		}
	}

	function addSource() {
		if (!newSource.value.trim()) return;
		run(() => service.createSource({ name: newSource.value.trim() }), 'Đã thêm nguồn').then(() => {
			newSource.value = '';
		});
	}

	function addReason() {
		if (!newReasonName.value.trim()) return;
		run(
			() => service.createReason({ kind: newReasonKind.value, name: newReasonName.value.trim() }),
			'Đã thêm lý do',
		).then(() => {
			newReasonName.value = '';
		});
	}

	function addTag() {
		if (!newTag.value.trim()) return;
		run(() => service.createTag({ name: newTag.value.trim() }), 'Đã thêm tag').then(() => {
			newTag.value = '';
		});
	}

	const toggleSource = (row: RecruitmentSource) =>
		run(
			() => service.updateSource(row.id, { isActive: !row.isActive }),
			row.isActive ? 'Đã ngừng dùng nguồn' : 'Đã dùng lại nguồn',
		);

	const toggleReason = (row: RecruitmentReason) =>
		run(
			() => service.updateReason(row.id, { isActive: !row.isActive }),
			row.isActive ? 'Đã ngừng dùng lý do' : 'Đã dùng lại lý do',
		);

	const toggleTag = (row: RecruitmentTag) =>
		run(
			() => service.updateTag(row.id, { isActive: !row.isActive }),
			row.isActive ? 'Đã ngừng dùng tag' : 'Đã dùng lại tag',
		);

	const renameSource = (row: RecruitmentSource, name: string) =>
		run(() => service.updateSource(row.id, { name }), 'Đã đổi tên nguồn');

	const renameReason = (row: RecruitmentReason, name: string) =>
		run(() => service.updateReason(row.id, { name }), 'Đã đổi tên lý do');

	const renameTag = (row: RecruitmentTag, name: string) =>
		run(() => service.updateTag(row.id, { name }), 'Đã đổi tên tag');

	/** Chỉ gọi API khi tên thật sự đổi, để mỗi lần rời ô không sinh một request thừa. */
	function onRename(current: string, event: Event, save: (name: string) => void) {
		const next = (event.target as HTMLInputElement).value.trim();
		if (!next || next === current) {
			(event.target as HTMLInputElement).value = current;
			return;
		}
		save(next);
	}

	const reasonsByKind = computed(() => ({
		REJECTION: reasons.value.filter(r => r.kind === 'REJECTION'),
		OFFER_DECLINE: reasons.value.filter(r => r.kind === 'OFFER_DECLINE'),
	}));
</script>

<template>
	<div class="space-y-6">
		<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
			{{ error }}
		</p>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<template v-else>
			<p class="text-sm text-gray-600 dark:text-gray-300">
				Module không có chức năng xoá mục danh mục, vì mục cũ còn nằm trên hồ sơ đã xử lý. Muốn bỏ một
				mục thì tắt công tắc, mục đó sẽ biến khỏi các ô chọn nhưng dữ liệu cũ vẫn đọc được.
			</p>

			<!-- Nguồn -->
			<section class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Nguồn ứng viên</h3>
				<ul class="mt-3 space-y-2">
					<li
						v-for="row in sources"
						:key="row.id"
						class="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
					>
						<input
							:value="row.name"
							type="text"
							:disabled="!canManage || !!row.systemCode"
							class="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-gray-900 disabled:opacity-60 focus:border-gray-300 focus:outline-none dark:text-gray-100 dark:focus:border-gray-600"
							@blur="onRename(row.name, $event, name => renameSource(row, name))"
						/>
						<span v-if="row.systemCode" class="text-xs text-gray-400">mục hệ thống</span>
						<label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
							<input
								type="checkbox"
								:checked="row.isActive"
								:disabled="!canManage || !!row.systemCode"
								class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
								@change="toggleSource(row)"
							/>
							Đang dùng
						</label>
					</li>
				</ul>
				<div v-if="canManage" class="mt-3 flex flex-wrap items-center gap-2">
					<input
						v-model="newSource"
						type="text"
						maxlength="100"
						placeholder="Tên nguồn mới"
						class="min-w-[14rem] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<CommonAppButton variant="outline" size="sm" :disabled="!newSource.trim()" @click="addSource">
						Thêm
					</CommonAppButton>
				</div>
			</section>

			<!-- Lý do -->
			<section class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Lý do</h3>

				<div v-for="(list, kind) in reasonsByKind" :key="kind" class="mt-3">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
						{{ REASON_KIND_LABELS[kind as RecruitmentReasonKind] }}
					</p>
					<ul class="mt-2 space-y-2">
						<li
							v-for="row in list"
							:key="row.id"
							class="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
						>
							<input
								:value="row.name"
								type="text"
								:disabled="!canManage || !!row.systemCode"
								class="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-gray-900 disabled:opacity-60 focus:border-gray-300 focus:outline-none dark:text-gray-100 dark:focus:border-gray-600"
								@blur="onRename(row.name, $event, name => renameReason(row, name))"
							/>
							<span v-if="row.systemCode" class="text-xs text-gray-400">mục hệ thống</span>
							<label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
								<input
									type="checkbox"
									:checked="row.isActive"
									:disabled="!canManage || !!row.systemCode"
									class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									@change="toggleReason(row)"
								/>
								Đang dùng
							</label>
						</li>
						<li v-if="!list.length" class="px-3 py-2 text-xs text-gray-400">Chưa có mục nào.</li>
					</ul>
				</div>

				<div v-if="canManage" class="mt-3 flex flex-wrap items-center gap-2">
					<div class="w-52">
						<UiSelect v-model="newReasonKind" :options="reasonKindOptions" />
					</div>
					<input
						v-model="newReasonName"
						type="text"
						maxlength="150"
						placeholder="Tên lý do mới"
						class="min-w-[14rem] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<CommonAppButton
						variant="outline"
						size="sm"
						:disabled="!newReasonName.trim()"
						@click="addReason"
					>
						Thêm
					</CommonAppButton>
				</div>
			</section>

			<!-- Tag -->
			<section class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Tag ứng viên</h3>
				<ul class="mt-3 space-y-2">
					<li
						v-for="row in tags"
						:key="row.id"
						class="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
					>
						<input
							:value="row.name"
							type="text"
							:disabled="!canManage"
							class="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-gray-900 disabled:opacity-60 focus:border-gray-300 focus:outline-none dark:text-gray-100 dark:focus:border-gray-600"
							@blur="onRename(row.name, $event, name => renameTag(row, name))"
						/>
						<label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
							<input
								type="checkbox"
								:checked="row.isActive"
								:disabled="!canManage"
								class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
								@change="toggleTag(row)"
							/>
							Đang dùng
						</label>
					</li>
					<li v-if="!tags.length" class="px-3 py-2 text-xs text-gray-400">Chưa có tag nào.</li>
				</ul>
				<div v-if="canManage" class="mt-3 flex flex-wrap items-center gap-2">
					<input
						v-model="newTag"
						type="text"
						maxlength="50"
						placeholder="Tên tag mới"
						class="min-w-[14rem] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<CommonAppButton variant="outline" size="sm" :disabled="!newTag.trim()" @click="addTag">
						Thêm
					</CommonAppButton>
				</div>
			</section>
		</template>
	</div>
</template>
