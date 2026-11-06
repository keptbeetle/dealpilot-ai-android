// Minimal type bridge for the unchanged, vendored DealPilot pure functions.
export type LiveOffer={id:string;title:string;brand:string;merchant:string;priceCents:number;currency:'USD'|'INR';observedAt?:string|null;costClaims?:{
 shippingCents:number|null;taxCents:number|null;mandatoryFeeCents:number|null;membershipRequired:'yes'|'no'|'unknown';shipsToUS:'yes'|'no'|'unknown';shipsToIN?:'yes'|'no'|'unknown';
}};
export type RetailerInspection={title:string|null;model:string|null;gtin:string|null};
