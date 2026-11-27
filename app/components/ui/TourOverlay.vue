<script setup lang="ts">
	/**
	 * Lớp phủ và hộp của hướng dẫn từng bước. Gắn một lần ở layout; trang nào có tour thì đăng ký
	 * qua `usePageTour`, phần chạy nằm ở `useTourDriver`.
	 *
	 * Lớp phủ ở z-[9000]: trên đầu trang, thanh bên, nút trợ lý và mọi hộp thoại (z-50, z-[60]),
	 * dưới thông báo nhỏ góc màn (z-[9999]) để thông báo vẫn đọc được khi đang xem hướng dẫn.
	 */
	import { tourTextParts } from '~/utils/tour';
	const {
		state,
		counter,
		step,
		mode,
		shown,
		isPhone,
		isLast,
		canBack,
		waitingLong,
		boxRef,
		primaryRef,
		boxStyle,
		sheetAtTop,
		dimPath,
		hole,
		holeStyle,
		blockers,
		onPrimary,
		onBack,
		onSkip,
	} = useTourDriver();

	// Tên nút, tên khối trong chữ của bước viết `**Tên nút**` thì hiện in đậm.
	const bodyParts = computed(() => tourTextParts(step.value?.body ?? ''));
	const actionParts = computed(() => tourTextParts(step.value?.action ?? ''));

	const primaryLabel = computed(() => {
		if (mode.value === 'click') return 'Bấm giúp tôi';
		return isLast.value ? 'Xong' : 'Tiếp';
	});

	const boxClass = computed(() => {
		if (!isPhone.value) return 'w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl';
		return sheetAtTop.value
			? 'inset-x-0 top-0 rounded-b-2xl pt-[env(safe-area-inset-top)]'
			: 'inset-x-0 bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]';
	});

	const btnBase =
		'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 dark:focus-visible:ring-offset-gray-900';
</script>

<template>
	<Teleport to="body">
		<div v-if="state && step" class="pointer-events-none fixed inset-0 z-[9000]" data-tour-overlay>
			<svg class="absolute inset-0 h-full w-full" aria-hidden="true">
				<path :d="dimPath" fill-rule="evenodd" class="fill-gray-950/60 dark:fill-black/70" />
			</svg>

			<template v-if="hole">
				<div v-for="(style, i) in blockers" :key="i" class="pointer-events-auto absolute" :style="style" />
				<!-- Bước chỉ xem: che luôn ô sáng để không bấm nhầm Xuất Excel, In tem… -->
				<div v-if="mode === 'info'" class="pointer-events-auto absolute" :style="holeStyle" />
				<div
					class="absolute rounded-xl ring-2 ring-brand-400 dark:ring-brand-300"
					:class="mode === 'click' ? 'motion-safe:animate-pulse' : ''"
					:style="holeStyle"
				/>
			</template>
			<div v-else class="pointer-events-auto absolute inset-0" />

			<p class="sr-only" aria-live="polite">
				<template v-if="shown">Bước {{ counter.number }}<template v-if="counter.total"> trên {{ counter.total }}</template>. {{ step.title }}</template>
			</p>

			<div
				ref="boxRef"
				role="dialog"
				aria-modal="true"
				aria-labelledby="tour-box-title"
				aria-describedby="tour-box-body"
				class="pointer-events-auto fixed bg-white shadow-2xl ring-1 ring-gray-900/10 motion-safe:transition-[top,left] motion-safe:duration-200 dark:bg-gray-900 dark:ring-white/10"
				:class="boxClass"
				:style="boxStyle"
			>
				<div class="space-y-2 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
					<p class="text-xs font-medium text-brand-600 dark:text-brand-400">
						<template v-if="shown">Bước {{ counter.number }}<template v-if="counter.total">/{{ counter.total }}</template></template>
						<template v-else>&nbsp;</template>
					</p>
					<h2 id="tour-box-title" class="text-base font-semibold text-gray-900 dark:text-white">{{ step.title }}</h2>
					<p id="tour-box-body" class="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
						<template v-if="shown || !waitingLong">
							<template v-for="(part, i) in bodyParts" :key="i">
								<strong v-if="part.strong" class="font-semibold text-gray-900 dark:text-white">{{ part.text }}</strong>
								<template v-else>{{ part.text }}</template>
							</template>
						</template>
						<template v-else>Phần này đang hiện ra, bạn chờ một chút.</template>
					</p>
					<p
						v-if="shown && mode === 'click' && step.action"
						class="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200"
					>
						<svg class="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
							/>
						</svg>
						<span>
							<template v-for="(part, i) in actionParts" :key="i">
								<strong v-if="part.strong" class="font-bold">{{ part.text }}</strong>
								<template v-else>{{ part.text }}</template>
							</template>
						</span>
					</p>
				</div>

				<div class="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 sm:px-5 dark:border-gray-800">
					<button
						type="button"
						:class="btnBase"
						class="-ml-2 px-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
						@click="onSkip"
					>
						Bỏ qua
					</button>
					<div class="flex items-center gap-2">
						<button
							v-if="canBack"
							type="button"
							:class="btnBase"
							class="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
							@click="onBack"
						>
							Quay lại
						</button>
						<button
							ref="primaryRef"
							type="button"
							:class="btnBase"
							class="bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
							:disabled="!shown && !waitingLong"
							@click="onPrimary"
						>
							{{ primaryLabel }}
						</button>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
