<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useOvertimeRequestService } from '~/services/overtime-request.service';
import type { AvailableLocationDto, OvertimePreviewResponse, OvertimeWorkMode } from '~/types/overtime.types';
import { rateBadgeClassCompact } from '~/utils/overtime.utils';

definePageMeta({ title: 'Tạo đơn làm thêm giờ' });

const router = useRouter();
const toast = useToast();
const service = useOvertimeRequestService();

// ─── Form ─────────────────────────────────────────────────────────────────────
// startTime/endTime: giá trị từ <input type="datetime-local"> — dạng "YYYY-MM-DDTHH:mm" (không có timezone)
const schema = toTypedSchema(
	z
		.object({
			startTime: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu'),
			endTime: z.string().min(1, 'Vui lòng chọn thời gian kết thúc'),
			reason: z.string().min(10, 'Lý do phải có ít nhất 10 ký tự'),
			workMode: z.enum(['ONLINE', 'OFFLINE'], { message: 'Vui lòng chọn hình thức OT' }),
			locationId: z.number().nullable().optional(),
		})
		.superRefine((data, ctx) => {
			if (data.workMode === 'OFFLINE' && !data.locationId) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Vui lòng chọn địa điểm thực hiện OT',
					path: ['locationId'],
				});
			}
		}),
);

const { handleSubmit, defineField, errors, isSubmitting } = useForm({
	validationSchema: schema,
	initialValues: { workMode: 'ONLINE' as OvertimeWorkMode },
});

const [startTime, startTimeAttrs] = defineField('startTime');
const [endTime, endTimeAttrs] = defineField('endTime');
const [reason, reasonAttrs] = defineField('reason');
const [workMode] = defineField('workMode');
const [locationId, locationIdAttrs] = defineField('locationId');

// ─── Available locations ─────────────────────────────────────────────────────
const availableLocations = ref<AvailableLocationDto[]>([]);
const loadingLocations = ref(false);

watch(workMode, async mode => {
	if (mode === 'OFFLINE' && availableLocations.value.length === 0) {
		loadingLocations.value = true;
		try {
			availableLocations.value = await service.fetchAvailableLocations();
		} catch {
			toast.error('Không thể tải danh sách địa điểm');
		} finally {
			loadingLocations.value = false;
		}
	}
	if (mode === 'ONLINE') {
		locationId.value = null;
	}
});

// ─── Preview endpoint — debounced 400ms, rate-limit 20/60s handled ────────────
const previewData = ref<OvertimePreviewResponse | null>(null);
const previewError = ref<string | null>(null);
const previewLoading = ref(false);
const rateLimitedUntil = ref(0); // timestamp ms

function isRateLimit(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const e = err as { status?: number; statusCode?: number; response?: { status?: number } };
	return e.status === 429 || e.statusCode === 429 || e.response?.status === 429;
}

function debounce<T extends () => void>(fn: T, ms: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(fn, ms);
	};
}

function toIso(dtLocal: string): string {
	// dtLocal: "YYYY-MM-DDTHH:mm" — JS Date treats as local, .toISOString() → UTC
	return new Date(dtLocal).toISOString();
}

async function runPreviewNow() {
	const s = startTime.value as string | undefined;
	const e = endTime.value as string | undefined;
	const mode = workMode.value as OvertimeWorkMode | undefined;
	const loc = locationId.value as number | null | undefined;

	if (!s || !e || !mode) return;
	if (mode === 'OFFLINE' && !loc) return;
	if (Date.now() < rateLimitedUntil.value) return;

	previewLoading.value = true;
	try {
		previewData.value = await service.preview({
			startTime: toIso(s),
			endTime: toIso(e),
			workMode: mode,
			locationId: mode === 'OFFLINE' ? (loc ?? undefined) : undefined,
		});
		previewError.value = null;
	} catch (err) {
		previewData.value = null;
		if (isRateLimit(err)) {
			rateLimitedUntil.value = Date.now() + 60_000;
			previewError.value = 'Bạn thao tác quá nhanh — auto-preview tạm ngưng 60 giây.';
			toast.warning(previewError.value);
		} else {
			previewError.value = err instanceof Error ? err.message : 'Không kiểm tra được thông tin đơn.';
		}
	} finally {
		previewLoading.value = false;
	}
}

const runPreview = debounce(runPreviewNow, 400);

watch([startTime, endTime, workMode, locationId], () => {
	runPreview();
});

