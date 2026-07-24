<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { useOvertimeRequestService } from '~/services/overtime-request.service';
import type { OvertimeWorkMode } from '~/types/overtime.types';

definePageMeta({ title: 'Tạo đơn làm thêm giờ' });

const router = useRouter();
const toast = useToast();
const service = useOvertimeRequestService();

// ─── Form ─────────────────────────────────────────────────────────────────────
const schema = toTypedSchema(
	z.object({
		overtimeDate: z.string().min(1, 'Vui lòng chọn ngày OT'),
		startTime: z.string().min(1, 'Vui lòng nhập giờ bắt đầu'),
		endTime: z.string().min(1, 'Vui lòng nhập giờ kết thúc'),
		reason: z.string().min(10, 'Lý do phải có ít nhất 10 ký tự'),
		workMode: z.enum(['ONLINE', 'OFFLINE'], { message: 'Vui lòng chọn hình thức OT' }),
	}),
);

const { handleSubmit, defineField, errors, isSubmitting } = useForm({
	validationSchema: schema,
	initialValues: { workMode: 'ONLINE' as OvertimeWorkMode },
});

const [overtimeDate, overtimeDateAttrs] = defineField('overtimeDate');
const [startTime, startTimeAttrs] = defineField('startTime');
const [endTime, endTimeAttrs] = defineField('endTime');
const [reason, reasonAttrs] = defineField('reason');
const [workMode] = defineField('workMode');

// ─── OT Rate preview — detect Chủ nhật để hint; ngày lễ do BE detect ─────────
const otRatePreview = computed(() => {
	const d = overtimeDate.value as string | undefined;
	if (!d) return null;
	const day = new Date(d).getDay(); // 0 = Sunday
	if (day === 0) return { rate: 200, label: '200%', note: 'Chủ nhật' };
	return { rate: 150, label: '150%', note: 'Ngày thường' };
});

// ─── Preview: tổng giờ OT ────────────────────────────────────────────────────
const previewHours = computed(() => {
	const s = startTime.value as string | undefined;
	const e = endTime.value as string | undefined;
	if (!s || !e) return null;

	const base = new Date('2000-01-01');
	const [sh, sm] = s.split(':').map(Number);
	const [eh, em] = e.split(':').map(Number);
	const start = new Date(base);
	start.setHours(sh, sm, 0);
	let end = new Date(base);
	end.setHours(eh, em, 0);

	// OT qua đêm: endTime < startTime → cộng thêm 24h
	if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);

	const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
	if (hours < 0.5) return { hours, error: 'Thời gian OT tối thiểu 30 phút' };
	if (hours > 12) return { hours, error: 'Thời gian OT tối đa 12 giờ/đơn' };
	return { hours, error: null };
});

const isOvernightOT = computed(() => {
	const s = startTime.value as string | undefined;
	const e = endTime.value as string | undefined;
	if (!s || !e) return false;
	const [sh, sm] = s.split(':').map(Number);
	const [eh, em] = e.split(':').map(Number);
	return eh * 60 + em <= sh * 60 + sm;
});

// ─── Combine date + time → ISO 8601 UTC ──────────────────────────────────────
function toIsoUtc(date: string, time: string): string {
	return new Date(`${date}T${time}:00`).toISOString();
}

