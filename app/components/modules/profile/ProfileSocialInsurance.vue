<script setup lang="ts">
	import { formatDate } from '~/utils/date';

	const { record, unlocking, viewOwn } = useSocialInsurance();

	/** Đã mở khoá trong phiên xem này chưa. Cố ý chỉ sống trong state component: rời trang
	 *  hoặc F5 là mất, lần sau phải nhập mật khẩu lại. */
	const unlocked = ref(false);
	const showModal = ref(false);
	const password = ref('');
	const modalError = ref<string | null>(null);
	/** Lỗi hiện ở chỗ card (tài khoản bị khoá, quá nhiều request) — modal đã đóng. */
	const cardError = ref<string | null>(null);

	const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

	const dependents = computed(() => record.value?.taxInfo.dependentDetails ?? []);

	function openModal(): void {
		password.value = '';
		modalError.value = null;
		cardError.value = null;
		showModal.value = true;
	}

	function closeModal(): void {
		showModal.value = false;
		password.value = '';
		modalError.value = null;
	}

	async function submitPassword(): Promise<void> {
		const pw = password.value;
		if (!pw) {
			modalError.value = 'Vui lòng nhập mật khẩu';
			return;
		}
		modalError.value = null;

		try {
			await viewOwn(pw);
			unlocked.value = true;
			closeModal();
		} catch (e) {
			const err = e as Error & { status?: number; data?: { error?: { code?: string } } };
			const status = err.status;
			const message = err.message || 'Không xem được thông tin BHXH';

			if (status === 403) {
				// Khoá tài khoản: không cho thử tiếp, đóng modal và nói rõ ở card.
				closeModal();
				cardError.value = message;
			} else if (status === 429) {
				closeModal();
				cardError.value = message || 'Bạn thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.';
			} else {
				// 400 / 401 → giữ modal, cho nhập lại. Message của API có kèm số lần thử còn lại.
				modalError.value = message;
			}
		} finally {
			// Không giữ mật khẩu sống lâu hơn request.
			password.value = '';
		}
	}

	function money(v: number | null | undefined): string {
		if (v == null) return '—';
		return currencyFormatter.format(v);
	}

	function text(v: string | null | undefined): string {
		return v && v.trim() ? v : '—';
	}

	function day(v: string | null | undefined): string {
		return v ? formatDate(v) : '—';
	}

	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white break-words';
	const linkCls = 'text-sm text-brand-600 dark:text-brand-400 hover:underline break-all';
</script>

