/**
 * Chuẩn bị ảnh trước khi gửi lên: thu nhỏ ảnh lớn bằng canvas, không dùng thư viện ngoài.
 *
 * Ảnh chụp bằng điện thoại thật thường nặng 3–8 MB trong khi backend nhận tối đa 5 MB mỗi ảnh,
 * nên trước đây nhân viên kho chọn ảnh xong thì ảnh bị loại lặng lẽ và báo hỏng đi mà không có
 * ảnh nào. Ở đây ảnh JPG, PNG lớn hơn khoảng 2 MB được vẽ lại với cạnh dài tối đa 2048 px và lưu
 * thành JPEG chất lượng 0,8, thường còn dưới 1 MB mà vẫn đủ rõ để xem vết nứt hay mã serial.
 *
 * HEIC thì đa số trình duyệt không đọc được, nên giữ nguyên nếu còn trong mức cho phép. Ảnh nào
 * không gửi được thì trả kèm câu giải thích để giao diện chặn nút Gửi, không bỏ ảnh âm thầm.
 */

export const COMPRESS_OVER_BYTES = 2 * 1024 * 1024;
export const MAX_EDGE_PX = 2048;
export const JPEG_QUALITY = 0.8;

export type PhotoKind = 'jpeg' | 'png' | 'heic' | 'other';

export interface PreparedPhoto {
	/** File sẽ gửi đi; `null` khi ảnh không gửi được. */
	file: File | null;
	originalSize: number;
	/** `true` khi đã thu nhỏ thành công. */
	compressed: boolean;
	/** Lý do không gửi được, viết thành câu cho người dùng đọc. */
	error: string | null;
}

/** Dung lượng kiểu Việt Nam, dấu phẩy thập phân: "6,6 MB", "820 KB". */
export function formatPhotoSize(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Nhận diện ảnh theo kiểu MIME, thiếu thì theo đuôi tên file (HEIC thường không có MIME). */
export function photoKind(file: { name: string; type: string }): PhotoKind {
	const type = file.type.toLowerCase();
	const name = file.name.toLowerCase();
	if (type === 'image/jpeg' || /\.jpe?g$/.test(name)) return 'jpeg';
	if (type === 'image/png' || name.endsWith('.png')) return 'png';
	if (type === 'image/heic' || type === 'image/heif' || /\.hei[cf]$/.test(name)) return 'heic';
	return 'other';
}

/** Kích thước mới giữ tỷ lệ, cạnh dài không quá `maxEdge`. */
export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE_PX): { width: number; height: number } {
	const longest = Math.max(width, height);
	if (longest <= maxEdge) return { width, height };
	const ratio = maxEdge / longest;
	return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function jpegName(name: string): string {
	const dot = name.lastIndexOf('.');
	return `${dot > 0 ? name.slice(0, dot) : name}.jpg`;
}

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
	if (typeof createImageBitmap === 'function') {
		return createImageBitmap(file);
	}
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		return img;
	} finally {
		URL.revokeObjectURL(url);
	}
}

async function compress(file: File): Promise<File | null> {
	const source = await decode(file);
	const { width, height } = scaledSize(source.width, source.height);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	// PNG có nền trong suốt; JPEG không có kênh trong suốt nên phủ trắng trước, kẻo thành nền đen.
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);
	ctx.drawImage(source, 0, 0, width, height);
	if ('close' in source && typeof source.close === 'function') source.close();
	const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
	if (!blob) return null;
	return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: Date.now() });
}

/**
 * Chuẩn bị một ảnh để gửi.
 *
 * @param maxBytes Trần dung lượng mỗi ảnh của backend.
 */
export async function preparePhoto(file: File, maxBytes: number): Promise<PreparedPhoto> {
	const base = { originalSize: file.size, compressed: false };
	const limit = formatPhotoSize(maxBytes);
	const kind = photoKind(file);

	if (kind === 'other') {
		return {
			...base,
			file: null,
			error: 'Tệp này không phải ảnh JPG, PNG hay HEIC nên không gửi kèm được. Bạn bỏ tệp này ra rồi gửi lại.',
		};
	}

	if (kind === 'heic') {
		if (file.size <= maxBytes) return { ...base, file, error: null };
		return {
			...base,
			file: null,
			error: `Ảnh HEIC nặng ${formatPhotoSize(file.size)}, vượt mức ${limit}, và trình duyệt chưa tự thu nhỏ được loại ảnh này. Bạn chọn ảnh khác hoặc chụp lại ở định dạng JPG.`,
		};
	}

	if (file.size <= COMPRESS_OVER_BYTES) return { ...base, file, error: null };

	try {
		const smaller = await compress(file);
		if (smaller && smaller.size < file.size) {
			if (smaller.size <= maxBytes) return { ...base, file: smaller, compressed: true, error: null };
			return {
				...base,
				file: null,
				error: `Ảnh vẫn nặng ${formatPhotoSize(smaller.size)} sau khi thu nhỏ, vượt mức ${limit}. Bạn chọn ảnh khác hoặc chụp lại gần hơn.`,
			};
		}
	} catch {
		// Không đọc được ảnh thì xét như ảnh chưa thu nhỏ ngay bên dưới.
	}

	if (file.size <= maxBytes) return { ...base, file, error: null };
	return {
		...base,
		file: null,
		error: `Ảnh nặng ${formatPhotoSize(file.size)}, vượt mức ${limit}, và chưa thu nhỏ được trên máy này. Bạn chọn ảnh khác hoặc chụp lại với độ phân giải thấp hơn.`,
	};
}
