<script setup lang="ts">
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import { useGeneralRequestService } from '~/services/general-request.service';
	import type { GeneralRequestDetail, RequestWatcher } from '~/types/general-request.types';

	/**
	 * Người theo dõi phiếu, và lời mời cho ý kiến.
	 *
	 * Hai việc dùng chung một route (`POST /:id/watchers`) nhưng khác nhau về nghiệp vụ, nên hộp
	 * thoại nói rõ: người theo dõi chỉ nhận thông báo và xem phiếu, còn người được mời cho ý kiến
	 * bình luận được nhưng KHÔNG duyệt. Người gửi thêm được người theo dõi; người gửi và người
	 * đang giữ lượt duyệt mời được ý kiến.
	 */
	const props = defineProps<{
		requestId: number;
		watchers: RequestWatcher[];
		canAddWatcher: boolean;
		canConsult: boolean;
		/** Danh bạ để chọn; trang cha truyền vào vì nhân viên không gọi được `/v1/employees`. */
		people: PickablePerson[];
	}>();

	const emit = defineEmits<{ changed: [request: GeneralRequestDetail] }>();

	const toast = useToast();
	const service = useGeneralRequestService();

	/** Hộp thoại đang mở ở chế độ nào, hoặc đóng. */
	const mode = ref<'watch' | 'consult' | null>(null);
	const selected = ref<number[]>([]);
	const submitting = ref(false);

	const alreadyIn = computed(() => new Set(props.watchers.map(w => w.employeeId)));
	const choices = computed(() => props.people.filter(p => !alreadyIn.value.has(p.id)));

	function open(next: 'watch' | 'consult') {
		selected.value = [];
		mode.value = next;
	}

	async function submit() {
		if (!selected.value.length) {
			toast.error('Bạn chọn ít nhất một người.');
			return;
		}
		submitting.value = true;
		try {
			const updated = await service.addWatchers(props.requestId, {
				employeeIds: selected.value,
				consult: mode.value === 'consult',
			});
			toast.success(mode.value === 'consult' ? 'Đã gửi lời mời cho ý kiến.' : 'Đã thêm người theo dõi.');
			mode.value = null;
			emit('changed', updated);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa thêm được người, bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
		<h2 class="text-sm font-semibold text-gray-900 dark:text-white">Người theo dõi và người cho ý kiến</h2>

		<ul v-if="watchers.length" class="mt-3 space-y-1.5">
			<li v-for="watcher in watchers" :key="watcher.employeeId" class="text-sm text-gray-700 dark:text-gray-200">
				{{ watcher.fullName }}
				<span class="text-xs text-gray-500 dark:text-gray-400">· {{ watcher.sourceLabel }}</span>
			</li>
		</ul>
		<p v-else class="mt-3 text-sm text-gray-500 dark:text-gray-400">Chưa có ai theo dõi phiếu này.</p>

		<div v-if="canAddWatcher || canConsult" class="mt-3 flex flex-wrap gap-2">
			<CommonAppButton v-if="canAddWatcher" size="sm" variant="secondary" @click="open('watch')">
				Thêm người theo dõi
			</CommonAppButton>
			<CommonAppButton v-if="canConsult" size="sm" variant="secondary" @click="open('consult')">
				Mời cho ý kiến
			</CommonAppButton>
		</div>

		<Teleport to="body">
			<div
				v-if="mode"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
				@click.self="mode = null"
			>
				<div class="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-gray-900">
					<div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ mode === 'consult' ? 'Mời cho ý kiến' : 'Thêm người theo dõi' }}
						</h3>
						<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
							{{
								mode === 'consult'
									? 'Người được mời xem phiếu và bình luận được, nhưng không tham gia duyệt.'
									: 'Người theo dõi nhận thông báo về phiếu và xem được phiếu, không tham gia duyệt.'
							}}
						</p>
					</div>
					<div class="p-6">
						<EmployeePicker v-model="selected" :people="choices" label="Chọn người" />
					</div>
					<div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
						<CommonAppButton variant="secondary" @click="mode = null">Hủy</CommonAppButton>
						<CommonAppButton :loading="submitting" @click="submit">
							{{ mode === 'consult' ? 'Gửi lời mời' : 'Thêm người theo dõi' }}
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</section>
</template>
