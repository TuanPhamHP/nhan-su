<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { format, eachDayOfInterval, parseISO, isWeekend } from 'date-fns';
import { useOnlineWorkRequestService } from '~/services/online-work-request.service';

definePageMeta({ title: 'Tạo đơn làm online' });

const router = useRouter();
const toast = useToast();
const service = useOnlineWorkRequestService();

const today = format(new Date(), 'yyyy-MM-dd');

// ─── Form ─────────────────────────────────────────────────────────────────────
const schema = toTypedSchema(
	z.object({
		startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
		endDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc'),
		reason: z.string().min(10, 'Lý do phải có ít nhất 10 ký tự'),
	}).refine(data => data.endDate >= data.startDate, {
		message: 'Ngày kết thúc phải >= ngày bắt đầu',
		path: ['endDate'],
	}),
);

const { handleSubmit, defineField, errors, isSubmitting, values } = useForm({ validationSchema: schema });

const [startDate, startDateAttrs] = defineField('startDate');
const [endDate, endDateAttrs] = defineField('endDate');
const [reason, reasonAttrs] = defineField('reason');

// ─── Working days preview ─────────────────────────────────────────────────────
const workingDaysPreview = computed(() => {
	const s = startDate.value as string | undefined;
	const e = endDate.value as string | undefined;
	if (!s || !e || e < s) return null;
	try {
		const days = eachDayOfInterval({ start: parseISO(s), end: parseISO(e) });
		const count = days.filter(d => !isWeekend(d)).length;
		return count;
	} catch {
		return null;
	}
});

const requiresMultiLevel = computed(() =>
	workingDaysPreview.value !== null && workingDaysPreview.value >= 3,
);