// ─── Submit ───────────────────────────────────────────────────────────────────
const canSubmit = computed(() => previewData.value?.isValid === true);

const onSubmit = handleSubmit(async values => {
	if (!canSubmit.value) {
		toast.error(previewData.value?.reason ?? 'Vui lòng chờ preview hoàn tất trước khi gửi');
		return;
	}
	try {
		const created = await service.create({
			startTime: toIso(values.startTime),
			endTime: toIso(values.endTime),
			reason: values.reason,
			workMode: values.workMode,
			locationId: values.workMode === 'OFFLINE' ? (values.locationId ?? undefined) : undefined,
		});

		const approverName = created.assignedApprover?.fullName;
		if (approverName) {
			toast.success(`Đã gửi đơn OT thành công. Đang chờ ${approverName} duyệt.`);
		} else {
			toast.success('Đã gửi đơn OT. Manager sẽ xem xét.');
		}
		setTimeout(() => router.push('/overtime/my'), 1200);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});

// ─── Preview format helpers ──────────────────────────────────────────────────
function fmtDateTime(iso: string): string {
	return format(new Date(iso), 'HH:mm dd/MM/yyyy', { locale: vi });
}
function fmtVnDayLabel(iso: string): string {
	const d = new Date(iso).getDay();
	return d === 0 ? 'CN' : `T${d + 1}`;
}
function fmtSegmentDate(dateYmd: string): string {
	const d = new Date(`${dateYmd}T00:00`);
	const label = fmtVnDayLabel(`${dateYmd}T00:00`);
	return `${format(d, 'dd/MM/yyyy')} (${label})`;
}
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex items-center gap-3">
			<NuxtLink
				to="/overtime/my"
				class="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
				title="Quay lại"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Tạo đơn làm thêm giờ</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Đăng ký ca OT để quản lý duyệt</p>
			</div>
		</div>

		<div class="flex flex-col lg:flex-row gap-6 lg:items-start">
			<!-- ── Left: Form ──────────────────────────────────────────────────── -->
			<div class="flex-1 min-w-0">
				<form
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-5"
					@submit.prevent="onSubmit"
				>
					<!-- Bắt đầu + Kết thúc (datetime-local, gồm cả ngày + giờ) -->
					<div class="grid sm:grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Bắt đầu <span class="text-red-500">*</span>
							</label>
							<input
								v-model="startTime"
								v-bind="startTimeAttrs"
								type="datetime-local"
								step="1800"
								class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
								:class="errors.startTime ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
							/>
							<p v-if="errors.startTime" class="mt-1 text-xs text-red-500">{{ errors.startTime }}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Kết thúc <span class="text-red-500">*</span>
							</label>
							<input
								v-model="endTime"
								v-bind="endTimeAttrs"
								type="datetime-local"
								step="1800"
								class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
								:class="errors.endTime ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
							/>
							<p v-if="errors.endTime" class="mt-1 text-xs text-red-500">{{ errors.endTime }}</p>
						</div>
					</div>
					<p class="-mt-3 text-xs text-gray-400">
						Được phép qua đêm / qua ngày. Rate detect theo từng đoạn ngày (BE tự tính).
					</p>

					<!-- Lý do -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
							Lý do làm thêm giờ <span class="text-red-500">*</span>
						</label>
						<textarea
							v-model="reason"
							v-bind="reasonAttrs"
							rows="4"
							placeholder="Nhập lý do làm thêm giờ (tối thiểu 10 ký tự)"
							class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none"
							:class="errors.reason ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
						/>
						<div class="flex items-center justify-between mt-1">
							<p v-if="errors.reason" class="text-xs text-red-500">{{ errors.reason }}</p>
							<p v-else class="text-xs text-gray-400">{{ (reason as string | undefined)?.length ?? 0 }} ký tự</p>
						</div>
					</div>

					<!-- Hình thức OT -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
							Hình thức làm thêm giờ <span class="text-red-500">*</span>
						</label>
						<div class="grid grid-cols-2 gap-3">
							<button
								type="button"
								:class="[
									'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
									workMode === 'OFFLINE'
										? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
										: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400',
								]"
								@click="workMode = 'OFFLINE'"
							>
								<span class="text-2xl">🏢</span>
								<div class="text-left">
									<p class="font-medium text-sm">Tại văn phòng</p>
									<p class="text-xs opacity-70">Cần xác nhận GPS</p>
								</div>
							</button>
							<button
								type="button"
								:class="[
									'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
									workMode === 'ONLINE'
										? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
										: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400',
								]"
								@click="workMode = 'ONLINE'"
							>
								<span class="text-2xl">🏠</span>
								<div class="text-left">
									<p class="font-medium text-sm">Online / Từ xa</p>
									<p class="text-xs opacity-70">Không cần GPS</p>
								</div>
							</button>
						</div>
						<p v-if="errors.workMode" class="mt-1 text-xs text-red-500">{{ errors.workMode }}</p>
					</div>

					<!-- Địa điểm OT (chỉ khi OFFLINE) -->
					<div v-if="workMode === 'OFFLINE'">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
							Địa điểm thực hiện OT <span class="text-red-500">*</span>
						</label>

						<div v-if="loadingLocations" class="text-sm text-gray-400 dark:text-gray-500 py-2">
							Đang tải địa điểm...
						</div>

						<template v-else>
							<select
								v-model="locationId"
								v-bind="locationIdAttrs"
								class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
								:class="errors.locationId ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
							>
								<option :value="null">-- Chọn địa điểm --</option>
								<option v-for="loc in availableLocations" :key="loc.id" :value="loc.id">
									📍 {{ loc.name }}
								</option>
							</select>
							<p v-if="errors.locationId" class="mt-1 text-xs text-red-500">{{ errors.locationId }}</p>
							<p
								v-else-if="availableLocations.length === 0"
								class="mt-1 text-xs text-amber-600 dark:text-amber-400"
							>
								Hệ thống chưa có địa điểm chấm công nào — liên hệ HR để cấp thêm.
							</p>
							<p v-else class="mt-1 text-xs text-gray-400 dark:text-gray-500">
								Chọn địa điểm nơi bạn sẽ thực hiện OT — khi chấm GPS sẽ verify đúng địa điểm đã khai
							</p>
						</template>
					</div>

					<!-- Submit -->
					<div class="pt-1">
						<CommonAppButton
							type="submit"
							class="w-full justify-center"
							:loading="isSubmitting"
							:disabled="!canSubmit"
						>
							<svg v-if="!isSubmitting" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
							</svg>
							{{ isSubmitting ? 'Đang gửi đơn…' : 'Gửi đơn OT' }}
						</CommonAppButton>
						<p v-if="!previewData && !previewLoading" class="mt-2 text-xs text-gray-400 text-center">
							Điền đủ thông tin để hiển thị chi tiết đơn và kích hoạt nút gửi
						</p>
						<p v-else-if="previewData && !previewData.isValid" class="mt-2 text-xs text-red-500 text-center">
							Vui lòng sửa lỗi hiển thị ở panel bên phải trước khi gửi
						</p>
					</div>
				</form>
			</div>

			<!-- ── Right: Info panel ─────────────────────────────────────────── -->
			<div class="lg:w-80 space-y-4">
				<!-- Chi tiết đơn OT (preview card) -->
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
						<svg class="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						Chi tiết đơn OT
					</h3>

					<!-- Invalid banner (isValid=false) -->
					<div
						v-if="previewData && !previewData.isValid"
						class="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2"
					>
						<p class="text-xs font-medium text-red-700 dark:text-red-300 leading-relaxed">
							{{ previewData.reason ?? 'Đơn OT không hợp lệ' }}
						</p>
					</div>

					<!-- Rate limit / generic error -->
					<div
						v-else-if="previewError"
						class="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2"
					>
						<p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
							{{ previewError }}
						</p>
					</div>

					<!-- Loading state -->
					<div v-if="previewLoading" class="animate-pulse space-y-2">
						<div class="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
						<div class="h-3 w-40 bg-gray-100 dark:bg-gray-800 rounded" />
						<div class="h-3 w-28 bg-gray-100 dark:bg-gray-800 rounded" />
					</div>

					<!-- Empty state — chưa gọi preview -->
					<p
						v-else-if="!previewData"
						class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed"
					>
						Điền đủ thời gian, hình thức và địa điểm (nếu OT tại văn phòng) để xem chi tiết đơn.
					</p>

					<!-- Preview data -->
					<div v-else class="space-y-3 text-sm">
						<!-- Times -->
						<div class="space-y-1">
							<div class="flex justify-between gap-2">
								<span class="text-xs text-gray-500 dark:text-gray-400">Bắt đầu</span>
								<span class="font-medium text-gray-900 dark:text-white text-right">
									{{ fmtDateTime(previewData.startTime) }}
									<span class="text-xs font-normal text-gray-400">({{ fmtVnDayLabel(previewData.startTime) }})</span>
								</span>
							</div>
							<div class="flex justify-between gap-2">
								<span class="text-xs text-gray-500 dark:text-gray-400">Kết thúc</span>
								<span class="font-medium text-gray-900 dark:text-white text-right">
									{{ fmtDateTime(previewData.endTime) }}
									<span class="text-xs font-normal text-gray-400">({{ fmtVnDayLabel(previewData.endTime) }})</span>
								</span>
							</div>
						</div>

						<!-- Total hours -->
						<div class="flex justify-between text-xs">
							<span class="text-gray-500 dark:text-gray-400">Tổng giờ</span>
							<span class="font-medium text-gray-900 dark:text-white">{{ previewData.totalHours.toFixed(1) }} giờ</span>
						</div>

						<!-- Segments breakdown -->
						<div
							v-if="previewData.segments.length > 0"
							class="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 p-2.5"
						>
							<p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
								Chi tiết theo ngày
							</p>
							<ul class="space-y-1">
								<li
									v-for="(seg, idx) in previewData.segments"
									:key="idx"
									class="flex items-center justify-between text-xs gap-2"
								>
									<span class="text-gray-600 dark:text-gray-300">{{ fmtSegmentDate(seg.segmentDate) }}</span>
									<span class="flex items-center gap-1.5 flex-shrink-0">
										<span class="text-gray-900 dark:text-white font-medium">{{ seg.hours.toFixed(1) }}h</span>
										<span
											:class="['px-1.5 py-0.5 rounded text-[10px] font-semibold', rateBadgeClassCompact(seg.otRate)]"
										>
											{{ seg.otRateLabel }}
										</span>
										<span class="text-[10px] text-gray-400">
											= {{ (seg.hours * seg.otRate / 100).toFixed(1) }}h
										</span>
									</span>
								</li>
							</ul>
						</div>

						<!-- Total paid hours -->
						<div class="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2">
							<span class="text-xs text-gray-500 dark:text-gray-400">Giờ trả lương</span>
							<span class="text-sm font-semibold text-green-600 dark:text-green-400">
								{{ previewData.totalPaidHours.toFixed(1) }} giờ
							</span>
						</div>

						<!-- Approver -->
						<div class="flex justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-2">
							<span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">Người duyệt</span>
							<span class="text-right min-w-0">
								<template v-if="previewData.approver">
									<span class="text-sm font-medium text-gray-900 dark:text-white truncate">
										{{ previewData.approver.fullName }}
									</span>
									<span v-if="previewData.approverFallbackToHR" class="block text-[10px] text-amber-500">
										(fallback HR)
									</span>
								</template>
								<template v-else-if="previewData.approverFallbackToHR">
									<span class="text-sm font-medium text-amber-600 dark:text-amber-400">Toàn bộ HR</span>
									<span class="block text-[10px] text-gray-400">Không có trưởng phòng trực tiếp</span>
								</template>
								<template v-else>
									<span class="text-sm text-gray-400 italic">Chưa xác định</span>
								</template>
							</span>
						</div>

						<!-- Location (chỉ khi OFFLINE) -->
						<div v-if="previewData.workMode === 'OFFLINE'" class="flex justify-between gap-2">
							<span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">Địa điểm</span>
							<span class="text-right min-w-0">
								<template v-if="previewData.location">
									<span class="text-sm font-medium text-gray-900 dark:text-white truncate">
										📍 {{ previewData.location.name }}
									</span>
								</template>
								<template v-else>
									<span class="text-sm text-red-500 italic">Địa điểm không hợp lệ</span>
								</template>
							</span>
						</div>
					</div>
				</div>

				<!-- Quy định OT -->
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
						<svg class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
						</svg>
						Quy định OT
					</h3>
					<ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Thời gian OT phải nằm <strong class="text-gray-700 dark:text-gray-300">ngoài giờ ca</strong> (trước check-in hoặc sau check-out)</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Chủ nhật / ngày lễ được OT cả ngày, không kiểm tra ca</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Tối thiểu <strong class="text-gray-700 dark:text-gray-300">0.5 giờ</strong>, tối đa <strong class="text-gray-700 dark:text-gray-300">12 giờ</strong>/đơn</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>OT qua đêm/qua ngày OK, rate detect theo từng đoạn ngày</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Đơn tự động huỷ nếu chưa được duyệt sau <strong class="text-gray-700 dark:text-gray-300">7 ngày</strong></span>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</template>
