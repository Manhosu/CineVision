/**
 * Rota da página de detalhe conforme o tipo de conteúdo.
 *
 * Igor (24/05): cada card repetia a regra `series → /series/:id, senão
 * /movies/:id` SEM o caso de novelinha — então clicar numa novelinha caía
 * em /movies/:id e dava 404. Centralizado aqui pra todos os cards (e o
 * link da IA) usarem a mesma regra.
 */
export function contentHref(
  content: { id: string; content_type?: string | null } | null | undefined,
): string {
  const id = content?.id || '';
  const type = content?.content_type;
  if (type === 'series') return `/series/${id}`;
  if (type === 'novelinha') return `/novelinhas/${id}`;
  return `/movies/${id}`;
}
