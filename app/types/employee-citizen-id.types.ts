export interface CitizenIdResponse {
	id: number;
	employeeId: number;
	citizenIdNumber: string;
	fullNameOnCard: string | null;
	issuedDate: string;
	/** Lô 3a: ngày hết hạn in trên thẻ; null với thẻ nhập trước lô 3a. */
	expiryDate: string | null;
	issuedPlace: string | null;
	hometown: string | null;
	/** Lô 3a: nơi đăng ký khai sinh, trên thẻ căn cước mới thay cho quê quán. */
	birthRegistrationPlace: string | null;
	permanentAddress: string | null;
	temporaryAddress: string | null;
	currentAddress: string | null;
	frontPhotoUrl: string | null;
	backPhotoUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateCitizenIdPayload {
	citizenIdNumber: string;
	fullNameOnCard?: string;
	issuedDate: string;
	expiryDate?: string;
	issuedPlace?: string;
	hometown?: string;
	birthRegistrationPlace?: string;
	permanentAddress?: string;
	temporaryAddress?: string;
	currentAddress?: string;
}

export type UpdateCitizenIdPayload = Partial<CreateCitizenIdPayload>;
