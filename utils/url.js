// utils/url.js
// URL sanitisation utilities for QR codes.
// Strips tracking parameters (UTM, gclid, fbclid, …) and optionally the protocol
// to reduce QR byte usage. No external dependencies.

export function sanitizeUrlForQR(input, { whitelist = [], aggressive = true, preserveProtocol = true } = {}){
  try{
    const u = new URL(input);
    const TRACKING = new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','gclid','gbraid','wbraid','fbclid','yclid','msclkid','mc_cid','mc_eid','_hsenc','_hsmi','ref','ref_src']);
    const keep = new Set(whitelist);
    const next = new URLSearchParams();
    const entries = Array.from(u.searchParams.entries());
    if(aggressive){ for(const [k,v] of entries) if(keep.has(k)) next.append(k,v); }
    else { for(const [k,v] of entries) if(!TRACKING.has(k) || keep.has(k)) next.append(k,v); }
    u.search = next.toString()? `?${next}` : '';
    if(!preserveProtocol && (u.protocol==='https:'||u.protocol==='http:')) return `${u.host}${u.pathname}${u.search}${u.hash}`;
    return u.toString();
  }catch{ return String(input||'').trim(); }
}
export function utf8ByteLen(s){ return new TextEncoder().encode(String(s)).length; }
