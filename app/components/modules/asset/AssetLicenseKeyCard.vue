<script setup lang="ts">
	const props = withDefaults(
		defineProps<{
			hasKey: boolean;
			masked: string | null;
			/** Ai được xem bản đầy đủ: quản trị viên, hoặc người phụ trách chính dịch vụ này. */
			canReveal: boolean;
			/** Ai được đặt hoặc xoá key. HR đặt được nhưng không xem được. */
			canEdit: boolean;
			/** Nơi gọi truyền hàm gọi API tương ứng (route quản lý hay route tự phục vụ). */
			reveal: () => Promise<string>;
			save: (licenseKey: string) => Promise<void>;
			clear: () => Promise<void>;
			/** Che lại sau bao lâu. */
			hideAfterMs?: number;
		}>(),
		{ hideAfterMs: 20_000 },
	);

	const emit = defineEmits<{ changed: [] }>();

	const toast = useToast();

	/**
	 * Key đang hiện. KHÔNG đưa vào store, localStorage hay log — chỉ sống trong ref này
	 * và tự xoá sau `hideAfterMs`, đúng tinh thần `Cache-Control: no-store` của response.
	 */
	const plainKey = ref<string | null>(null);
	const revealing = ref(false);
	const editing = ref(false);
	const draft = ref('');
	const saving = ref(false);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	function hideNow() {
		plainKey.value = null;
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	}

	async function onReveal() {
		if (revealing.value) return;
		revealing.value = true;
		try {
			plainKey.value = await props.reveal();
			if (hideTimer) clearTimeout(hideTimer);
			hideTimer = setTimeout(hideNow, props.hideAfterMs);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa xem được license key. Bạn thử lại sau ít phút.');
		} finally {
			revealing.value = false;
		}
	}

	async function copyKey() {
		if (!plainKey.value) return;
		try {
			await navigator.clipboard.writeText(plainKey.value);
			toast.success('Đã sao chép license key.');
		} catch {
			toast.error(
				'Trình duyệt chưa cho phép sao chép tự động. Bạn bôi đen license key rồi nhấn Ctrl+C, hoặc nhấn giữ để sao chép trên điện thoại.',
			);
		}
	}

	/** Xoá key không khôi phục được, nên hỏi lại trước khi gọi API. */
	const confirmingClear = ref(false);

	async function onSave() {
		if (!draft.value.trim() || saving.value) return;
		saving.value = true;
		try {
			await props.save(draft.value.trim());
			toast.success('Đã lưu license key.');
			draft.value = '';
			editing.value = false;
			emit('changed');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được license key. Bạn thử lại sau ít phút.');
		} finally {
			saving.value = false;
		}
	}

	async function onClear() {
		if (saving.value) return;
		saving.value = true;
		try {
			await props.clear();
			hideNow();
			toast.success('Đã xoá license key.');
			confirmingClear.value = false;
			editing.value = false;
			emit('changed');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa xoá được license key. Bạn thử lại sau ít phút.');
		} finally {
			saving.value = false;
		}
	}

	// Rời trang giữa chừng thì key không được nằm lại trong bộ nhớ.
	onBeforeUnmount(hideNow);
</script>

<template>
	<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">License key</h3>
			<div class="flex items-center gap-2">
				<CommonAppButton v-if="hasKey && canReveal && !plainKey" size="sm" variant="outline" :loading="revealing" @click="onReveal">
					Xem license key
				</CommonAppButton>
				<CommonAppButton v-if="plainKey" size="sm" variant="outline" @click="hideNow">Ẩn</CommonAppButton>
				<CommonAppButton v-if="canEdit && !editing" size="sm" variant="outline" @click="editing = true">
					{{ hasKey ? 'Thay license key' : 'Đặt license key' }}
				</CommonAppButton>
			</div>
		</div>

		<div class="mt-3">
			<p v-if="!hasKey" class="text-sm text-gray-500 dark:text-gray-400">Dịch vụ này chưa lưu license key.</p>

			<div v-else-if="plainKey" class="space-y-2">
				<div class="flex items-center gap-2">
					<code class="min-w-0 flex-1 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100">
						{{ plainKey }}
					</code>
					<CommonAppButton size="sm" variant="outline" @click="copyKey">Sao chép</CommonAppButton>
				</div>
				<p class="text-xs text-amber-600 dark:text-amber-400">
					Key sẽ tự ẩn sau ít giây. Mỗi lần xem đều được ghi nhật ký.
				</p>
			</div>

			<p v-else class="font-mono text-sm text-gray-600 dark:text-gray-300">
				{{ masked ?? '••••••••' }}
				<span v-if="!canReveal" class="ml-2 font-sans text-xs text-gray-400">
					Chỉ quản trị viên và người phụ trách dịch vụ xem được bản đầy đủ.
				</span>
			</p>
		</div>

		<div v-if="editing" class="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
			<input
				v-model="draft"
				type="text"
				autocomplete="off"
				placeholder="Dán license key"
				class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
			/>
			<div class="flex flex-wrap justify-end gap-2">
				<CommonAppButton v-if="hasKey" size="sm" variant="danger" :disabled="saving" @click="confirmingClear = true">
					Xoá license key
				</CommonAppButton>
				<CommonAppButton size="sm" variant="secondary" @click="editing = false; draft = ''">Đóng</CommonAppButton>
				<CommonAppButton size="sm" variant="primary" :disabled="!draft.trim()" :loading="saving" @click="onSave">
					Lưu
				</CommonAppButton>
			</div>
			<p v-if="!draft.trim()" class="text-right text-xs text-gray-500 dark:text-gray-400">
				Bạn dán license key mới vào ô trên để lưu.
			</p>
		</div>

		<Teleport to="body">
			<div
				v-if="confirmingClear"
				class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
				role="alertdialog"
				aria-modal="true"
				aria-label="Xoá license key"
			>
				<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Xoá license key</h2>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
						License key đã lưu sẽ mất hẳn và không khôi phục được, bạn cần key gốc để đặt lại.
					</p>
					<div class="mt-5 flex justify-end gap-3">
						<CommonAppButton variant="secondary" :disabled="saving" @click="confirmingClear = false">Giữ lại</CommonAppButton>
						<CommonAppButton variant="danger" :loading="saving" @click="onClear">Xoá license key</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
