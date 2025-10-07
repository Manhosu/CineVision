# Design Brief - Cine Vision

## 🎯 **Objetivos de Design**
- Interface inspirada no Netflix com foco em capas grandes
- **Mobile-first** para dispositivos antigos (Android 6+, iOS 10+)
- Performance otimizada para conexões 3G/4G instáveis
- Usabilidade simplificada para público com baixa familiaridade tech

---

## 🎨 **Design System**

### **Paleta de Cores**
```css
/* Cores Primárias */
--primary-red: #E50914;        /* Vermelho Netflix */
--primary-black: #000000;      /* Fundo principal */
--secondary-black: #141414;    /* Cards e seções */

/* Cores de Apoio */
--gray-dark: #2F2F2F;         /* Textos secundários */
--gray-medium: #808080;       /* Placeholder text */
--gray-light: #B3B3B3;        /* Borders e divisores */

/* Estados */
--success: #46D369;           /* Compras, confirmações */
--warning: #FFB800;           /* Alertas, loading */
--error: #E87C03;            /* Erros, indisponível */

/* Backgrounds */
--bg-primary: #000000;        /* Fundo principal */
--bg-secondary: #141414;      /* Cards, modais */
--bg-tertiary: #2F2F2F;       /* Inputs, botões secundários */
```

### **Tipografia**
```css
/* Família Principal */
font-family: 'Inter', 'Roboto', 'Segoe UI', system-ui, sans-serif;

/* Scale Responsiva */
--text-xs: 0.75rem;    /* 12px - Labels, metadata */
--text-sm: 0.875rem;   /* 14px - Body secundário */
--text-base: 1rem;     /* 16px - Body principal */
--text-lg: 1.125rem;   /* 18px - Títulos pequenos */
--text-xl: 1.25rem;    /* 20px - Títulos médios */
--text-2xl: 1.5rem;    /* 24px - Títulos grandes */
--text-3xl: 1.875rem;  /* 30px - Títulos destacados */

/* Pesos */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### **Espaçamentos**
```css
/* Sistema de espaçamentos 4px base */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

---

## 📱 **Sistema de Grid Responsivo**

### **Breakpoints**
```css
/* Mobile First */
--mobile: 320px;      /* Smartphones básicos */
--mobile-lg: 480px;   /* Smartphones grandes */
--tablet: 768px;      /* Tablets */
--desktop: 1024px;    /* Desktop pequeno */
--desktop-lg: 1440px; /* Desktop grande */
```

### **Container System**
```css
/* Containers responsivos */
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

/* Grid para carrosséis */
.movie-grid {
  display: grid;
  gap: var(--space-3);

  /* Mobile: 2 colunas */
  grid-template-columns: repeat(2, 1fr);

  /* Tablet: 3 colunas */
  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }

  /* Desktop: 4-6 colunas */
  @media (min-width: 1024px) {
    grid-template-columns: repeat(6, 1fr);
  }
}
```

---

## 🖼️ **Sistema de Imagens**

### **Aspect Ratios**
```css
/* Posters de filmes */
--poster-ratio: 2/3;      /* 2:3 (vertical) */
--banner-ratio: 16/9;     /* 16:9 (horizontal) */
--thumbnail-ratio: 4/3;   /* 4:3 (quadrado-wide) */
```

### **Tamanhos por Dispositivo**
```css
/* Poster sizes */
--poster-sm: 120px;       /* Mobile */
--poster-md: 180px;       /* Tablet */
--poster-lg: 240px;       /* Desktop */

/* Banner sizes */
--banner-mobile: 100vw;   /* Full width mobile */
--banner-tablet: 600px;   /* Fixed tablet */
--banner-desktop: 800px;  /* Fixed desktop */
```

---

## ⚡ **Otimizações de Performance**

### **Estratégias de Carregamento**
```css
/* LQIP - Low Quality Image Placeholders */
.lqip-placeholder {
  background: linear-gradient(135deg, #2F2F2F 0%, #141414 100%);
  filter: blur(5px);
  transition: filter 0.3s ease;
}

.lqip-loaded {
  filter: none;
}

/* Lazy loading skeleton */
.skeleton {
  background: linear-gradient(90deg,
    #2F2F2F 0%,
    #404040 50%,
    #2F2F2F 100%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### **CSS Crítico**
```css
/* Inline critical CSS */
/* Estrutura básica, header, hero */
body {
  font-family: system-ui, sans-serif;
  background: #000;
  color: #fff;
  margin: 0;
}

