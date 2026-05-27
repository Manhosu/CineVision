// Igor (27/05): combina resultados de /movies + /series e ordena por
// relevância de título (match exato > startsWith > includes, em PT e EN).
// Antes o Header e a página /search só concatenavam — filmes vinham
// antes de séries sempre, então "Bad Boys" aparecia antes de "The Boys".

const normalize = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function relevanceScore(item: any, query: string): number {
  const q = normalize(query.trim());
  const t = normalize(item?.title || '');
  const te = normalize(item?.title_en || '');
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (te === q) return 75;
  if (t.includes(q)) return 60;
  if (te.startsWith(q)) return 50;
  if (te.includes(q)) return 40;
  if (normalize(item?.description || '').includes(q)) return 10;
  return 0;
}

export function mergeSearchResults<T>(movies: T[], series: T[], query: string): T[] {
  return [...movies, ...series].sort((a: any, b: any) => {
    const d = relevanceScore(b, query) - relevanceScore(a, query);
    if (d !== 0) return d;
    const r = (b.search_rank || 0) - (a.search_rank || 0);
    if (r !== 0) return r;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}
