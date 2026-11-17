import type { GeneralRequestResponse } from '~/types/general-request.types';
import { useGeneralRequestService } from '~/services/general-request.service';
import { printDocumentHtml, PRINT_EXTRA_CSS, type PrintFormatting } from '~/utils/print-template';
import { printCodeHeader } from '~/utils/general-request.utils';

/**
 * In phiếu bằng một iframe sandbox, KHÔNG bằng `window.open` cộng `document.write`.
 *
 * Mẫu in là HTML do người cấu hình loại phiếu soạn, còn người bấm in là người duyệt hoặc phòng
 * nhân sự. Cửa sổ `about:blank` ghi bằng `document.write` chạy cùng origin với ứng dụng, nên một
 * thẻ `script` hay một `onerror` trong mẫu sẽ chạy bằng phiên của người in và đọc được cookie,
 * gọi được API thay họ. Iframe với `sandbox="allow-same-origin allow-modals"` không có
 * `allow-scripts` nên mã trong mẫu không chạy, mà trang cha vẫn gọi được `print()` của frame.
 *
 * `allow-same-origin` để trang cha đọc được `contentWindow`; `allow-modals` để hộp thoại in mở
 * được từ trong frame. Nội dung còn được lọc một lần nữa bằng `sanitizePrintTemplate`.
 */
function printHtmlDocument(bodyHtml: string): void {
	// Chỉ in được khi có DOM. Dùng `document` thay cho `import.meta.client` để hàm này kiểm được
	// bằng test, vì `import.meta.client` là cờ biên dịch của Nuxt, ngoài Nuxt luôn là undefined.
	if (typeof document === 'undefined') return;

	const frame = document.createElement('iframe');
	frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
	frame.setAttribute('aria-hidden', 'true');
	frame.style.position = 'fixed';
	frame.style.right = '0';
	frame.style.bottom = '0';
	frame.style.width = '0';
	frame.style.height = '0';
	frame.style.border = '0';
	frame.style.visibility = 'hidden';

	frame.srcdoc = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>In phiếu đề xuất</title><style>body{font-family:'Times New Roman',serif;margin:24px;line-height:1.6;color:#111}${PRINT_EXTRA_CSS}</style></head><body>${bodyHtml}</body></html>`;

	frame.onload = () => {
		const win = frame.contentWindow;
		if (!win) return;
		win.focus();
		win.print();
		// Dọn frame sau khi hộp thoại in đóng. Chrome trả về ngay sau `print()` nên chờ một nhịp.
		window.setTimeout(() => frame.remove(), 60_000);
		win.addEventListener('afterprint', () => frame.remove(), { once: true });
	};

	document.body.appendChild(frame);
}

export function usePrint() {
	const service = useGeneralRequestService();

	/**
	 * Gọi `/print` rồi mở hộp thoại in.
	 *
	 * Bản in mang số hiệu ở đầu trang: phiếu đã duyệt là giấy tờ đi vào lưu trữ, người nhận tìm
	 * lại bằng số hiệu. Giá trị biểu mẫu vẫn escape từng cái, ngày và số in theo kiểu Việt Nam.
	 */
	async function printRequest(requestId: number, format: PrintFormatting = {}): Promise<void> {
		const response = await service.print(requestId);
		const { printTemplate, fieldValues } = response;
		if (!printTemplate) return;
		printHtmlDocument(
			printCodeHeader(response.code, response.submittedAt) + printDocumentHtml(printTemplate, fieldValues, format),
		);
	}

	/** Xem thử bản in khi chưa duyệt: không gọi `/print` nên không tăng số lần in. */
	function previewRequest(
		req: GeneralRequestResponse,
		templateHtml?: string | null,
		format: PrintFormatting = {},
	): void {
		const html = templateHtml ?? req.printTemplate;
		if (!html) return;
		printHtmlDocument(printCodeHeader(req.code, req.submittedAt) + printDocumentHtml(html, req.fieldValues, format));
	}

	return { printRequest, previewRequest };
}
