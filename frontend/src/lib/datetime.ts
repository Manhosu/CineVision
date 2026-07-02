/**
 * Igor (02/07): fix do bug do input datetime-local no admin de pré-venda.
 *
 * O par nativo `new Date(val).toISOString()` + `str.slice(0, 16)` causava
 * drift de horas porque:
 *   - onChange: valor local ("2026-07-02T00:00") era interpretado como
 *     local, .toISOString() convertia pra UTC (03:00Z em UTC-3), mas o
 *     salvamento gravava esse UTC.
 *   - value: recarregava a string ISO UTC (03:00Z), .slice(0,16) cortava
 *     o Z e o input mostrava "03:00" literalmente. Nunca voltava pro 00:00
 *     que o admin digitou.
 *
 * Correção: nas duas direções, respeitar o offset local do browser.
 */

/**
 * Converte um ISO UTC vindo do banco pro formato do <input type="datetime-local">,
 * mostrando o horário no fuso local do browser.
 *
 * Ex.: "2026-07-02T03:00:00.000Z" em UTC-3 → "2026-07-02T00:00"
 */
export function toLocalDatetimeInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/**
 * Converte o valor do <input type="datetime-local"> (sem timezone) pro
 * ISO UTC correto pro banco, aplicando o offset local do browser.
 *
 * Ex.: "2026-07-02T00:00" em UTC-3 → "2026-07-02T03:00:00.000Z"
 */
export function fromLocalDatetimeInput(local: string | null | undefined): string {
  if (!local) return '';
  const d = new Date(local);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}
