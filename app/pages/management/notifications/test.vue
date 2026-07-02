<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useNotificationService } from '~/services/notification.service';
	import type {
		TestNotificationResult,
		FcmTestResult,
		NotificationPlatform,
		NotificationType,
		NotificationCategory,
	} from '~/types/notification.types';

	// Tất cả NotificationType enum (khớp backend prisma schema).
	// Xem docs/backend/fcm-notification-routing.json để biết mapping → category/refType.
	const NOTIFICATION_TYPES: NotificationType[] = [
		'CHECK_IN', 'CHECK_OUT', 'LATE', 'ABSENT', 'MISSING_CHECKOUT',
		'CHECKIN_REMINDER', 'CHECKOUT_REMINDER',
		'LEAVE_CREATED', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_CANCELLED', 'LEAVE_AUTO_CANCELLED',
		'OT_CREATED', 'OT_APPROVED', 'OT_REJECTED', 'OT_CANCELLED', 'OT_AUTO_CANCELLED',
		'VIOLATION_CREATED', 'VIOLATION_APPROVED', 'VIOLATION_REJECTED',
		'ONLINE_WORK_CREATED', 'ONLINE_WORK_APPROVED', 'ONLINE_WORK_REJECTED', 'ONLINE_WORK_CANCELLED', 'ONLINE_WORK_COMPLETED',
		'MAKEUP_CREATED', 'MAKEUP_APPROVED', 'MAKEUP_REJECTED', 'MAKEUP_CANCELLED',
		'CONTRACT_EXPIRY_WARNING',
		'BUSINESS_TRIP_PENDING', 'BUSINESS_TRIP_APPROVED', 'BUSINESS_TRIP_REJECTED',
		'GENERAL_REQUEST_PENDING', 'GENERAL_REQUEST_APPROVED', 'GENERAL_REQUEST_REJECTED', 'GENERAL_REQUEST_CANCELLED',
		'TEST',
	];

	const NOTIFICATION_CATEGORIES: NotificationCategory[] = ['EVENT', 'ATTENDANCE', 'LEAVE', 'REQUEST'];

	// Preset auto-fill — khớp với mapping trong fcm-notification-routing.json
	interface FcmPreset {
		label: string;
		type: NotificationType;
		category: NotificationCategory;
		refType: string;
		title: string;
		body: string;
		idExample: string;
	}

	const FCM_PRESETS: FcmPreset[] = [
		{ label: 'Đi muộn (LATE)', type: 'LATE', category: 'ATTENDANCE', refType: '', title: 'Bạn đã đi muộn', body: 'Check-in lúc 09:15, muộn 15 phút', idExample: '' },
		{ label: 'Quên check-out', type: 'MISSING_CHECKOUT', category: 'ATTENDANCE', refType: '', title: 'Quên check-out', body: 'Hôm qua bạn chưa check-out', idExample: '' },
		{ label: 'Đơn nghỉ được duyệt', type: 'LEAVE_APPROVED', category: 'LEAVE', refType: 'leave_request', title: 'Đơn nghỉ đã được duyệt', body: 'Đơn nghỉ ngày 30/06 đã được duyệt', idExample: '123' },
		{ label: 'Đơn OT được tạo', type: 'OT_CREATED', category: 'EVENT', refType: 'overtime_request', title: 'Đơn OT mới', body: 'NV Nguyễn A vừa gửi đơn OT', idExample: '45' },
		{ label: 'Đơn vi phạm bị từ chối', type: 'VIOLATION_REJECTED', category: 'EVENT', refType: 'violation_request', title: 'Đơn giải trình bị từ chối', body: 'Vui lòng kiểm tra lý do từ chối', idExample: '12' },
		{ label: 'Đơn làm online được duyệt', type: 'ONLINE_WORK_APPROVED', category: 'LEAVE', refType: 'online_work_request', title: 'Đơn làm online đã duyệt', body: 'L1 đã duyệt, chờ L2', idExample: '78' },
		{ label: 'Đi công tác — chờ duyệt', type: 'BUSINESS_TRIP_PENDING', category: 'REQUEST', refType: 'business_trip', title: 'Đơn công tác mới', body: 'NV X vừa submit đơn đi công tác', idExample: '9' },
		{ label: 'HĐ sắp hết hạn', type: 'CONTRACT_EXPIRY_WARNING', category: 'EVENT', refType: 'contract', title: 'Hợp đồng sắp hết hạn', body: 'HĐ của bạn còn 15 ngày', idExample: '101' },
		{ label: 'Test generic (TEST)', type: 'TEST', category: 'EVENT', refType: '', title: 'Test FCM Push', body: 'Đây là test notification', idExample: '' },
	];

	definePageMeta({
		title: 'Test Notification Pipeline',
		middleware: [
			function () {
				const auth = useAuthStore();
				if (auth.user?.role !== 'ADMIN') return navigateTo('/');
			},
		],
	});

	const toast = useToast();
	const notificationService = useNotificationService();

	// ─── Unified Test ─────────────────────────────────────────────────────────────

	const unifiedSchema = toTypedSchema(
		z
			.object({
				employeeId: z.coerce.number({ invalid_type_error: 'Nhập ID nhân viên' }).int().positive('ID phải là số dương'),
				title: z.string().min(1, 'Tiêu đề không được trống'),
				body: z.string().min(1, 'Nội dung không được trống'),
				platforms: z.array(z.enum(['in-app', 'email', 'fcm'])).min(1, 'Chọn ít nhất 1 platform'),
				emailTo: z.string().optional(),
			})
			.superRefine((data, ctx) => {
				if (data.platforms.includes('email') && !data.emailTo) {
					ctx.addIssue({ code: 'custom', path: ['emailTo'], message: 'emailTo bắt buộc khi chọn platform email' });
				}
				if (data.emailTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailTo)) {
					ctx.addIssue({ code: 'custom', path: ['emailTo'], message: 'Email không hợp lệ' });
				}
			}),
	);

	const {
		handleSubmit: handleUnified,
		defineField: defineUnified,
		errors: unifiedErrors,
		isSubmitting: unifiedSubmitting,
		setFieldValue: setUnifiedField,
		values: unifiedValues,
	} = useForm({
		validationSchema: unifiedSchema,
		initialValues: {
			employeeId: undefined as unknown as number,
			title: '',
			body: '',
			platforms: [] as NotificationPlatform[],
			emailTo: '',
		},
	});

	const [unifiedEmployeeId, unifiedEmployeeIdAttrs] = defineUnified('employeeId');
	const [unifiedTitle, unifiedTitleAttrs] = defineUnified('title');
	const [unifiedBody, unifiedBodyAttrs] = defineUnified('body');
	const [unifiedEmailTo, unifiedEmailToAttrs] = defineUnified('emailTo');

	const unifiedResult = ref<TestNotificationResult | null>(null);

	const platformOptions: { value: NotificationPlatform; label: string; note: string }[] = [
		{ value: 'in-app', label: 'In-App', note: 'Lưu DB + FCM kèm' },
		{ value: 'email', label: 'Email', note: 'Vào BullMQ queue' },
		{ value: 'fcm', label: 'FCM', note: 'Push standalone' },
	];

	function togglePlatform(platform: NotificationPlatform) {
		const current = unifiedValues.platforms ?? [];
		const updated = current.includes(platform)
			? current.filter((p) => p !== platform)
			: [...current, platform];
		setUnifiedField('platforms', updated);
	}

	const showEmailTo = computed(() => (unifiedValues.platforms ?? []).includes('email'));

	const onUnifiedSubmit = handleUnified(async (values) => {
		unifiedResult.value = null;
		try {
			const result = await notificationService.testUnified({
				employeeId: values.employeeId,
				title: values.title,
				body: values.body,
				platforms: values.platforms as NotificationPlatform[],
				emailTo: values.emailTo || undefined,
			});
			unifiedResult.value = result;
			toast.success('Đã gửi test notification');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Gửi thất bại');
		}
	});

	// ─── FCM Standalone ───────────────────────────────────────────────────────────

	const fcmSchema = toTypedSchema(
		z.object({
			employeeId: z.coerce.number({ invalid_type_error: 'Nhập ID nhân viên' }).int().positive('ID phải là số dương'),
			title: z.string().min(1, 'Tiêu đề không được trống'),
			body: z.string().min(1, 'Nội dung không được trống'),
			type: z.enum(NOTIFICATION_TYPES as [NotificationType, ...NotificationType[]], { errorMap: () => ({ message: 'Chọn type hợp lệ' }) }),
			category: z.enum(NOTIFICATION_CATEGORIES as [NotificationCategory, ...NotificationCategory[]]).optional(),
			refType: z.string().optional(),
			id: z.string().optional(),
		}),
	);

	const {
		handleSubmit: handleFcm,
		defineField: defineFcm,
		errors: fcmErrors,
		isSubmitting: fcmSubmitting,
		setFieldValue: setFcmField,
	} = useForm({
		validationSchema: fcmSchema,
		initialValues: {
			employeeId: undefined as unknown as number,
			title: '',
			body: '',
			type: 'TEST' as NotificationType,
			category: undefined as NotificationCategory | undefined,
			refType: '',
			id: '',
		},
	});

	const [fcmEmployeeId, fcmEmployeeIdAttrs] = defineFcm('employeeId');
	const [fcmTitle, fcmTitleAttrs] = defineFcm('title');
	const [fcmBody, fcmBodyAttrs] = defineFcm('body');
	const [fcmType, fcmTypeAttrs] = defineFcm('type');
	const [fcmCategory, fcmCategoryAttrs] = defineFcm('category');
	const [fcmRefType, fcmRefTypeAttrs] = defineFcm('refType');
	const [fcmId, fcmIdAttrs] = defineFcm('id');

	const selectedPreset = ref('');

	function applyPreset(label: string) {
		const preset = FCM_PRESETS.find(p => p.label === label);
		if (!preset) return;
		setFcmField('type', preset.type);
		setFcmField('category', preset.category);
		setFcmField('refType', preset.refType);
		setFcmField('id', preset.idExample);
		setFcmField('title', preset.title);
		setFcmField('body', preset.body);
	}

	const fcmResult = ref<FcmTestResult | null>(null);

	const onFcmSubmit = handleFcm(async (values) => {
		fcmResult.value = null;
		try {
			const result = await notificationService.testFcm({
				employeeId: values.employeeId,
				title: values.title,
				body: values.body,
				type: values.type,
				category: values.category || undefined,
				refType: values.refType || undefined,
				id: values.id || undefined,
			});
			fcmResult.value = result;
			toast.success('FCM test đã gửi');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Gửi FCM thất bại');
		}
	});

	// ─── Email Standalone ─────────────────────────────────────────────────────────

	const emailSchema = toTypedSchema(
		z.object({
			emailTo: z.string().min(1, 'Email không được trống').email('Email không hợp lệ'),
		}),
	);

	const {
		handleSubmit: handleEmail,
		defineField: defineEmail,
		errors: emailErrors,
		isSubmitting: emailSubmitting,
	} = useForm({
		validationSchema: emailSchema,
		initialValues: { emailTo: '' },
	});

	const [emailTo, emailToAttrs] = defineEmail('emailTo');

	const emailResult = ref<string | null>(null);

	const onEmailSubmit = handleEmail(async (values) => {
		emailResult.value = null;
		try {
			const result = await notificationService.testEmail(values.emailTo);
			emailResult.value = result.message;
			toast.success('Email test đã vào queue');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Gửi email thất bại');
		}
	});
