<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import {
		isAllowedSmtpPort,
		recruitErrorMessage,
		smtpTargetChanged,
		SMTP_ALLOWED_PORTS,
	} from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	import {
		SMTP_SECURITY_LABELS,
		type RecruitmentSmtp,
		type RecruitmentSmtpSecurity,
	} from '~/types/recruitment.types';

	/**
	 * Máy chủ thư riêng của công ty, để email gửi ứng viên đi từ hộp thư của công ty.
	 *
	 * Ba điều quyết định cách màn hình này hoạt động:
	 * - **Chỉ vai trò ADMIN gọi được**, kể cả người có quyền phụ trách tuyển dụng; nên tab
	 *   này chỉ hiện cho quản trị viên.
	 * - **Response không bao giờ trả mật khẩu**, chỉ có cờ đã lưu hay chưa; ô mật khẩu để
	 *   trống nghĩa là giữ mật khẩu cũ.
	 * - **Lưu cấu hình đưa trạng thái về chưa thử**, và email chỉ đi qua máy chủ của công ty
	 *   sau khi gửi thử thành công. Gửi thử thất bại KHÔNG phải lỗi HTTP: kết quả nằm trong
	 *   `testStatus`, nên phải đọc cờ đó chứ không bắt lỗi.
	 *
	 * Máy chủ thư chạy chung tiến trình với mọi công ty, nên backend chỉ cho nối tới Internet
	 * qua bốn cổng quen thuộc, và bắt nhập lại mật khẩu mỗi khi đổi chỗ sẽ gửi tới. Form chặn
	 * trước hai điều đó để người dùng không phải đi một vòng tới backend mới biết mình sai.
	 */
	const props = defineProps<{ canManage: boolean }>();

	const toast = useToast();
	const service = useRecruitmentService();

	const smtp = ref<RecruitmentSmtp | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const saving = ref(false);
	const testing = ref(false);
	const removing = ref(false);
	const error = ref<string | null>(null);

	const host = ref('');
	const port = ref<number>(587);
	const security = ref<RecruitmentSmtpSecurity>('STARTTLS');
	const username = ref('');
	const password = ref('');
	const fromName = ref('');
	const fromEmail = ref('');
	const replyTo = ref('');
	const testTo = ref('');

	function fill(data: RecruitmentSmtp) {
		smtp.value = data;
		host.value = data.host ?? '';
		port.value = data.port ?? 587;
		security.value = data.security ?? 'STARTTLS';
		username.value = data.username ?? '';
		password.value = '';
		fromName.value = data.fromName ?? '';
		fromEmail.value = data.fromEmail ?? '';
		replyTo.value = data.replyTo ?? '';
	}

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			fill(await service.smtp());
		} catch (e) {
			// Vai trò khác ADMIN nhận 403 ở đây — nói rõ chứ không để trang trống.
			loadError.value = recruitErrorMessage(e, 'Không đọc được cấu hình máy chủ thư');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	const securityOptions = Object.entries(SMTP_SECURITY_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	/**
	 * Cấu hình cũ có thể đang giữ một cổng giờ không còn được phép. Ẩn nó khỏi danh sách thì ô
	 * chọn hiện trống và người dùng tưởng cấu hình bị mất, nên vẫn cho hiện kèm chữ giải thích
	 * và chặn ở bước lưu.
	 */
	const portOptions = computed(() => {
		const allowed = SMTP_ALLOWED_PORTS.map(p => ({ value: p as number, label: String(p) }));
		const saved = smtp.value?.port;
		if (saved && !isAllowedSmtpPort(saved)) {
			return [{ value: saved, label: `${saved} — không còn được phép, hãy chọn lại` }, ...allowed];
		}
		return allowed;
	});

	const portNotAllowed = computed(() => !isAllowedSmtpPort(Number(port.value)));

	/**
	 * Mật khẩu bắt buộc khi chưa lưu mật khẩu nào, hoặc khi người dùng vừa đổi chỗ sẽ gửi tới.
	 * Cùng một luật với backend, chỉ kiểm sớm hơn một nhịp.
	 */
	const passwordRequired = computed(() => {
		if (!smtp.value?.hasPassword) return true;
		return smtpTargetChanged(smtp.value, {
			host: host.value,
			port: Number(port.value),
			security: security.value,
			username: username.value,
		});
	});

	const keyMissing = computed(() => !!smtp.value && !smtp.value.secretKeyConfigured);

	const testTone = computed(() => {
		switch (smtp.value?.testStatus) {
			case 'SUCCESS':
				return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
			case 'FAILED':
				return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
			default:
				return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
		}
	});

	async function save() {
		if (!host.value.trim() || !username.value.trim() || !fromName.value.trim() || !fromEmail.value.trim()) {
			error.value = 'Nhập đủ máy chủ, tài khoản, tên người gửi và email người gửi';
			return;
		}
		if (portNotAllowed.value) {
			error.value = `Cổng chỉ nhận ${SMTP_ALLOWED_PORTS.join(', ')}. Hãy chọn lại một trong các cổng đó.`;
			return;
		}
		if (passwordRequired.value && !password.value) {
			error.value = smtp.value?.hasPassword
				? 'Bạn vừa đổi máy chủ, cổng, kiểu bảo mật hoặc tài khoản, nên phải nhập lại mật khẩu.'
				: 'Lần đầu cấu hình phải nhập mật khẩu';
			return;
		}
		saving.value = true;
		error.value = null;
		try {
			fill(
				await service.saveSmtp({
					host: host.value.trim(),
					port: Number(port.value),
					security: security.value,
					username: username.value.trim(),
					password: password.value || undefined,
					fromName: fromName.value.trim(),
					fromEmail: fromEmail.value.trim(),
					replyTo: replyTo.value.trim() || undefined,
				}),
			);
			toast.success('Đã lưu cấu hình. Hãy gửi thử để email ứng viên đi qua máy chủ này.');
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Lưu cấu hình thất bại');
		} finally {
			saving.value = false;
		}
	}

	async function sendTest() {
		if (!testTo.value.trim()) {
			error.value = 'Nhập email nhận thư thử';
			return;
		}
		testing.value = true;
		error.value = null;
		try {
			const result = await service.testSmtp(testTo.value.trim());
			fill(result);
			// Gửi thử hỏng vẫn trả 201, nên kết quả đọc từ `testStatus` chứ không từ ngoại lệ.
			if (result.testStatus === 'SUCCESS') {
				toast.success('Gửi thử thành công, email ứng viên sẽ đi qua máy chủ của công ty');
			} else {
				toast.error(result.testError || 'Gửi thử thất bại');
			}
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không gửi thử được');
		} finally {
			testing.value = false;
		}
	}

	async function removeConfig() {
		removing.value = true;
		error.value = null;
		try {
			await service.deleteSmtp();
			toast.success('Đã xoá cấu hình, email quay về kênh hệ thống');
			await load();
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Xoá cấu hình thất bại');
		} finally {
			removing.value = false;
		}
	}
</script>

<template>
	<div class="space-y-4">
		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<p
			v-else-if="loadError"
			class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
		>
			{{ loadError }}
		</p>

		<template v-else-if="smtp">
			<p
				v-if="keyMissing"
				class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
			>
				Máy chủ chưa cấu hình khoá mã hoá nên chưa lưu được mật khẩu. Hãy báo quản trị hệ thống. Trong
				lúc đó email ứng viên vẫn đi bằng kênh của hệ thống.
			</p>

			<div class="flex flex-wrap items-center gap-2">
				<RecruitChip
					v-if="smtp.configured"
					:label="smtp.testStatusLabel ?? 'Chưa gửi thử'"
					:tone="testTone"
				/>
				<RecruitChip
					v-else
					label="Chưa cấu hình"
					tone="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
				/>
				<p v-if="smtp.testedAt" class="text-xs text-gray-500 dark:text-gray-400">
					Gửi thử lần cuối {{ formatDateTime(smtp.testedAt) }}
				</p>
			</div>

			<p v-if="smtp.testError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
				Lỗi lần gửi thử gần nhất: {{ smtp.testError }}
			</p>

			<p class="text-sm text-gray-600 dark:text-gray-300">
				Email gửi ứng viên chỉ đi qua máy chủ này sau khi gửi thử thành công. Mỗi lần lưu lại cấu hình
				đều đưa trạng thái về chưa thử, nên nhớ gửi thử lại sau khi sửa.
			</p>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Máy chủ <span class="text-red-500">*</span>
					</label>
					<input
						v-model="host"
						type="text"
						:disabled="!canManage || keyMissing"
						placeholder="smtp.gmail.com"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Máy chủ SMTP trên Internet, ví dụ smtp.gmail.com
					</p>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Cổng <span class="text-red-500">*</span>
					</label>
					<UiSelect
						v-model="port"
						:options="portOptions"
						:disabled="!canManage || keyMissing"
						:error="portNotAllowed ? 'Hãy chọn một cổng được phép' : undefined"
					/>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Bảo mật</label>
					<UiSelect v-model="security" :options="securityOptions" :disabled="!canManage || keyMissing" />
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Tài khoản <span class="text-red-500">*</span>
					</label>
					<input
						v-model="username"
						type="text"
						:disabled="!canManage || keyMissing"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Mật khẩu
						<span v-if="passwordRequired" class="text-red-500">*</span>
					</label>
					<input
						v-model="password"
						type="password"
						autocomplete="new-password"
						:disabled="!canManage || keyMissing"
						:placeholder="passwordRequired ? '' : 'Để trống nếu giữ mật khẩu cũ'"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<p
						v-if="smtp.hasPassword && passwordRequired"
						class="text-xs text-amber-700 dark:text-amber-400"
					>
						Bạn vừa đổi máy chủ, cổng, kiểu bảo mật hoặc tài khoản, nên phải nhập lại mật khẩu để mật
						khẩu cũ không bị gửi sang một máy chủ khác.
					</p>
					<p v-else class="text-xs text-gray-500 dark:text-gray-400">
						Hệ thống không bao giờ hiện lại mật khẩu đã lưu.
					</p>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Tên người gửi <span class="text-red-500">*</span>
					</label>
					<input
						v-model="fromName"
						type="text"
						:disabled="!canManage || keyMissing"
						placeholder="Phòng Nhân sự"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Email người gửi <span class="text-red-500">*</span>
					</label>
					<input
						v-model="fromEmail"
						type="email"
						:disabled="!canManage || keyMissing"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email trả lời</label>
					<input
						v-model="replyTo"
						type="email"
						:disabled="!canManage || keyMissing"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400">Bỏ trống thì xoá địa chỉ đang lưu.</p>
				</div>
			</div>

			<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
				{{ error }}
			</p>

			<div v-if="canManage" class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex flex-wrap items-center gap-2">
					<input
						v-model="testTo"
						type="email"
						placeholder="Email nhận thư thử"
						class="w-56 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<CommonAppButton
						variant="outline"
						:loading="testing"
						:disabled="!smtp.configured || keyMissing"
						@click="sendTest"
					>
						Gửi thử
					</CommonAppButton>
					<p v-if="!smtp.configured" class="text-xs text-gray-500 dark:text-gray-400">
						Lưu cấu hình trước rồi mới gửi thử được.
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<CommonAppButton
						v-if="smtp.configured"
						variant="danger_outline"
						:loading="removing"
						@click="removeConfig"
					>
						Xoá cấu hình
					</CommonAppButton>
					<CommonAppButton variant="primary" :loading="saving" :disabled="keyMissing" @click="save">
						Lưu cấu hình
					</CommonAppButton>
				</div>
			</div>
		</template>
	</div>
</template>
