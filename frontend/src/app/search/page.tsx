// Igor (31/05): força /search a ser dinâmico pra escapar do cache estático
// do edge que ficou colado com bundle antigo após o fix do mergeSearchResults.
// O componente client real está em SearchClient.tsx.
import SearchClient from './SearchClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SearchPage() {
  return <SearchClient />;
}
