# 🎬 Cine Vision - Design System

> **Sistema de Design Completo para Plataforma de Streaming**  
> Versão 1.0 | Atualizado em Janeiro 2025

---

## 📋 **Índice**

1. [Visão Geral](#visão-geral)
2. [Paleta de Cores](#paleta-de-cores)
3. [Tipografia](#tipografia)
4. [Espaçamentos](#espaçamentos)
5. [Componentes Base](#componentes-base)
6. [Layouts](#layouts)
7. [Responsividade](#responsividade)
8. [Acessibilidade](#acessibilidade)
9. [Performance](#performance)

---

## 🎯 **Visão Geral**

### **Conceito**
O Cine Vision adota uma estética **Netflix-inspired** com foco em **simplicidade**, **performance** e **acessibilidade**. O design prioriza usuários com dispositivos básicos e conexões lentas, mantendo a elegância visual.

### **Princípios de Design**
- **Minimalismo Elegante**: Interface limpa sem elementos desnecessários
- **Mobile First**: Otimização prioritária para dispositivos móveis
- **Performance**: Carregamento rápido e experiência fluida
- **Acessibilidade**: Suporte completo a leitores de tela e navegação por teclado
- **Consistência**: Padrões visuais uniformes em toda a plataforma

---

## 🎨 **Paleta de Cores**

### **Cores Primárias**
```css
/* Vermelho Netflix - Cor Principal */
--primary-50: #fef2f2;
--primary-100: #fee2e2;
--primary-200: #fecaca;
--primary-300: #fca5a5;
--primary-400: #f87171;
--primary-500: #ef4444;
--primary-600: #dc2626;  /* Cor principal */
--primary-700: #b91c1c;
--primary-800: #991b1b;
--primary-900: #7f1d1d;
```

### **Cores Neutras (Dark Theme)**
```css
/* Escala de Cinzas */
--dark-50: #f8f8f8;
--dark-100: #e5e5e5;
--dark-200: #cccccc;
--dark-300: #b3b3b3;
--dark-400: #999999;
--dark-500: #808080;
--dark-600: #666666;
--dark-700: #4d4d4d;
--dark-800: #333333;   /* Background cards */
--dark-900: #1a1a1a;   /* Background secundário */
--dark-950: #0a0a0a;   /* Background principal */
```

### **Cores Semânticas**
```css
/* Sucesso */
--success-500: #10b981;
--success-600: #059669;

/* Aviso */
--warning-500: #f59e0b;
--warning-600: #d97706;

/* Erro */
--error-500: #ef4444;
--error-600: #dc2626;

/* Informação */
--info-500: #3b82f6;
--info-600: #2563eb;
```

### **Cores de Acento**
```css
/* Roxo para elementos especiais */
--accent-purple-500: #8b5cf6;
--accent-purple-600: #7c3aed;

/* Glass/Transparências */
--glass-light: rgba(255, 255, 255, 0.1);
--glass-dark: rgba(0, 0, 0, 0.3);
--overlay-dark: rgba(0, 0, 0, 0.8);
```

---

## ✍️ **Tipografia**

### **Família de Fontes**
```css
/* Fonte Principal */
font-family: 'Inter', 'Roboto', 'Segoe UI', system-ui, sans-serif;

/* Fonte Monospace (códigos) */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

### **Escala Tipográfica**
```css
/* Tamanhos Responsivos */
--text-xs: 0.75rem;    /* 12px - Labels, metadata */
--text-sm: 0.875rem;   /* 14px - Body secundário */
--text-base: 1rem;     /* 16px - Body principal */
--text-lg: 1.125rem;   /* 18px - Subtítulos */
--text-xl: 1.25rem;    /* 20px - Títulos pequenos */
--text-2xl: 1.5rem;    /* 24px - Títulos médios */
--text-3xl: 1.875rem;  /* 30px - Títulos grandes */
--text-4xl: 2.25rem;   /* 36px - Títulos hero */
--text-5xl: 3rem;      /* 48px - Títulos destacados */
```

### **Pesos de Fonte**
```css
--font-normal: 400;    /* Texto normal */
--font-medium: 500;    /* Texto médio */
--font-semibold: 600;  /* Subtítulos */
--font-bold: 700;      /* Títulos */
```

### **Altura de Linha**
```css
--leading-tight: 1.25;   /* Títulos */
--leading-normal: 1.5;   /* Texto normal */
--leading-relaxed: 1.75; /* Texto longo */
```

---

## 📏 **Espaçamentos**

### **Sistema Base (4px)**
```css
/* Espaçamentos Internos e Externos */
--space-0: 0;
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
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

### **Espaçamentos Específicos**
```css
/* Containers */
--container-padding: var(--space-4);
--container-padding-lg: var(--space-6);

/* Cards */
--card-padding: var(--space-6);
--card-gap: var(--space-4);

/* Botões */
--button-padding-x: var(--space-6);
--button-padding-y: var(--space-3);
```

---

## 🧩 **Componentes Base**

### **Botões**

#### **Primário**
```css
.btn-primary {
  background: var(--primary-600);
  color: white;
  padding: var(--button-padding-y) var(--button-padding-x);
  border-radius: 8px;
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--primary-700);
  transform: translateY(-1px);
}

.btn-primary:active {
  background: var(--primary-800);
  transform: translateY(0);
}
```

#### **Secundário**
```css
.btn-secondary {
  background: var(--dark-700);
  color: white;
  border: 1px solid var(--dark-600);
}

.btn-secondary:hover {
  background: var(--dark-600);
  border-color: var(--dark-500);
}
```

#### **Ghost**
```css
.btn-ghost {
  background: transparent;
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.4);
}
```

### **Cards**

#### **Card Base**
```css
.card {
  background: rgba(51, 51, 51, 0.5); /* dark-800/50 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: var(--card-padding);
  backdrop-filter: blur(10px);
}

.card-hover {
  transition: all 0.3s ease;
  cursor: pointer;
}

.card-hover:hover {
  background: rgba(51, 51, 51, 0.7);
  transform: scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}
```

#### **Movie Card**
```css
.movie-card {
  aspect-ratio: 2/3; /* Poster ratio */
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  transition: transform 0.2s ease;
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

### **Inputs**

#### **Input Base**
```css
.input-field {
  background: var(--dark-700);
  border: 1px solid var(--dark-600);
  color: white;
  padding: var(--space-3) var(--space-4);
  border-radius: 8px;
  font-size: var(--text-base);
  transition: all 0.2s ease;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.input-field::placeholder {
  color: var(--dark-400);
}
```

### **Navegação**

#### **Header**
```css
.header {
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: var(--space-4) 0;
}

.header-scrolled {
  background: rgba(0, 0, 0, 0.95);
}
```

#### **Sidebar (Admin)**
```css
.sidebar {
  width: 280px;
  background: var(--dark-900);
  border-right: 1px solid var(--dark-700);
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}

.sidebar-item {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  color: var(--dark-300);
  transition: all 0.2s ease;
  border-radius: 8px;
  margin: var(--space-1) var(--space-3);
}

.sidebar-item:hover,
.sidebar-item.active {
  background: var(--primary-600);
  color: white;
}
```

---

## 📱 **Layouts**

### **Breakpoints**
```css
/* Mobile First Approach */
--mobile: 320px;      /* Smartphones básicos */
--mobile-lg: 480px;   /* Smartphones grandes */
--tablet: 768px;      /* Tablets */
--desktop: 1024px;    /* Desktop pequeno */
--desktop-lg: 1440px; /* Desktop grande */
--tv: 1920px;         /* Smart TVs */
```

### **Container System**
```css
.container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

@media (min-width: 768px) {
  .container {
    padding: 0 var(--space-6);
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 0 var(--space-8);
  }
}
```

### **Grid System**
```css
/* Movies Grid */
.movies-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(2, 1fr);
}

@media (min-width: 480px) {
  .movies-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 768px) {
  .movies-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1024px) {
  .movies-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (min-width: 1440px) {
  .movies-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}
```

### **Carousel/Slider**
```css
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-behavior: smooth;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.carousel::-webkit-scrollbar {
  display: none;
}

.carousel-item {
  flex: none;
  width: 200px;
}

@media (min-width: 768px) {
  .carousel-item {
    width: 240px;
  }
}

@media (min-width: 1024px) {
  .carousel-item {
    width: 280px;
  }
}
```

---

## ♿ **Acessibilidade**

### **Focus States**
```css
.focus-outline {
  outline: none;
  transition: box-shadow 0.2s ease;
}

.focus-outline:focus {
  box-shadow: 0 0 0 3px var(--primary-600);
}

/* TV/Keyboard Navigation */
.focus-tv:focus {
  outline: 3px solid var(--primary-600);
  outline-offset: 2px;
}
```

### **Screen Reader Support**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### **High Contrast Mode**
```css
@media (prefers-contrast: high) {
  .btn-primary {
    background: white;
    color: black;
    border: 2px solid white;
  }
  
  .card {
    border: 2px solid rgba(255, 255, 255, 0.5);
  }
}
```

### **Reduced Motion**
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## ⚡ **Performance**

### **Loading States**
```css
.loading-shimmer {
  background: linear-gradient(90deg,
    var(--dark-800) 0%,
    var(--dark-700) 50%,
    var(--dark-800) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### **Image Optimization**
```css
.lazy-image {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.lazy-image.loaded {
  opacity: 1;
}

.image-placeholder {
  background: linear-gradient(135deg, var(--dark-800) 0%, var(--dark-900) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dark-500);
}
```

---

## 🎮 **Player de Vídeo**

### **Container**
```css
.video-container {
  position: relative;
  width: 100%;
  background: black;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
}

.video-container.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  border-radius: 0;
}
```

### **Controles**
```css
.player-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  padding: var(--space-6);
  opacity: 1;
  transition: opacity 0.3s ease;
}

.player-controls.hidden {
  opacity: 0;
  pointer-events: none;
}

.progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
  margin-bottom: var(--space-4);
}

.progress-fill {
  height: 100%;
  background: var(--primary-600);
  transition: width 0.1s ease;
}
```

---

## 🤖 **Integração Telegram**

### **Bot Interface**
```css
.telegram-integration {
  background: linear-gradient(135deg, #0088cc 0%, #005580 100%);
  border-radius: 12px;
  padding: var(--space-6);
  color: white;
  text-align: center;
}

.telegram-button {
  background: #0088cc;
  color: white;
  border: none;
  padding: var(--space-3) var(--space-6);
  border-radius: 25px;
  font-weight: var(--font-medium);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.telegram-button:hover {
  background: #005580;
}
```

---

## 📊 **Métricas de Design**

### **Performance Targets**
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

### **Acessibilidade Targets**
- **WCAG 2.1 AA**: Compliance total
- **Contrast Ratio**: Mínimo 4.5:1
- **Keyboard Navigation**: 100% funcional
- **Screen Reader**: Suporte completo

### **Mobile Optimization**
- **Touch Targets**: Mínimo 44px
- **Viewport**: Responsive 320px-2560px
- **Safe Areas**: Suporte completo iOS/Android
- **Offline**: Funcionalidade básica

---

## 🔄 **Versionamento**

### **Changelog**
- **v1.0** (Janeiro 2025): Design system inicial
- Próximas versões incluirão refinamentos baseados em feedback

### **Implementação**
Este design system deve ser implementado usando:
- **Tailwind CSS** como base
- **CSS Custom Properties** para tokens
- **Component Library** para reutilização
- **Storybook** para documentação visual

---

*Documento criado para o projeto Cine Vision - Sistema de Design v1.0*