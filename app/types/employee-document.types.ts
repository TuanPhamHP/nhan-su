/**
 * Tài liệu nhân viên.
 *
 * Lô 3a đổi loại giấy tờ thành danh mục cấu hình được: gửi `documentTypeId` thay vì mã cố
 * định, và mỗi tài liệu có thêm ngày cấp, ngày hết hạn, ghi chú, thân nhân liên quan cùng
 * người tải lên. Contract ở `docs/backend/bridges/employee-documents.md`.
 */

export interface EmployeeDocumentResponse {
	id: number;
	documentTypeId: number;
	/** Mã loại trong danh mục, ví dụ `HEALTH_CERT`; công ty thêm mã riêng được. */
	type: string;
	/** Tên loại trong danh mục; luôn hiện nhãn này, không tự map từ mã. */
	typeLabel: string;
	isSensitive: boolean;
	fileName: string;
	/** URL gốc trên S3, không render trực tiếp mà gọi endpoint `/url`. */
	fileUrl: string;
	fileType: string;
	issuedDate: string | null;
	expiryDate: string | null;
	note: string | null;
	relativeId: number | null;
	relativeName: string | null;
	/** Bỏ trống với giấy tờ tải lên trước lô 3a. */
	uploadedBy: { id: number; name: string } | null;
	uploadedAt: string;
}

export interface UploadDocumentPayload {
	file: File;
	documentTypeId: number;
	issuedDate?: string;
	/** Bỏ trống thì server tính theo thời hạn mặc định của loại. */
	expiryDate?: string;
	note?: string;
	relativeId?: number;
}
