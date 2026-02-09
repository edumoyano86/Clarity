# Clarity - Gestión Financiera Inteligente

Clarity es una aplicación web moderna diseñada para ayudar a los usuarios a gestionar sus finanzas personales con total claridad y el apoyo de Inteligencia Artificial.

## 🚀 Características Principales

- **Resumen Financiero Real:** Visualización clara de ingresos, gastos, balance y deudas pendientes.
- **Portafolio de Inversiones:** Seguimiento en tiempo real de Acciones y Criptomonedas mediante integración con APIs de mercado (Finnhub y CoinGecko).
- **Gestión de Deudas:** Control detallado de cuentas por pagar con seguimiento de saldos y pagos parciales.
- **Sugerencias con IA:** Utiliza **Google Genkit** para analizar patrones de gasto y ofrecer consejos de ahorro personalizados.
- **Agenda y Notas:** Organización integrada para citas financieras y recordatorios importantes.
- **Seguridad:** Autenticación robusta con Firebase Auth y reglas de seguridad de Firestore para proteger la privacidad del usuario.

## 🛠️ Tecnologías Utilizadas

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), React 19, Tailwind CSS.
- **Componentes UI:** [Shadcn/UI](https://ui.shadcn.com/) y Lucide React para iconos.
- **Backend/Base de Datos:** [Firebase](https://firebase.google.com/) (Firestore, Auth).
- **IA:** [Genkit](https://firebase.google.com/docs/genkit) con modelos de Google AI.
- **Visualización:** Recharts para gráficos dinámicos.

## ⚙️ Configuración del Proyecto

Para ejecutar este proyecto localmente, sigue estos pasos:

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/edumoyano86/Clarity.git
   cd Clarity
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Variables de Entorno:**
   Crea un archivo `.env.local` en la raíz del proyecto basándote en el archivo `.env.example` y completa tus credenciales de Firebase y las claves de API de Finnhub.

4. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

---
*Desarrollado por [Edu Moyano](https://github.com/edumoyano86) como parte de su portafolio profesional.*