<template>
	<!--
		Card CHỈ ĐỌC, có cửa mật khẩu.

		Mặc định KHÔNG gọi API: dữ liệu BHXH & thuế là nhạy cảm nên phải xác thực lại mật
		khẩu mỗi lần xem (POST /v1/social-insurance/me). Kết quả cố ý không cache ra ngoài
		state của component — F5 là phải nhập lại, đó là điểm của cửa mật khẩu.

		`record.note` CỐ Ý không hiển thị: ghi chú nội bộ của HR về nhân viên. BE cũng đã
		trả null cho chính nhân viên, hai lớp bù nhau.
	-->
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
		<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-5">BHXH &amp; Thuế TNCN</h3>

		<!-- ── Chưa mở khoá ── -->
		<template v-if="!unlocked">
			<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
				Thông tin BHXH &amp; thuế là dữ liệu nhạy cảm. Nhập lại mật khẩu để xem.
			</p>
			<p v-if="cardError" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ cardError }}</p>
			<CommonAppButton type="button" variant="primary" @click="openModal">
				Xem thông tin BHXH &amp; Thuế
			</CommonAppButton>
		</template>

		<!-- ── Đã mở khoá, chưa có dữ liệu ── -->
		<p v-else-if="!record" class="text-sm text-gray-500 dark:text-gray-400">
			Chưa có thông tin BHXH. Liên hệ bộ phận nhân sự nếu bạn cho rằng đây là thiếu sót.
		</p>

		<!-- ── Đã mở khoá, có dữ liệu ── -->
		<template v-else>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
				<div>
					<p :class="labelCls">Mã số BHXH</p>
					<p :class="valueCls">{{ text(record.socialInsuranceNumber) }}</p>
				</div>
				<div>
					<p :class="labelCls">Mức lương tham gia BHXH</p>
					<p :class="valueCls">{{ money(record.insuranceSalary) }}</p>
				</div>
				<div>
					<p :class="labelCls">Có sổ BHXH</p>
					<p :class="valueCls">{{ record.hasSocialInsuranceBook ? 'Có' : 'Không' }}</p>
				</div>
				<div>
					<p :class="labelCls">Ngày tham gia BHXH</p>
					<p :class="valueCls">{{ day(record.effectiveDate) }}</p>
				</div>
				<div>
					<p :class="labelCls">Số thẻ BHYT</p>
					<p :class="valueCls">{{ text(record.healthInsuranceNumber) }}</p>
				</div>
				<div>
					<p :class="labelCls">Ngày hết hạn BHYT</p>
					<p :class="valueCls">{{ day(record.healthInsuranceExpiry) }}</p>
				</div>
				<div>
					<p :class="labelCls">Cơ sở KCB ban đầu</p>
					<p :class="valueCls">{{ text(record.registeredHospital) }}</p>
				</div>
				<div>
					<p :class="labelCls">Mã số thuế TNCN</p>
					<p :class="valueCls">{{ text(record.taxInfo.taxCode) }}</p>
				</div>
				<div>
					<p :class="labelCls">Số người phụ thuộc</p>
					<p :class="valueCls">{{ record.taxInfo.dependents }}</p>
				</div>
				<div>
					<p :class="labelCls">Scan BHYT / sổ BHXH</p>
					<a v-if="record.siDocUrl" :href="record.siDocUrl" target="_blank" rel="noopener noreferrer" :class="linkCls">
						Xem scan BHYT/sổ BHXH
					</a>
					<p v-else :class="valueCls">—</p>
				</div>
				<div>
					<p :class="labelCls">Chứng từ miễn giảm thuế</p>
					<a
						v-if="record.taxInfo.taxExemptionDocUrl"
						:href="record.taxInfo.taxExemptionDocUrl"
						target="_blank"
						rel="noopener noreferrer"
						:class="linkCls"
					>
						Xem chứng từ miễn giảm
					</a>
					<p v-else :class="valueCls">—</p>
				</div>
			</div>

			<div class="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5">
				<p :class="labelCls">Chi tiết người phụ thuộc</p>

				<p v-if="!dependents.length" :class="[valueCls, 'mt-1']">—</p>

				<ul v-else class="mt-2 space-y-2">
					<li
						v-for="(dep, idx) in dependents"
						:key="idx"
						class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-900 dark:text-white"
					>
						<span class="font-medium">{{ text(dep.name) }}</span>
						<span class="text-gray-300 dark:text-gray-600">·</span>
						<span class="text-gray-600 dark:text-gray-300">{{ text(dep.relationship) }}</span>
						<span class="text-gray-300 dark:text-gray-600">·</span>
						<span class="text-gray-500 dark:text-gray-400">từ {{ day(dep.effectiveDate) }}</span>
					</li>
				</ul>
			</div>
		</template>
	</div>

	<!-- ── Modal nhập mật khẩu ── -->
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="showModal"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="closeModal"
			>
				<div class="w-full max-w-sm rounded-xl bg-white dark:bg-gray-900 shadow-xl p-6">
					<h4 class="text-base font-semibold text-gray-900 dark:text-white">Xác nhận mật khẩu</h4>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Nhập mật khẩu đăng nhập của bạn để xem thông tin BHXH &amp; thuế.
					</p>

					<form class="mt-4 space-y-3" @submit.prevent="submitPassword">
						<div>
							<label for="si-password" :class="labelCls">Mật khẩu</label>
							<input
								id="si-password"
								v-model="password"
								type="password"
								autocomplete="current-password"
								:disabled="unlocking"
								class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
								placeholder="Mật khẩu đăng nhập"
							/>
							<p v-if="modalError" class="mt-1.5 text-xs text-red-500">{{ modalError }}</p>
						</div>

						<div class="flex justify-end gap-2 pt-1">
							<CommonAppButton type="button" variant="secondary" :disabled="unlocking" @click="closeModal">
								Hủy
							</CommonAppButton>
							<CommonAppButton type="submit" variant="primary" :loading="unlocking">
								Xác nhận
							</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
