export type PassportType = 'ORDINARY' | 'DIPLOMATIC' | 'OFFICIAL';

export type PassportPhotoSide = 'front' | 'back';

export interface PassportResponse {
	id: number;
	employeeId: number;
	passportNumber: string;
	fullNameOnPassport: string;
	passportType: PassportType;
	issuedDate: string;
	expiryDate: string;
	photoFrontUrl: string | null;
	photoBackUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreatePassportPayload {
	passportNumber: string;
	fullNameOnPassport: string;
	passportType: PassportType;
	issuedDate: string;
	expiryDate: string;
}

export type UpdatePassportPayload = Partial<CreatePassportPayload>;

export interface PassportTypeMetaItem {
	value: PassportType;
	label: string;
}