// ─── Submit ───────────────────────────────────────────────────────────────────
const onSubmit = handleSubmit(async values => {
	const preview = previewHours.value;
	if (preview?.error) {
		toast.error(preview.error);
		return;
	}

	try {
		const created = await service.create({
			overtimeDate: values.overtimeDate,
			startTime: toIsoUtc(values.overtimeDate, values.startTime),
			endTime: toIsoUtc(
				isOvernightOT.value
					? format(new Date(new Date(values.overtimeDate).getTime() + 86400000), 'yyyy-MM-dd')
					: values.overtimeDate,
				values.endTime,
			),
			reason: values.reason,
			workMode: values.workMode,
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

// ─── Today as default date ────────────────────────────────────────────────────
const today = format(new Date(), 'yyyy-MM-dd');
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
					<!-- Ngày OT -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
							Ngày OT <span class="text-red-500">*</span>
						</label>
						<input
							v-model="overtimeDate"
							v-bind="overtimeDateAttrs"
							type="date"
							:max="today"
							class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
							:class="errors.overtimeDate ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
						/>
						<p v-if="errors.overtimeDate" class="mt-1 text-xs text-red-500">{{ errors.overtimeDate }}</p>
						<p v-if="otRatePreview" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Hệ số OT dự kiến:
							<span class="font-semibold text-green-600 dark:text-green-400">{{ otRatePreview.label }}</span>
							({{ otRatePreview.note }})
							<span class="text-gray-400 dark:text-gray-500">— Ngày lễ sẽ được tính 300% tự động</span>
						</p>
						<p v-else class="mt-1 text-xs text-gray-400">Chỉ được tạo đơn trong vòng 30 ngày kể từ ngày OT</p>
					</div>

					<!-- Giờ bắt đầu + Giờ kết thúc -->
					<div class="grid sm:grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Giờ bắt đầu <span class="text-red-500">*</span>
							</label>
							<UiTimeInput
								v-model="startTime"
								v-bind="startTimeAttrs"
								placeholder="--:--"
								:error="errors.startTime"
							/>
							<p v-if="errors.startTime" class="mt-1 text-xs text-red-500">{{ errors.startTime }}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Giờ kết thúc <span class="text-red-500">*</span>
							</label>
							<UiTimeInput
								v-model="endTime"
								v-bind="endTimeAttrs"
								placeholder="--:--"
								:error="errors.endTime"
							/>
							<p v-if="errors.endTime" class="mt-1 text-xs text-red-500">{{ errors.endTime }}</p>
						</div>
					</div>

					<!-- Preview tổng giờ -->
					<div
						v-if="previewHours"
						:class="[
							'flex items-start gap-3 px-4 py-3 rounded-lg border',
							previewHours.error
								? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
								: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
						]"
					>
						<svg
							v-if="!previewHours.error"
							class="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<svg
							v-else
							class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
						<div>
							<p
								:class="[
									'text-sm font-medium',
									previewHours.error ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300',
								]"
							>
								<template v-if="previewHours.error">{{ previewHours.error }}</template>
								<template v-else>
									Tổng thời gian OT: <strong>{{ previewHours.hours.toFixed(1) }} giờ</strong>
									<span v-if="isOvernightOT" class="ml-2 text-xs font-normal opacity-75">(OT qua đêm)</span>
								</template>
							</p>
						</div>
					</div>

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

					<!-- Submit -->
					<div class="pt-1">
						<CommonAppButton
							type="submit"
							class="w-full justify-center"
							:loading="isSubmitting"
							:disabled="!!previewHours?.error"
						>
							<svg v-if="!isSubmitting" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
							</svg>
							{{ isSubmitting ? 'Đang gửi đơn…' : 'Gửi đơn OT' }}
						</CommonAppButton>
					</div>
				</form>
			</div>

			<!-- ── Right: Info panel — desktop only ─────────────────────────── -->
			<div class="hidden lg:block lg:w-72 space-y-4">
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
							<span>Chủ nhật được OT cả ngày, không kiểm tra ca</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Tối thiểu <strong class="text-gray-700 dark:text-gray-300">0.5 giờ</strong>, tối đa <strong class="text-gray-700 dark:text-gray-300">12 giờ</strong>/đơn</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Chỉ được tạo đơn trong vòng <strong class="text-gray-700 dark:text-gray-300">30 ngày</strong> kể từ ngày OT</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Đơn tự động huỷ nếu chưa được duyệt sau <strong class="text-gray-700 dark:text-gray-300">7 ngày</strong></span>
						</li>
					</ul>
				</div>

				<!-- Người duyệt -->
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
						<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
						</svg>
						Người duyệt
					</h3>
					<p class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
						Đơn sẽ được gửi đến <strong class="text-gray-600 dark:text-gray-300">trưởng phòng trực tiếp</strong> của bạn. Nếu không có, đơn gửi đến HR.
					</p>
				</div>
			</div>
		</div>
	</div>
</template>
