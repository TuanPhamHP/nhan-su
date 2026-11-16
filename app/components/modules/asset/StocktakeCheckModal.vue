<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import {
		ASSET_STOCKTAKE_RESULT_LABELS,
		type AssetStocktakeLine,
		type AssetStocktakeResult,
		type CheckAssetStocktakeBody,
	} from '~/types/asset.types';

	/**
	 * Ghi tay kết quả kiểm kê một dòng khi đợt còn mở. Ghi lại thì đè lần trước, nên hộp mở sẵn kết
	 * quả đang có của dòng.
	 */
	const props = defineProps<{ stocktakeId: number; line: AssetStocktakeLine }>();

	const emit = defineEmits<{
		saved: [line: AssetStocktakeLine];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	type CheckResult = CheckAssetStocktakeBody['result'];
	const RESULTS: CheckResult[] = ['OK', 'WRONG_LOCATION', 'WRONG_HOLDER', 'DAMAGED', 'NOT_FOUND'];

	const result = ref<CheckResult>(props.line.result === 'PENDING' ? 'OK' : (props.line.result as CheckResult));
	const observedLocation = ref(props.line.observedLocation ?? '');
	const note = ref(props.line.observedNote ?? '');
	const saving = ref(false);

	const HINT: Record<CheckResult, string> = {
		OK: 'Thiết bị có mặt, đúng vị trí và đúng người giữ như trên sổ.',
		WRONG_LOCATION: 'Thiết bị có mặt nhưng nằm ở chỗ khác. Bạn ghi vị trí thực tế để sau khi đóng đợt cập nhật lại sổ.',
		WRONG_HOLDER: 'Thiết bị đang ở người khác. Bạn ghi tên người đang giữ vào ghi chú để xử lý điều chuyển sau khi đóng đợt.',
		DAMAGED: 'Thiết bị có mặt nhưng hỏng. Bạn ghi tình trạng vào ghi chú để tạo phiếu sửa sau khi đóng đợt.',
		NOT_FOUND:
			'Thiết bị không có ở chỗ kiểm (đi vắng hoặc không tìm thấy). Bạn ghi chú nơi thiết bị đang ở nếu biết. Sau khi đóng đợt, bạn chọn Giữ nguyên sổ kèm lý do hoặc Xác nhận mất.',
	};

	useEscapeKey(
		() => emit('close'),
		() => !saving.value,
	);

	async function submit() {
		if (saving.value) return;
		saving.value = true;
		try {
			const saved = await service.checkStocktake(props.stocktakeId, {
				assetId: props.line.asset.id,
				result: result.value,
				observedLocation: observedLocation.value.trim() || undefined,
				note: note.value.trim() || undefined,
				byScan: false,
			});
			toast.success(
				saved.inScope && saved.result !== 'OK'
					? `Đã ghi ${saved.asset.code} là ${saved.resultLabel}. Chênh lệch này chờ bạn xử lý sau khi đóng đợt.`
					: `Đã ghi ${saved.asset.code} là ${saved.resultLabel}.`,
			);
			emit('saved', saved);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa ghi được kết quả. Bạn thử lại sau ít phút.');
		} finally {
			saving.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
	const resultLabel = (r: AssetStocktakeResult) => ASSET_STOCKTAKE_RESULT_LABELS[r];
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:items-center sm:p-4"
			role="dialog"
			aria-modal="true"
			:aria-label="`Ghi tay kết quả kiểm kê ${line.asset.code}`"
		>
			<form class="my-4 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900" @submit.prevent="submit">
				<div class="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Ghi tay kết quả kiểm kê</h2>
					<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
						<span class="font-mono">{{ line.asset.code }}</span> · {{ line.asset.name }}
					</p>
				</div>
				<div class="space-y-4 p-4 sm:p-6">
					<fieldset class="space-y-2">
						<legend :class="labelCls">Kết quả</legend>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<label
								v-for="r in RESULTS"
								:key="r"
								class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
								:class="
									result === r
										? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200'
										: 'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300'
								"
							>
								<input v-model="result" type="radio" :value="r" class="h-4 w-4 text-brand-600 focus:ring-brand-500" />
								{{ resultLabel(r) }}
							</label>
						</div>
						<p class="text-xs text-gray-600 dark:text-gray-400">{{ HINT[result] }}</p>
					</fieldset>

					<div class="space-y-1">
						<label for="stocktake-check-location" :class="labelCls">Vị trí thực tế</label>
						<input
							id="stocktake-check-location"
							v-model="observedLocation"
							type="text"
							maxlength="200"
							:class="inputCls"
							:placeholder="line.expectedLocation ? `Theo sổ: ${line.expectedLocation}` : 'VD: Kho Long Biên, kệ số 3'"
						/>
					</div>
					<div class="space-y-1">
						<label for="stocktake-check-note" :class="labelCls">Ghi chú</label>
						<textarea id="stocktake-check-note" v-model="note" rows="2" maxlength="1000" :class="`${inputCls} resize-none`" placeholder="VD: màn hình nứt góc trái" />
					</div>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" :disabled="saving" @click="emit('close')">
							Đóng
						</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" class="min-h-11 sm:min-h-0" :loading="saving">Ghi kết quả</CommonAppButton>
					</div>
				</div>
			</form>
		</div>
	</Teleport>
</template>
