# 🧾 InvoiceAI

<div align="center">

![Angular](https://img.shields.io/badge/Angular-20.0.0-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**Sistema inteligente de procesamiento y validación de facturas usando IA**

[🚀 Demo en Vivo](https://santiagodiazpace.github.io/InvoiceAI/) • [📖 Documentación](#-características) • [🛠️ Instalación](#️-instalación)

</div>

---

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Instalación](#️-instalación)
- [Uso](#-uso)
- [Arquitectura](#-arquitectura)
- [Deploy](#-deploy)
- [Contribuir](#-contribuir)

---

## 🎯 Descripción

**InvoiceAI** es una aplicación web moderna que utiliza **Inteligencia Artificial** (Google Gemini) para automatizar el procesamiento, extracción de datos y validación de facturas PDF según las normativas de **AFIP** (Argentina).

### ✨ ¿Qué hace?

1. **📤 Sube una factura PDF** - Arrastra y suelta o selecciona archivos
2. **🤖 Extracción automática** - IA extrae todos los datos relevantes (CUIT, montos, fechas, etc.)
3. **✅ Validación AFIP** - Verifica cumplimiento con normativas argentinas
4. **💬 Chat inteligente** - Pregunta sobre la factura y obtén respuestas instantáneas
5. **📊 Clasificación automática** - Organiza facturas por tipo, empresa y fecha

---

## 🚀 Características

### 🔍 Extracción Inteligente de Datos

- ✅ **Tipos de comprobantes**: Facturas A/B/C/E, FCE, Notas de Crédito/Débito
- ✅ **Datos extraídos**: CUIT emisor/receptor, montos, fechas, números de comprobante
- ✅ **Confianza del análisis**: Sistema de scoring de precisión
- ✅ **Procesamiento por lotes**: Analiza múltiples facturas simultáneamente

### 🛡️ Validación AFIP

- 🔍 **Verificación de formato** según normativas argentinas
- 🔍 **Detección de inconsistencias** en datos fiscales
- 🔍 **Análisis de integridad visual** del PDF
- 🔍 **Alertas de errores críticos** con recomendaciones

### 💬 Chat con IA sobre Facturas

- 💡 Pregunta sobre datos específicos de la factura
- 💡 Consulta sobre normativas y cumplimiento AFIP
- 💡 Obtén explicaciones sobre errores detectados
- 💡 Historial de conversación contextual

### 🎨 Interfaz Moderna

- 🌙 **Diseño Dark Mode** profesional
- ⚡ **Drag & Drop** para carga de archivos
- 📱 **Responsive** - Funciona en móviles, tablets y escritorio
- 🎭 **Animaciones fluidas** con AOS (Animate On Scroll)

### 📊 Sistema de Clasificación

- **PAGAR** (< $50,000): Requiere pago inmediato
- **EMAIL** (≥ $50,000): Requiere aprobación por correo
- **✓ OK** / **✗ ERROR**: Estado de validación AFIP

---

## 🛠️ Tecnologías

### Frontend
- **Angular 20** - Framework principal
- **TypeScript** - Lenguaje tipado
- **Signals** - Gestión de estado reactivo
- **Tailwind CSS** - Estilos utility-first
- **SCSS** - Estilos personalizados

### IA & APIs
- **Google Gemini 2.5 Flash Lite** - Modelo de IA para extracción y validación
- **Proxy API personalizado** - Gestión segura de llamadas a Gemini

### Herramientas
- **Jest** - Testing unitario
- **ESLint** - Linting de código
- **Prettier** - Formateo automático
- **GitHub Pages** - Hosting y deploy

---

## ⚙️ Instalación

### Prerrequisitos

- Node.js 18+ (recomendado v20 LTS)
- npm o yarn
- Git

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/santiagodiazpace/InvoiceAI.git
cd InvoiceAI

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (opcional)
# Edita src/environments/environment.ts con tu API endpoint

# 4. Ejecutar en desarrollo
npm start

# La app estará disponible en http://localhost:4200
```

---

## 📖 Uso

### 1️⃣ Procesar una Factura Individual

1. Arrastra un PDF o haz clic en la zona de carga
2. Presiona el botón verde **"🤖 Procesar IA"**
3. Espera mientras la IA extrae los datos y valida
4. Revisa los resultados extraídos y la validación AFIP

### 2️⃣ Procesar Múltiples Facturas

1. Selecciona o arrastra varios archivos PDF
2. La app los procesará uno por uno automáticamente
3. Cada factura se añadirá a la lista de "Archivos Procesados"

### 3️⃣ Chatear sobre una Factura

1. En la lista de archivos procesados, haz clic en el ícono 💬
2. Escribe tu pregunta (ej: "¿Cuál es el CUIT del emisor?")
3. La IA responderá usando el contexto de la factura

### 4️⃣ Estados del Procesamiento

Durante el procesamiento, el botón muestra:
- **"Obteniendo datos..."** - Extrayendo información del PDF
- **"Validando..."** - Verificando contra normativas AFIP

---

## 🏗️ Arquitectura

```
InvoiceAI/
├── src/
│   ├── app/
│   │   ├── pages/
│   │   │   └── docai/
│   │   │       ├── docai-v2.ts          # Componente principal
│   │   │       ├── docai-v2.html        # Template
│   │   │       └── docai-v2.scss        # Estilos
│   │   ├── services/
│   │   │   ├── util.ts                  # Utilidades generales
│   │   │   └── splash-service.service.ts
│   │   └── shared/
│   │       └── material-design.module.ts
│   ├── environments/
│   │   ├── environment.ts               # Configuración dev
│   │   └── environment.prod.ts          # Configuración prod
│   └── assets/                          # Recursos estáticos
├── angular.json                         # Configuración Angular
├── tailwind.config.js                   # Configuración Tailwind
└── package.json                         # Dependencias
```

### 🔄 Flujo de Datos

```
Usuario sube PDF → fileToBase64() → API Gemini (Extracción)
    ↓
Datos JSON → API Gemini (Validación AFIP) → Resultado
    ↓
Visualización UI ← Chat IA (opcional)
```

---

## 🚀 Deploy

### GitHub Pages

El proyecto está configurado para deploy automático en GitHub Pages:

```bash
# Build y deploy en un solo comando
npm run deploy
```

La aplicación se publicará en: `https://santiagodiazpace.github.io/InvoiceAI/`

### Configuración Manual

```bash
# 1. Build para producción
npm run build:gh-pages

# 2. Los archivos compilados estarán en dist/oda-invoice/browser/
```

---

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

---

## 📝 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Servidor de desarrollo (puerto 4200) |
| `npm run build` | Build de producción |
| `npm run build:gh-pages` | Build para GitHub Pages |
| `npm run deploy` | Build + Deploy a GitHub Pages |
| `npm test` | Ejecutar tests con Jest |
| `npm run test:coverage` | Tests con cobertura |

---

## 🎨 Características UI/UX

### Drag & Drop Inteligente
- Detecta cantidad de archivos al arrastrar
- Cambia color según archivos (azul para 1, violeta para múltiples)
- Animaciones suaves durante el arrastre

### Validación Visual
- **Badge Verde (✓ OK)**: Factura válida según AFIP
- **Badge Rojo (✗ ERROR)**: Errores críticos detectados
- **Badge PAGAR/EMAIL**: Clasificación por monto

### Chat Contextual
- Historial de conversación persistente
- Indicador de "escribiendo..."
- Sugerencias de preguntas iniciales

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si quieres mejorar el proyecto:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add: amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es privado y está en desarrollo activo.

---

## 👤 Autor

**Santiago Diaz Pace**

- GitHub: [@santiagodiazpace](https://github.com/santiagodiazpace)
- Proyecto: [InvoiceAI](https://github.com/santiagodiazpace/InvoiceAI)

---

## 🙏 Agradecimientos

- **Google Gemini** por el modelo de IA
- **Angular Team** por el framework
- **Tailwind CSS** por el sistema de diseño
- **AFIP** por la documentación de normativas

---

<div align="center">

**⭐ Si te gusta el proyecto, dale una estrella en GitHub ⭐**

Hecho con ❤️ y ☕ por Santiago

</div>

