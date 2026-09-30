/**
 * Utility to fetch and cache the live USD/ARS exchange rate from DolarApi.
 * Defaults to the Blue dollar rate with fallback.
 */

let memoryCachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchDollarRate(): Promise<number> {
  const now = Date.now();
  if (memoryCachedRate && now - memoryCachedRate.timestamp < CACHE_DURATION_MS) {
    return memoryCachedRate.rate;
  }

  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue', {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data.venta || data.compra;
      if (typeof rate === 'number' && rate > 0) {
        memoryCachedRate = { rate, timestamp: now };
        return rate;
      }
    }
  } catch (error) {
    console.warn('Error al consultar DolarApi, usando cotización de respaldo:', error);
  }

  return memoryCachedRate?.rate || 1450;
}
