/**
 * Strict GTIN-8/12/13/14 checksum validation. Retain leading zeros because
 * UPC/EAN representations can differ only by left-padding, not product.
 */
export function normalizeGtin(value: string): string | null {
  const text = value.trim()
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(text) || /^0+$/.test(text)) return null
  let weighted = 0
  for (let index = text.length - 2, position = 0; index >= 0; index--, position++) {
    weighted += Number(text[index]) * (position % 2 === 0 ? 3 : 1)
  }
  const expected = (10 - weighted % 10) % 10
  return expected === Number(text[text.length - 1]) ? text : null
}

export function canonicalGtin(value: string): string | null {
  const valid = normalizeGtin(value)
  return valid ? valid.padStart(14, '0') : null
}

export function normalizePartNumber(value: string): string | null {
  const trimmed = value.trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9 ._\/-]{1,79}$/.test(trimmed)) return null
  // Format-only whitespace/case changes are harmless, but never strip hyphens,
  // revision letters or punctuation to equate distinct manufacturer's parts.
  return trimmed.replace(/\s+/g, ' ')
}

export function normalizeMerchantSku(value: string): string | null {
  return normalizePartNumber(value)
}

export type IdentifierEvidence = {
  status: 'gtin-reported-match' | 'conflicting-identifiers' | 'not-established'
  reason: string
}

/**
 * Values are typed by a human, not authenticated upstream evidence.
 * Brand-scoped MPNs and merchant-scoped SKUs cannot establish cross-seller
 * identity in the absence of a matching GTIN and separately checked variant.
 */
export function evaluateReportedIdentifiers(record: {
  catalogGtin: string | null
  merchantGtin: string | null
  catalogMpn: string | null
  merchantMpn: string | null
  merchantSku: string | null
}): IdentifierEvidence {
  const catalogGtin = record.catalogGtin ? canonicalGtin(record.catalogGtin) : null
  const merchantGtin = record.merchantGtin ? canonicalGtin(record.merchantGtin) : null
  if (record.catalogGtin && !catalogGtin || record.merchantGtin && !merchantGtin) {
    return {status:'not-established',reason:'Invalid GTIN checksum; recheck the source codes.'}
  }
  if (catalogGtin && merchantGtin && catalogGtin !== merchantGtin) {
    return {status:'conflicting-identifiers',reason:'Reported catalog and merchant GTINs differ.'}
  }
  if (record.catalogMpn && record.merchantMpn &&
      normalizePartNumber(record.catalogMpn) !== normalizePartNumber(record.merchantMpn)) {
    return {status:'conflicting-identifiers',reason:'Reported manufacturer part numbers differ.'}
  }
  if (catalogGtin && merchantGtin && catalogGtin === merchantGtin) {
    return {
      status:'gtin-reported-match',
      reason:'The two reviewer-entered GTINs agree; source authenticity, variant, stock and checkout are NOT verified.',
    }
  }
  return {
    status:'not-established',
    reason:'Both valid GTINs are required to corroborate cross-merchant identity; MPN and retailer SKU alone do not establish it.',
  }
}
