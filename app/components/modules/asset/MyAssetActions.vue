<script setup lang="ts">
	import type { AssetIncidentType } from '~/types/asset.types';

	/**
	 * Hàng nút của một thiết bị ở trang "Tài sản của tôi".
	 *
	 * Trang vẽ hàng nút ở nhiều chỗ (thẻ đang giữ, lịch sử, hộp chi tiết) nên tách ra đây, tránh
	 * sửa một chỗ quên mấy chỗ còn lại.
	 */
	withDefaults(
		defineProps<{
			canReportDamage?: boolean;
			canReportLoss?: boolean;
			/** Lý do không báo được, VD "Thiết bị đang sửa" — hiện thay cho nút. */
			statusNote?: string;
			canHandoverPdf?: boolean;
			/** Thiết bị đã thu hồi thì có thêm biên bản thu hồi; đã ghi nhận mất thì không có. */
			canReturnPdf?: boolean;
			/** Lần cấp phát sinh ra do điều chuyển thì biên bản là "Biên bản điều chuyển". */
			handoverLabel?: string;
			returnLabel?: string;
			loadingPdf?: 'assign' | 'return' | null;
			/** Lớp thêm cho mỗi nút, VD chiều cao tối thiểu 44 px trên điện thoại. */
			buttonClass?: string;
			/** Gắn mốc cho hướng dẫn từng bước trỏ vào hai nút báo của thẻ này. */
			tourReport?: boolean;
		}>(),
		{
			canReportDamage: false,
			canReportLoss: false,
			statusNote: '',
			canHandoverPdf: false,
			canReturnPdf: false,
			handoverLabel: 'Biên bản bàn giao',
			returnLabel: 'Biên bản thu hồi',
			loadingPdf: null,
			buttonClass: '',
			tourReport: false,
		},
	);

	const emit = defineEmits<{
		report: [type: AssetIncidentType];
		pdf: [kind: 'assign' | 'return'];
	}>();
</script>

<template>
	<div class="flex flex-wrap items-center gap-2">
		<CommonAppButton
			v-if="canReportDamage"
			:data-tour="tourReport ? 'my-report' : undefined"
			size="sm"
			variant="outline"
			:class="buttonClass"
			@click="emit('report', 'DAMAGE')"
		>
			Báo hỏng
		</CommonAppButton>
		<CommonAppButton
			v-if="canReportLoss"
			:data-tour="tourReport ? 'my-report' : undefined"
			size="sm"
			variant="outline"
			:class="buttonClass"
			@click="emit('report', 'LOSS')"
		>
			Báo mất
		</CommonAppButton>
		<p v-if="statusNote" class="basis-full text-sm text-amber-700 dark:text-amber-400">{{ statusNote }}</p>
		<CommonAppButton
			v-if="canHandoverPdf"
			size="sm"
			variant="secondary"
			:class="buttonClass"
			:loading="loadingPdf === 'assign'"
			@click="emit('pdf', 'assign')"
		>
			{{ handoverLabel }}
		</CommonAppButton>
		<CommonAppButton
			v-if="canReturnPdf"
			size="sm"
			variant="secondary"
			:class="buttonClass"
			:loading="loadingPdf === 'return'"
			@click="emit('pdf', 'return')"
		>
			{{ returnLabel }}
		</CommonAppButton>
	</div>
</template>