.header {
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 1000;
  background: rgba(0,0,0,0.9);
}

.hero-banner {
  height: 56.25vw;
  max-height: 600px;
  background: #141414;
}
```

---

## 🎬 **Componentes Principais**

### **Movie Card**
```css
.movie-card {
  position: relative;
  aspect-ratio: var(--poster-ratio);
  border-radius: 4px;
  overflow: hidden;
  transition: transform 0.2s ease;
  cursor: pointer;
}

.movie-card:hover {
  transform: scale(1.05);
}

.movie-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.movie-card__overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  padding: var(--space-3);
  color: white;
}
```

### **Carousel/Slider**
```css
.carousel {
  position: relative;
  overflow: hidden;
}

.carousel__track {
  display: flex;
  transition: transform 0.3s ease;
  gap: var(--space-3);
}

.carousel__item {
  flex: 0 0 auto;
  width: var(--poster-sm);
}

/* Responsive carousel items */
@media (min-width: 768px) {
  .carousel__item {
    width: var(--poster-md);
  }
}
```

### **Hero Banner**
```css
.hero-banner {
  position: relative;
  height: 56.25vw;
  max-height: 600px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: flex-end;
}

.hero-content {
  padding: var(--space-8) var(--space-4) var(--space-6);
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  width: 100%;
}

.hero-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-4);

  /* Responsive title */
  @media (min-width: 768px) {
    font-size: 3.5rem;
  }
}
```

---

## 🎛️ **Estados e Interações**

### **Loading States**
```css
.btn-loading {
  position: relative;
  color: transparent;
}

.btn-loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}
```

### **Touch Optimizations**
```css
/* Áreas de toque mínimas */
.touchable {
  min-height: 44px;
  min-width: 44px;
  padding: var(--space-3);

  /* Remove highlight em dispositivos móveis */
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Scroll suave em carrosséis */
.carousel__track {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

---

## 📱 **Otimizações para Dispositivos Antigos**

### **Fallbacks CSS**
```css
/* Fallback para dispositivos sem support a CSS Grid */
.movie-grid {
  display: flex;
  flex-wrap: wrap;
}

@supports (display: grid) {
  .movie-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
}

/* Fallback para aspect-ratio */
.movie-card {
  padding-bottom: 150%; /* 2:3 ratio */
  height: 0;
}

@supports (aspect-ratio: 2/3) {
  .movie-card {
    aspect-ratio: 2/3;
    padding-bottom: 0;
    height: auto;
  }
}
```

### **Performance Guidelines**
- **Imagens:** WebP com fallback JPEG
- **CSS:** Minimize animações em conexões lentas
- **JS:** Progressive enhancement
- **Fonts:** System fonts primeiro, custom fonts opcional
- **Bundle Size:** Máximo 200KB JS inicial

---

## 🎨 **Temas e Variações**

### **Dark Theme (Padrão)**
```css
:root {
  --bg-primary: #000000;
  --bg-secondary: #141414;
  --text-primary: #FFFFFF;
  --text-secondary: #B3B3B3;
}
```

### **Modo Contraste Alto** (Acessibilidade)
```css
@media (prefers-contrast: high) {
  :root {
    --bg-primary: #000000;
    --bg-secondary: #000000;
    --text-primary: #FFFFFF;
    --border-color: #FFFFFF;
  }
}
```

### **Redução de Movimento**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## ✅ **Checklist de Implementação**

### **Performance**
- [ ] LQIP implementado em todas as imagens
- [ ] Lazy loading para imagens below-the-fold
- [ ] CSS crítico inline (<14KB)
- [ ] Fonts preloaded ou system fonts
- [ ] Bundle JS inicial <200KB
- [ ] Testes em dispositivos Android 6+ e iOS 10+

### **UX/UI**
- [ ] Touch targets mínimo 44px
- [ ] Feedback visual em todas as interações
- [ ] Estados de loading implementados
- [ ] Fallbacks para funcionalidades avançadas
- [ ] Teste com usuários do público-alvo

### **Responsividade**
- [ ] Mobile-first approach
- [ ] Testes em telas 320px-1440px+
- [ ] Carrosséis funcionais em touch
- [ ] Navigation otimizada para mobile
- [ ] Performance em conexões 3G