// ─── Submit ───────────────────────────────────────────────────────────────────
const onSubmit = handleSubmit(async vals => {
	if (workingDaysPreview.value === 0) {
		toast.error('Khoảng thời gian không có ngày làm việc (T7/CN không tính)');
		return;
	}
	try {
		const created = await service.create({
			startDate: vals.startDate,
			endDate: vals.endDate,
			reason: vals.reason,
		});
		const approverName = created.approverL1?.fullName;
		if (approverName) {
			toast.success(`Đã gửi đơn làm online. Đang chờ ${approverName} duyệt.`);
		} else {
			toast.success('Đã gửi đơn làm online thành công.');
		}
		setTimeout(() => router.push('/online-work/my'), 1200);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex items-center gap-3">
			<NuxtLink
				to="/online-work/my"
				class="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
				title="Quay lại"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Tạo đơn làm online</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Đăng ký làm việc tại nhà để quản lý phê duyệt</p>
			</div>
		</div>

		<div class="flex flex-col lg:flex-row gap-6 items-start">
			<!-- ── Left: Form ──────────────────────────────────────────────────── -->
			<div class="flex-1 min-w-0">
				<form
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5"
					@submit.prevent="onSubmit"
				>
					<!-- Date range -->
					<div class="grid sm:grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Từ ngày <span class="text-red-500">*</span>
							</label>
							<input
								v-model="startDate"
								v-bind="startDateAttrs"
								type="date"
								class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
								:class="errors.startDate ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
							/>
							<p v-if="errors.startDate" class="mt-1 text-xs text-red-500">{{ errors.startDate }}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
								Đến ngày <span class="text-red-500">*</span>
							</label>
							<input
								v-model="endDate"
								v-bind="endDateAttrs"
								type="date"
								:min="startDate as string | undefined"
								class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
								:class="errors.endDate ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
							/>
							<p v-if="errors.endDate" class="mt-1 text-xs text-red-500">{{ errors.endDate }}</p>
						</div>
					</div>

					<!-- Working days preview -->
					<div v-if="workingDaysPreview !== null">
						<!-- No working days -->
						<div
							v-if="workingDaysPreview === 0"
							class="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800"
						>
							<svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
							</svg>
							<p class="text-sm text-red-700 dark:text-red-300">Không có ngày làm việc trong khoảng này (T7/CN không tính)</p>
						</div>

						<!-- Has working days -->
						<div v-else class="space-y-2">
							<div class="flex items-center gap-3 px-4 py-3 rounded-lg bg-sky-50 border border-sky-200 dark:bg-sky-900/20 dark:border-sky-800">
								<svg class="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
								</svg>
								<p class="text-sm text-sky-700 dark:text-sky-300">
									Ước tính <strong>{{ workingDaysPreview }} ngày làm việc</strong> (không tính T7/CN)
								</p>
							</div>

							<!-- Multi-level indicator -->
							<div
								:class="[
									'flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm',
									requiresMultiLevel
										? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
										: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
								]"
							>
								<svg
									class="w-4 h-4 flex-shrink-0"
									:class="requiresMultiLevel ? 'text-orange-500' : 'text-green-600 dark:text-green-400'"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
								</svg>
								<span :class="requiresMultiLevel ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-300'">
									<template v-if="requiresMultiLevel">
										Đơn ≥ 3 ngày — cần <strong>3 cấp duyệt</strong> (cấp 1 → cấp 2 → Giám đốc)
									</template>
									<template v-else>
										Đơn &lt; 3 ngày — chỉ cần <strong>1 cấp duyệt</strong>
									</template>
								</span>
							</div>
						</div>
					</div>

					<!-- Lý do -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
							Lý do làm online <span class="text-red-500">*</span>
						</label>
						<textarea
							v-model="reason"
							v-bind="reasonAttrs"
							rows="4"
							placeholder="Nhập lý do cần làm việc tại nhà (tối thiểu 10 ký tự)"
							class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none"
							:class="errors.reason ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
						/>
						<div class="flex items-center justify-between mt-1">
							<p v-if="errors.reason" class="text-xs text-red-500">{{ errors.reason }}</p>
							<p v-else class="text-xs text-gray-400">{{ (reason as string | undefined)?.length ?? 0 }} ký tự</p>
						</div>
					</div>

					<!-- Submit -->
					<div class="pt-1">
						<CommonAppButton
							type="submit"
							class="w-full justify-center"
							:loading="isSubmitting"
							:disabled="workingDaysPreview === 0"
						>
							<svg v-if="!isSubmitting" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
							</svg>
							{{ isSubmitting ? 'Đang gửi đơn…' : 'Gửi đơn làm online' }}
						</CommonAppButton>
					</div>
				</form>
			</div>

			<!-- ── Right: Info panel ──────────────────────────────────────────── -->
			<div class="w-full lg:w-72 space-y-4">
				<!-- Quy định -->
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
						<svg class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
						</svg>
						Quy định làm online
					</h3>
					<ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Thứ 7 và Chủ nhật <strong class="text-gray-700 dark:text-gray-300">không được tính</strong> vào số ngày làm online</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Khoảng chọn phải có <strong class="text-gray-700 dark:text-gray-300">ít nhất 1 ngày làm việc</strong></span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Đơn dưới 3 ngày: <strong class="text-gray-700 dark:text-gray-300">1 cấp duyệt</strong> (line manager)</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Đơn từ 3 ngày trở lên: <strong class="text-gray-700 dark:text-gray-300">3 cấp duyệt</strong> (line manager → dept manager → Giám đốc)</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-gray-400 mt-0.5 flex-shrink-0">•</span>
							<span>Khi được duyệt, bản ghi chấm công của các ngày làm online sẽ được cập nhật</span>
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
						Đơn được gửi đến <strong class="text-gray-600 dark:text-gray-300">trưởng nhóm trực tiếp</strong> của bạn. Đơn dài (≥ 3 ngày) sẽ tiếp tục lên <strong class="text-gray-600 dark:text-gray-300">Giám đốc</strong> xác nhận.
					</p>
				</div>
			</div>
		</div>
	</div>
</template>
