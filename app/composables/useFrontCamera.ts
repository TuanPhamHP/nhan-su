/**
 * Camera trước cho bước chụp khuôn mặt: mở, chụp một khung hình thành JPEG, tắt.
 *
 * `status` cho giao diện biết nên hiện gì: `starting` lúc chờ trình duyệt, `ready` khi video đã
 * chạy, `denied` khi người dùng hoặc trình duyệt chặn quyền camera, `unavailable` khi máy không có
 * camera hoặc camera đang bị ứng dụng khác giữ. Rời component là camera tự tắt.
 */
export function useFrontCamera() {
	type CameraStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unavailable';

	const status = ref<CameraStatus>('idle');
	let stream: MediaStream | null = null;

	async function start(video: HTMLVideoElement): Promise<void> {
		stop();
		if (!navigator.mediaDevices?.getUserMedia) {
			status.value = 'unavailable';
			return;
		}
		status.value = 'starting';
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
				audio: false,
			});
			video.srcObject = stream;
			await video.play();
			status.value = 'ready';
		} catch (err) {
			const name = (err as DOMException | null)?.name;
			status.value = name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'denied' : 'unavailable';
			stop(false);
		}
	}

	function stop(resetStatus = true): void {
		stream?.getTracks().forEach(t => t.stop());
		stream = null;
		if (resetStatus) status.value = 'idle';
	}

	/** Khung hình hiện tại, không lật gương: máy chủ so đúng chiều thật của khuôn mặt. */
	function capture(video: HTMLVideoElement): Promise<File | null> {
		if (status.value !== 'ready' || !video.videoWidth) return Promise.resolve(null);
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext('2d')?.drawImage(video, 0, 0);
		return new Promise(resolve => {
			canvas.toBlob(
				blob => resolve(blob ? new File([blob], 'face.jpg', { type: 'image/jpeg' }) : null),
				'image/jpeg',
				0.9,
			);
		});
	}

	onUnmounted(() => stop());

	return { status, start, stop, capture };
}
