import { Movie } from '@/types/movie';

interface TechnicalSpecsProps {
  movie: Movie;
}

interface SpecItem {
  label: string;
  value: string;
  icon: React.ReactNode;
}

export default function TechnicalSpecs({ movie }: TechnicalSpecsProps) {
  const specs: SpecItem[] = [
    {
      label: 'Qualidade de Vídeo',
      value: '720p / 1080p HD',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      label: 'Formato de Áudio',
      value: 'Dolby Digital 5.1',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M6.343 6.343a1 1 0 011.414 0L12 10.586l4.243-4.243a1 1 0 111.414 1.414L13.414 12l4.243 4.243a1 1 0 01-1.414 1.414L12 13.414l-4.243 4.243a1 1 0 01-1.414-1.414L10.586 12 6.343 7.757a1 1 0 010-1.414z" />
        </svg>
      )
    },
    {
      label: 'Legendas',
      value: 'Português BR / Inglês',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      )
    },
    {
      label: 'Compatibilidade',
      value: 'Todos os dispositivos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    }
  ];

  if (movie.duration_minutes) {
    specs.unshift({
      label: 'Duração',
      value: `${Math.floor(movie.duration_minutes / 60)}h ${movie.duration_minutes % 60}min`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    });
  }

  if (movie.release_year) {
    specs.unshift({
      label: 'Ano de Lançamento',
      value: String(movie.release_year),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    });
  }

  return (
    <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 sm:p-8 tv:p-12">
      <h2 className="text-2xl tv:text-3xl font-bold text-white mb-6 tv:mb-10">
        Especificações Técnicas
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 tv:grid-cols-4 gap-6 tv:gap-8">
        {specs.map((spec, index) => (
          <div
            key={index}
            className="flex flex-col items-center text-center p-4 tv:p-6 bg-dark-700/30 border border-white/5 rounded-lg hover:bg-dark-700/50 transition-colors duration-200"
          >
            <div className="w-12 h-12 tv:w-16 tv:h-16 mb-3 tv:mb-4 text-primary-400">
              {spec.icon}
            </div>
            <dt className="text-sm tv:text-base font-medium text-gray-400 mb-2 tv:mb-3">
              {spec.label}
            </dt>
            <dd className="text-white tv:text-lg font-semibold">
              {spec.value}
            </dd>
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div className="mt-8 tv:mt-12 pt-6 tv:pt-8 border-t border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 tv:grid-cols-3 gap-6 tv:gap-8">
          <div className="flex items-center gap-3 tv:gap-4">
            <div className="w-2 h-2 tv:w-3 tv:h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-300 tv:text-lg">Streaming instantâneo</span>
          </div>
          
          <div className="flex items-center gap-3 tv:gap-4">
            <div className="w-2 h-2 tv:w-3 tv:h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-300 tv:text-lg">Download offline</span>
          </div>
          
          <div className="flex items-center gap-3 tv:gap-4">
            <div className="w-2 h-2 tv:w-3 tv:h-3 bg-purple-500 rounded-full"></div>
            <span className="text-gray-300 tv:text-lg">Multiplataforma</span>
          </div>
        </div>
      </div>
    </div>
  );
}