</script>

<template>
	<div class="max-w-4xl mx-auto py-8 px-4 space-y-8">
		<!-- Header -->
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Test Notification Pipeline</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Dành riêng cho ADMIN — kiểm tra từng lớp notification.</p>
		</div>

		<!-- ─── Section 1: Unified Test ─────────────────────────────────────────── -->
		<div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded">POST</span>
				<code class="text-sm text-gray-700 dark:text-gray-300">/v1/notifications/test</code>
				<span class="text-sm text-gray-500 dark:text-gray-400">— Gửi tới nhiều platform cùng lúc</span>
			</div>

			<form class="space-y-4" @submit.prevent="onUnifiedSubmit">
				<!-- Employee ID + Title -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee ID <span class="text-red-500">*</span></label>
						<input
							v-model="unifiedEmployeeId"
							v-bind="unifiedEmployeeIdAttrs"
							type="number"
							min="1"
							placeholder="1"
							class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						<p v-if="unifiedErrors.employeeId" class="mt-1 text-xs text-red-500">{{ unifiedErrors.employeeId }}</p>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title <span class="text-red-500">*</span></label>
						<input
							v-model="unifiedTitle"
							v-bind="unifiedTitleAttrs"
							type="text"
							placeholder="Test Notification"
							class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						<p v-if="unifiedErrors.title" class="mt-1 text-xs text-red-500">{{ unifiedErrors.title }}</p>
					</div>
				</div>

				<!-- Body -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body <span class="text-red-500">*</span></label>
					<textarea
						v-model="unifiedBody"
						v-bind="unifiedBodyAttrs"
						rows="3"
						placeholder="Nội dung thông báo test..."
						class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
					/>
					<p v-if="unifiedErrors.body" class="mt-1 text-xs text-red-500">{{ unifiedErrors.body }}</p>
				</div>

				<!-- Platforms -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Platforms <span class="text-red-500">*</span></label>
					<div class="flex flex-wrap gap-3">
						<button
							v-for="opt in platformOptions"
							:key="opt.value"
							type="button"
							:class="[
								'flex flex-col items-start px-4 py-2.5 rounded-lg border-2 text-left transition-colors',
								(unifiedValues.platforms ?? []).includes(opt.value)
									? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
									: 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500',
							]"
							@click="togglePlatform(opt.value)"
						>
							<span class="text-sm font-semibold">{{ opt.label }}</span>
							<span class="text-xs opacity-60">{{ opt.note }}</span>
						</button>
					</div>
					<p v-if="unifiedErrors.platforms" class="mt-1 text-xs text-red-500">{{ unifiedErrors.platforms }}</p>
				</div>

				<!-- Email To (conditional) -->
				<div v-if="showEmailTo">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email To <span class="text-red-500">*</span></label>
					<input
						v-model="unifiedEmailTo"
						v-bind="unifiedEmailToAttrs"
						type="email"
						placeholder="recipient@company.com"
						class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<p v-if="unifiedErrors.emailTo" class="mt-1 text-xs text-red-500">{{ unifiedErrors.emailTo }}</p>
				</div>

				<button
					type="submit"
					:disabled="unifiedSubmitting"
					class="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
				>
					{{ unifiedSubmitting ? 'Đang gửi...' : 'Gửi Test' }}
				</button>
			</form>

			<!-- Result -->
			<div v-if="unifiedResult" class="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
				<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Kết quả</p>
				<div class="space-y-2">
					<div
						v-for="(result, platform) in unifiedResult.platforms"
						:key="platform"
						:class="[
							'flex flex-col gap-1 p-3 rounded-lg border',
							result.sent
								? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
								: 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800',
						]"
					>
						<div class="flex items-center gap-2">
							<span :class="['text-base', result.sent ? 'text-green-600' : 'text-red-500']">
								{{ result.sent ? '✅' : '❌' }}
							</span>
							<span class="text-sm font-semibold text-gray-800 dark:text-gray-200 font-mono">{{ platform }}</span>
							<span :class="['text-xs font-medium', result.sent ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400']">
								{{ result.sent ? 'sent' : 'failed' }}
							</span>
						</div>
						<div v-if="result.error" class="text-xs text-red-600 dark:text-red-400 pl-6">{{ result.error }}</div>
						<div v-if="result.detail" class="pl-6 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
							<p>Gửi thành công: <span class="font-medium">{{ result.detail.sent }}</span> device</p>
							<p>Token stale đã xóa: <span class="font-medium">{{ result.detail.invalidRemoved }}</span></p>
							<p v-if="result.detail.tokens.length">Tokens: <span class="font-mono break-all">{{ result.detail.tokens.join(', ') }}</span></p>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- ─── Section 2: FCM Standalone ──────────────────────────────────────────── -->
		<div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded">POST</span>
				<code class="text-sm text-gray-700 dark:text-gray-300">/v1/notifications/test-fcm</code>
				<span class="text-sm text-gray-500 dark:text-gray-400">— FCM standalone (không lưu DB)</span>
			</div>

			<form class="space-y-4" @submit.prevent="onFcmSubmit">
				<!-- Preset auto-fill -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quick preset <span class="text-xs text-gray-400 font-normal">(auto-fill các field bên dưới)</span></label>
					<select
						v-model="selectedPreset"
						class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
						@change="applyPreset(selectedPreset)"
					>
						<option value="">— Chọn preset hoặc nhập tay —</option>
						<option v-for="p in FCM_PRESETS" :key="p.label" :value="p.label">{{ p.label }}</option>
					</select>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee ID <span class="text-red-500">*</span></label>
						<input
							v-model="fcmEmployeeId"
							v-bind="fcmEmployeeIdAttrs"
							type="number"
							min="1"
							placeholder="1"
							class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
						/>
						<p v-if="fcmErrors.employeeId" class="mt-1 text-xs text-red-500">{{ fcmErrors.employeeId }}</p>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type <span class="text-red-500">*</span></label>
						<select
							v-model="fcmType"
							v-bind="fcmTypeAttrs"
							class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
						>
							<option v-for="t in NOTIFICATION_TYPES" :key="t" :value="t">{{ t }}</option>
						</select>
						<p v-if="fcmErrors.type" class="mt-1 text-xs text-red-500">{{ fcmErrors.type }}</p>
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title <span class="text-red-500">*</span></label>
					<input
						v-model="fcmTitle"
						v-bind="fcmTitleAttrs"
						type="text"
						placeholder="Test FCM Push"
						class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
					/>
					<p v-if="fcmErrors.title" class="mt-1 text-xs text-red-500">{{ fcmErrors.title }}</p>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body <span class="text-red-500">*</span></label>
					<textarea
						v-model="fcmBody"
						v-bind="fcmBodyAttrs"
						rows="2"
						placeholder="Nội dung push notification..."
						class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
					/>
					<p v-if="fcmErrors.body" class="mt-1 text-xs text-red-500">{{ fcmErrors.body }}</p>
				</div>

				<!-- Navigation payload (optional) -->
				<div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 p-4 space-y-3">
					<div class="flex items-baseline justify-between">
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Navigation payload <span class="text-xs font-normal text-gray-500">(optional)</span></h3>
						<span class="text-xs text-gray-400">Mobile/web dùng để route khi user tap notification</span>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<div>
							<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
							<select
								v-model="fcmCategory"
								v-bind="fcmCategoryAttrs"
								class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
							>
								<option :value="undefined">—</option>
								<option v-for="c in NOTIFICATION_CATEGORIES" :key="c" :value="c">{{ c }}</option>
							</select>
						</div>
						<div>
							<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">refType</label>
							<input
								v-model="fcmRefType"
								v-bind="fcmRefTypeAttrs"
								type="text"
								placeholder="leave_request"
								class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
							/>
						</div>
						<div>
							<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">id</label>
							<input
								v-model="fcmId"
								v-bind="fcmIdAttrs"
								type="text"
								placeholder="123"
								class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
							/>
						</div>
					</div>
				</div>

				<button
					type="submit"
					:disabled="fcmSubmitting"
					class="px-5 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
				>
					{{ fcmSubmitting ? 'Đang gửi...' : 'Gửi FCM' }}
				</button>
			</form>

			<div v-if="fcmResult" class="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
				<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Kết quả FCM</p>
				<div class="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 space-y-1">
					<p>Gửi thành công: <span class="font-semibold">{{ fcmResult.sent }}</span> device</p>
					<p>Token stale đã xóa: <span class="font-semibold">{{ fcmResult.invalidRemoved }}</span></p>
					<p v-if="fcmResult.tokens.length">
						Tokens: <span class="font-mono text-xs break-all">{{ fcmResult.tokens.join(', ') }}</span>
					</p>
					<p v-else class="text-xs text-gray-400">Không có device token nào nhận được.</p>
				</div>
			</div>
		</div>

		<!-- ─── Section 3: Email Standalone ────────────────────────────────────────── -->
		<div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded">GET</span>
				<code class="text-sm text-gray-700 dark:text-gray-300">/v1/notifications/test-email</code>
				<span class="text-sm text-gray-500 dark:text-gray-400">— Email template cố định vào queue</span>
			</div>

			<form class="space-y-4" @submit.prevent="onEmailSubmit">
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email To <span class="text-red-500">*</span></label>
					<input
						v-model="emailTo"
						v-bind="emailToAttrs"
						type="email"
						placeholder="dev@company.com"
						class="w-full sm:w-80 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
					<p v-if="emailErrors.emailTo" class="mt-1 text-xs text-red-500">{{ emailErrors.emailTo }}</p>
					<p class="mt-1 text-xs text-gray-400">Template cố định: subject "[Test] HR System email test", không custom được title/body.</p>
				</div>
				<button
					type="submit"
					:disabled="emailSubmitting"
					class="px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
				>
					{{ emailSubmitting ? 'Đang gửi...' : 'Gửi Email Test' }}
				</button>
			</form>

			<div v-if="emailResult" class="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
				<div class="flex items-center gap-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
					<span class="text-green-600">✅</span>
					<p class="text-sm text-gray-700 dark:text-gray-300">{{ emailResult }}</p>
				</div>
			</div>
		</div>
	</div>
</template>
