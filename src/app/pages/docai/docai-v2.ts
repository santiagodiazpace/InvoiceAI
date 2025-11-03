import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UtilService } from '../../services/util';
import { environment } from '../../../environments/environment';
import emailjs from '@emailjs/browser';

type EmailTemplateParams = Record<string, unknown>;

type DocType = 'informe' | 'factura' | 'orden_de_pago' | 'retenciones' | 'desconocido';

// Mapeos específicos del formato de Christian
const COMPROBANTE_CODES = {
  'Factura A': 'FacA',
  'Factura B': 'FacB',
  'Factura C': 'FacC',
  'Factura E': 'FacE',
  'Factura de Exportación': 'FacE',
  'Factura de Exportación E': 'FacE',
  'Factura de Crédito Electrónica MiPyMEs (FCE) A': 'FceA',
  'Factura de Crédito Electrónica MiPyMEs (FCE) B': 'FceB',
  'Nota de Crédito A': 'NdcA',
  'Nota de Crédito B': 'NdcB',
  'Nota de Débito A': 'NddA',
  'Nota de Débito B': 'NddB',
  'Informe': 'Inf',
  'Orden de Pago': 'OrdP',
  'Retención': 'Ret'
} as const;

// ✅ EMPRESA_CODES según especificación de Christian
const EMPRESA_CODES = {
  // Mapeos exactos
  'TLA': 'TLA',
  'CFA': 'CFA', 
  'FavaHnos': 'FavaH',
  'Favanet': 'FavaN',
  'Favacard': 'FavaC',
  
  // Variaciones comunes
  'FAVA HNOS': 'FavaH',
  'FAVA CARD': 'FavaC',
  'FAVA NET': 'FavaN',
  
  // Nombres completos y variaciones de TLA
  'TALLER LA ARGENTINA': 'TLA',
  'TALLER': 'TLA',
  'LA ARGENTINA': 'TLA',
  'TAMA': 'TLA', // Corrección específica
  'TARJETAS DEL MAR': 'TLA',        // ← NUEVO: Nombre completo
  'TARJETAS DEL MAR S.A.': 'TLA',   // ← NUEVO: Con denominación social
  
  // Otras variaciones comunes
  'FAVACARD SA': 'FavaC',
  'FAVACARD S.A.': 'FavaC',
  'FAVANET SA': 'FavaN',
  'FAVANET S.A.': 'FavaN',
  'FAVA HERMANOS': 'FavaH',
  'FAVAHNOS': 'FavaH'
} as const;

interface ComprobanteInfoV2 {
  tipo_comprobante: DocType;
  subtipo_comprobante?: string; // "Factura A", "FCE A", etc.
  numero_comprobante: string;
  puesto: string; // "0003"
  numero_secuencial: string; // "00000331"
  fecha_emision: string; // YYYY-MM-DD
  cuit_emisor: string;
  cuit_receptor: string;
  razon_social_emisor?: string;
  razon_social_receptor?: string;
  empresa_codigo?: string; // Para mapear a FavaC, FavaN, etc.
  monto_total?: number;
  moneda?: string;
  letra?: string; // A, B, C
  confidence: number;
  ejercicio?: string; // EJ01, EJ02, etc.
  observaciones?: string;
}

@Component({
  selector: 'app-oda-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docai-v2.html',
  styleUrl: './docai-v2.scss'
})
export class DocAIV2 {
  utilService = inject(UtilService);
  

  file = signal<File | null>(null);
  error = signal<string | null>(null);
  isProcessing = signal<boolean>(false);
  extractedData = signal<ComprobanteInfoV2 | null>(null);
  isDragOver = signal<boolean>(false);
  dragFileCount = signal<number>(0); // Contador de archivos durante drag
  mostrarPagar = signal<boolean>(false); // Signal para controlar la leyenda PAGAR
  mostrarEmail = signal<boolean>(false); // Signal para controlar la leyenda EMAIL

  // Método para verificar el estado de pago de una factura
  verificarEstadoFactura(monto?: number): 'PAGAR' | 'EMAIL' | null {
    if (!monto) return null;
    return monto < 50000 ? 'PAGAR' : 'EMAIL';
  }

  // Método para verificar el estado de validación AFIP
  verificarValidacionAFIP(validacion?: string): 'OK' | 'ERROR' | null {
    if (!validacion) return null;
    
    // Buscar errores críticos en el texto de validación
    const tieneErroresCriticos = validacion.includes('❌ ERRORES CRÍTICOS:') && 
                                  !validacion.includes('❌ ERRORES CRÍTICOS:\n- Ninguno detectado');
    
    // Si hay errores críticos, retornar ERROR
    if (tieneErroresCriticos) return 'ERROR';
    
    // Si no hay errores críticos, retornar OK
    return 'OK';
  }

  // Nueva funcionalidad para múltiples archivos
  colaArchivos = signal<File[]>([]);
  archivoActual = signal<number>(0);
  procesandoMultiples = signal<boolean>(false);

  // Configuración del ejercicio
  selectedEjercicio = signal<string>('EJ01');
  ejercicios = ['EJ01', 'EJ02', 'EJ03', 'EJ04', 'EJ05'];

  form = {
    type: 'desconocido' as DocType,
    subtipo: '',
    dateISO: '',
    puesto: '',
    numeroSecuencial: '',
    empresaCodigo: '',
    ejercicio: 'EJ01'
  };

  // Nueva funcionalidad para organización en carpetas - TEMPORALMENTE COMENTADO
  // organizarEnCarpetas = signal<boolean>(true);
  organizarEnCarpetas = signal<boolean>(false); // Deshabilitado temporalmente
  archivosProcesados = signal<Array<{
    file: File;
    fileName: string;
    fullPath: string;
    data: ComprobanteInfoV2;
    ejercicio: string;
    validacionAFIP?: string; // ✅ Resultado de la validación AFIP
  }>>([]);
  
  // ✅ PROBLEMA 3: Metadata por directorio según Christian - TEMPORALMENTE COMENTADO
  // generarMetadata = signal<boolean>(true);
  generarMetadata = signal<boolean>(false); // Deshabilitado temporalmente
  metadataPorDirectorio = signal<Map<string, Array<{
    fileName: string;
    originalName: string;
    metadata: ComprobanteInfoV2;
    processedAt: string;
  }>>>(new Map());

  // Formato del jefe: AAAA-MM-CCCC-NNNN-EEE.pdf (empresa 3 chars según ejemplos)
  finalNameV2 = computed(() => {
    const date = this.validISO(this.form.dateISO) ? this.form.dateISO : this.todayISO();
    const [year, month] = date.split('-');
    const comprobanteCodigo = this.getComprobanteCodigo(this.form.subtipo || this.form.type);
    const numeroFinal = this.getUltimos4Digitos(this.form.numeroSecuencial);
    const empresaCodigo = this.form.empresaCodigo || 'XXX';
    
    return `${year}-${month}-${comprobanteCodigo}-${numeroFinal}-${empresaCodigo}.pdf`;
  });

  // Ruta completa con ejercicio: /EJ01/Ventas/2021-03/2021-03-FacA-0002-FavaC.pdf
  fullPathV2 = computed(() => {
    const date = this.validISO(this.form.dateISO) ? this.form.dateISO : this.todayISO();
    const [year, month] = date.split('-');
    const ejercicio = this.form.ejercicio;
    const fileName = this.finalNameV2();
    
    return `/${ejercicio}/Ventas/${year}-${month}/${fileName}`;
  });

  onPick(e: Event) {
    this.error.set(null);
    this.extractedData.set(null);
    const input = e.target as HTMLInputElement;
    const files = input.files;
    
    if (files && files.length > 0) {
      if (files.length === 1) {
        // Un solo archivo - comportamiento normal
        this.handleFile(files[0]);
      } else {
        // Múltiples archivos - agregar a la cola
        const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
        if (pdfFiles.length === 0) {
          this.error.set('Todos los archivos deben ser PDF.');
          return;
        }
        this.manejarMultiplesArchivos(pdfFiles);
      }
    }
  }

  // Métodos para drag & drop
  onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver.set(true);
    
    // Capturar cantidad de archivos durante drag
    const items = e.dataTransfer?.items;
    if (items) {
      // Contar solo archivos PDF
      let pdfCount = 0;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type === 'application/pdf') {
          pdfCount++;
        }
      }
      this.dragFileCount.set(pdfCount);
      console.log(`🎯 Drag detectado: ${pdfCount} archivos PDF`);
    }
  }

  onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver.set(false);
    this.dragFileCount.set(0);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver.set(false);
    this.dragFileCount.set(0);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
      
      if (pdfFiles.length === 0) {
        this.error.set('Todos los archivos deben ser PDF.');
        return;
      }
      
      if (pdfFiles.length === 1) {
        // Un solo archivo
        this.handleFile(pdfFiles[0]);
      } else {
        // Múltiples archivos
        this.manejarMultiplesArchivos(pdfFiles);
      }
    }
  }

  private handleFile(f: File | null) {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      this.error.set('El archivo debe ser PDF.');
      return;
    }
    this.file.set(f);
  }

  // Método para obtener cantidad de archivos durante drag (para animaciones)
  getDragFileCount(): number {
    return this.dragFileCount();
  }

  // Método para mostrar/ocultar metadatos con animaciones
  mostrarMetadatos = signal<{[key: string]: boolean}>({});

  toggleMetadatos(fileName: string) {
    const current = this.mostrarMetadatos();
    this.mostrarMetadatos.set({
      ...current,
      [fileName]: !current[fileName]
    });
  }

  limpiar() {
    this.form = { 
      type: 'desconocido', 
      subtipo: '',
      dateISO: '', 
      puesto: '',
      numeroSecuencial: '',
      empresaCodigo: '',
      ejercicio: this.selectedEjercicio()
    };
    this.extractedData.set(null);
    this.error.set(null);
    this.archivosProcesados.set([]);
    this.colaArchivos.set([]);
    this.archivoActual.set(0);
    this.procesandoMultiples.set(false);
    this.mostrarPagar.set(false); // Reset the PAGAR indicator
  }

  // --- Métodos para múltiples archivos ---
  private manejarMultiplesArchivos(files: File[]) {
    // Para múltiples archivos, activar temporalmente la organización
    this.organizarEnCarpetas.set(true);
    
    this.colaArchivos.set(files);
    this.archivoActual.set(0);
    this.procesandoMultiples.set(true);
    
    // Mostrar primer archivo
    this.file.set(files[0]);
    this.error.set(null);
    
    console.log(`📁 ${files.length} archivos agregados a la cola para procesamiento`);
  }

  async procesarTodosLosArchivos() {
    const archivos = this.colaArchivos();
    if (archivos.length === 0) {
      this.error.set('No hay archivos en la cola');
      return;
    }

    this.isProcessing.set(true);
    this.error.set(null);

    try {
      for (let i = 0; i < archivos.length; i++) {
        this.archivoActual.set(i);
        this.file.set(archivos[i]);
        
        console.log(`📄 Procesando archivo ${i + 1}/${archivos.length}: ${archivos[i].name}`);
        
        // Procesar cada archivo
        await this.classifyWithAISingle(archivos[i]);
        
        // Pequeña pausa entre archivos
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('✅ Todos los archivos procesados exitosamente');
      
      // Limpiar cola después del procesamiento
      this.colaArchivos.set([]);
      this.procesandoMultiples.set(false);
      this.archivoActual.set(0);
      
    } catch (error) {
      this.error.set('Error procesando múltiples archivos: ' + (error as Error).message);
    } finally {
      this.isProcessing.set(false);
    }
  }

  // Versión del clasificador para uso interno (sin UI updates) TODO:
  private async classifyWithAISingle(file: File): Promise<ComprobanteInfoV2> {
    const b64 = await this.fileToBase64(file);

    const prompt = `Analiza este documento PDF para el sistema ODA Invoice.

IMPORTANTE: Debes ser MUY ESPECÍFICO con el tipo exacto de comprobante.

EXTRAE INFORMACIÓN ESPECÍFICA PARA FORMATO: AAAA-MM-CCCC-NNNN-EEEE.pdf

DETECCIÓN PRIORITARIA - BUSCA EXACTAMENTE:
1. FACTURAS: Busca en el documento el tipo específico
   - Si ves "FACTURA A" o "COD A" → subtipo_comprobante: "Factura A"
   - Si ves "FACTURA B" o "COD B" → subtipo_comprobante: "Factura B"  
   - Si ves "FACTURA C" o "COD C" → subtipo_comprobante: "Factura C"
   - Si ves "FACTURA E" o "COD E" o "EXPORTACIÓN" → subtipo_comprobante: "Factura E"
   - Si es FCE → subtipo_comprobante: "Factura de Crédito Electrónica MiPyMEs (FCE) A"

2. NOTAS: "Nota de Crédito A", "Nota de Débito A", etc.

3. INFORMES: Reportes, consultorías, supervisiones → subtipo_comprobante: "Informe"

4. ÓRDENES DE PAGO: Autorizaciones → subtipo_comprobante: "Orden de Pago"

5. RETENCIONES: Certificados → subtipo_comprobante: "Retención"

EXTRACCIÓN DE NÚMEROS - MUY IMPORTANTE:
- Busca "Comp. Nro:" o "Número:" seguido del formato "XXXX-XXXXXXXX"
- Ejemplo: "Comp. Nro: 00003-00000001"
  - puesto: "00003" (parte antes del guión)
  - numero_secuencial: "00000001" (parte después del guión)

CAMPOS REQUERIDOS:
- tipo_comprobante: (factura|informe|orden_de_pago|retenciones|desconocido)
- subtipo_comprobante: EL TIPO EXACTO con letra (ej: "Factura A", "Factura E")
- numero_comprobante: número completo del documento
- puesto: código punto de venta (ej: "00003")
- numero_secuencial: número secuencial sin punto de venta (ej: "00000001") 
- fecha_emision: formato YYYY-MM-DD
- razon_social_emisor: quien emite
- razon_social_receptor: quien recibe
- cuit_emisor: 11 dígitos
- cuit_receptor: 11 dígitos

EJEMPLO para Factura E:
{
  "tipo_comprobante": "factura",
  "subtipo_comprobante": "Factura E",
  "numero_comprobante": "00003-00000001",
  "puesto": "00003", 
  "numero_secuencial": "00000001",
  "fecha_emision": "2025-08-12",
  "razon_social_emisor": "LARROSA LAMBRECHT FRANCISCO NAHUEL",
  "razon_social_receptor": "MINDATA PROCUREMENT SERVICES S.L.",
  "cuit_emisor": "20395507304",
  "cuit_receptor": "55000004102",
  "confidence": 0.95
}`;

    const body = {
      contents: [{
        parts: [
          { inline_data: { mime_type: file.type || 'application/pdf', data: b64 } },
          { text: prompt }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          required: ['tipo_comprobante', 'confidence'],
          properties: {
            tipo_comprobante: {
              type: 'STRING',
              enum: ['factura', 'orden_de_pago', 'retenciones', 'informe', 'desconocido']
            },
            subtipo_comprobante: { type: 'STRING' },
            numero_comprobante: { type: 'STRING' },
            puesto: { type: 'STRING' },
            numero_secuencial: { type: 'STRING' },
            fecha_emision: { type: 'STRING', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            cuit_emisor: { type: 'STRING', pattern: '^\\d{11}$' },
            cuit_receptor: { type: 'STRING', pattern: '^\\d{11}$' },
            razon_social_emisor: { type: 'STRING' },
            razon_social_receptor: { type: 'STRING' },
            empresa_codigo: { type: 'STRING' },
            monto_total: { type: 'NUMBER', minimum: 0 },
            moneda: { type: 'STRING' },
            letra: { type: 'STRING', enum: ['A', 'B', 'C', 'E', 'M'] },
            confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
            observaciones: { type: 'STRING' }
          }
        },
        maxOutputTokens: 500
      }
    };

      const resp = await fetch(`${environment.apiBase}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash-lite',
          payload: body
        }),
      });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(t || `HTTP ${resp.status}`);
    }

    const raw = await resp.json();
    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const out = JSON.parse(text) as ComprobanteInfoV2;

    // Generar nombre y agregar a archivos procesados
    const tempForm = {
      type: out.tipo_comprobante as DocType || 'desconocido',
      subtipo: out.subtipo_comprobante || '',
      dateISO: out.fecha_emision || this.todayISO(),
      puesto: out.puesto || '',
      numeroSecuencial: this.extractNumeroSecuencial(out), // ✅ Extraer correctamente
      empresaCodigo: out.razon_social_receptor ? this.getEmpresaCodigo(out.razon_social_receptor) : 'XXX',
      ejercicio: this.selectedEjercicio()
    };

    const finalName = this.generateFileName(tempForm);
    const fullPath = this.generateFullPath(tempForm, finalName);

    this.agregarArchivoProcessado(file, finalName, fullPath, out);

    return out;
  }

  // Helper para generar nombre de archivo
  private generateFileName(form: any): string {
    const date = this.validISO(form.dateISO) ? form.dateISO : this.todayISO();
    const [year, month] = date.split('-');
    const comprobanteCodigo = this.getComprobanteCodigo(form.subtipo || form.type);
    const numeroFinal = this.getUltimos4Digitos(form.numeroSecuencial);
    const empresaCodigo = form.empresaCodigo || 'XXX';
    
    return `${year}-${month}-${comprobanteCodigo}-${numeroFinal}-${empresaCodigo}.pdf`;
  }

  // Helper para generar ruta completa
  private generateFullPath(form: any, fileName: string): string {
    const date = this.validISO(form.dateISO) ? form.dateISO : this.todayISO();
    const [year, month] = date.split('-');
    const ejercicio = form.ejercicio;
    
    return `/${ejercicio}/Ventas/${year}-${month}/${fileName}`;
  }

  // --- Helpers específicos para el formato del jefe ---
  private validISO(s?: string) { 
    return !!(s && /^\d{4}-\d{2}-\d{2}$/.test(s)); 
  }

  private todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private getComprobanteCodigo(subtipo: string): string {
    if (!subtipo) {
      console.log(`⚠️ Subtipo vacío, usando fallback`);
      return this.getFallbackCode();
    }

    console.log(`🔍 Buscando código para: "${subtipo}"`);
    
    // Busca en el mapeo de códigos con detección EXACTA primero
    for (const [key, code] of Object.entries(COMPROBANTE_CODES)) {
      const keyLower = key.toLowerCase();
      const subtipoLower = subtipo.toLowerCase();
      
      // Primero: matching exacto
      if (subtipoLower === keyLower) {
        console.log(`✅ Match exacto: "${subtipo}" → ${code}`);
        return code;
      }
      
      // Segundo: matching específico por tipo
      if (this.matchesTipoComprobante(subtipoLower, keyLower)) {
        console.log(`✅ Match específico: "${subtipo}" → ${code}`);
        return code;
      }
    }
    
    // Tercero: matching parcial (más permisivo)
    for (const [key, code] of Object.entries(COMPROBANTE_CODES)) {
      const keyLower = key.toLowerCase();
      const subtipoLower = subtipo.toLowerCase();
      
      if (subtipoLower.includes(keyLower)) {
        console.log(`✅ Match parcial: "${subtipo}" → ${code}`);
        return code;
      }
    }
    
    // Fallback mejorado basado en el tipo base
    console.log(`⚠️ Usando fallback para: "${subtipo}" (tipo: ${this.form.type})`);
    return this.getFallbackCode();
  }

  private getFallbackCode(): string {
    switch (this.form.type) {
      case 'factura': return 'FacA';
      case 'informe': return 'Inf';
      case 'orden_de_pago': return 'OrdP';
      case 'retenciones': return 'Ret';
      default: return 'XXX';
    }
  }

  // Helper para matching más inteligente de tipos
  private matchesTipoComprobante(subtipo: string, keyPattern: string): boolean {
    // Casos especiales para mejor detección con matching más específico
    if (keyPattern.includes('factura a') && subtipo.match(/\bfactura\s+a\b/i)) return true;
    if (keyPattern.includes('factura b') && subtipo.match(/\bfactura\s+b\b/i)) return true;
    if (keyPattern.includes('factura c') && subtipo.match(/\bfactura\s+c\b/i)) return true;
    if (keyPattern.includes('factura e') && (subtipo.match(/\bfactura\s+e\b/i) || subtipo.includes('exporta'))) return true;
    if (keyPattern.includes('exportación') && subtipo.includes('exporta')) return true;
    if (keyPattern.includes('fce a') && subtipo.includes('fce') && subtipo.match(/\ba\b/i)) return true;
    if (keyPattern.includes('fce b') && subtipo.includes('fce') && subtipo.match(/\bb\b/i)) return true;
    
    return false;
  }

  // ✅ Método para extraer número secuencial con fallback inteligente
  private extractNumeroSecuencial(out: ComprobanteInfoV2): string {
    let numeroSecuencial = out.numero_secuencial || '';
    
    console.log(`🔢 Extrayendo número secuencial inicial: "${numeroSecuencial}"`);
    
    // Verificar si necesitamos fallback (vacío, muy corto, o solo ceros)
    const needsFallback = !numeroSecuencial || 
                         numeroSecuencial.length < 3 || 
                         /^0+$/.test(numeroSecuencial.replace(/\D/g, ''));
                         
    if (needsFallback && out.numero_comprobante) {
      // Extraer de numero_comprobante formato "00003-00000001" o "0003-00000331"
      const match = out.numero_comprobante.match(/(\d+)-(\d+)/);
      if (match && match[2]) {
        numeroSecuencial = match[2]; // Parte después del guión
        console.log(`🔧 Fallback número secuencial: "${out.numero_secuencial}" + "${out.numero_comprobante}" → "${numeroSecuencial}"`);
      } else {
        // Fallback secundario: extraer todos los dígitos del final
        const allDigits = out.numero_comprobante.replace(/\D/g, '');
        if (allDigits.length >= 4) {
          numeroSecuencial = allDigits.slice(-8); // Últimos 8 dígitos
          console.log(`🔧 Fallback secundario: "${out.numero_comprobante}" → "${numeroSecuencial}"`);
        } else {
          console.log(`⚠️ No se pudo extraer número secuencial, usando vacío`);
          numeroSecuencial = '';
        }
      }
    } else if (numeroSecuencial) {
      console.log(`✅ Número secuencial detectado correctamente: "${numeroSecuencial}"`);
    }
    
    return numeroSecuencial;
  }

  private getUltimos4Digitos(numeroSecuencial: string): string {
    console.log(`🔢 Procesando número secuencial: "${numeroSecuencial}"`);
    
    if (!numeroSecuencial) {
      console.log(`⚠️ Número secuencial vacío, usando 0000`);
      return '0000';
    }
    
    const digits = numeroSecuencial.replace(/\D+/g, '');
    console.log(`🔢 Dígitos extraídos: "${digits}"`);
    
    if (!digits) {
      console.log(`⚠️ No se encontraron dígitos en "${numeroSecuencial}", usando 0000`);
      return '0000';
    }
    
    // Toma los últimos 4 dígitos
    const ultimos4 = digits.slice(-4);
    const resultado = ultimos4.padStart(4, '0');
    console.log(`✅ Últimos 4 dígitos: "${numeroSecuencial}" → "${resultado}" (de "${digits}")`);
    
    return resultado;
  }

  private getEmpresaCodigo(razonSocial: string): string {
    if (!razonSocial) return 'XXX';
    
    console.log(`🏢 Mapeando empresa: "${razonSocial}"`);
    
    // 1. MAPEO FIJO PRIORITARIO según Christian - con matching más agresivo
    const razonUpper = razonSocial.toUpperCase().trim();
    
    // Primero: matching exacto
    for (const [empresa, codigo] of Object.entries(EMPRESA_CODES)) {
      if (razonUpper === empresa.toUpperCase()) {
        console.log(`✅ Mapeo exacto: "${razonSocial}" → ${codigo}`);
        return codigo;
      }
    }
    
    // Segundo: matching que contenga
    for (const [empresa, codigo] of Object.entries(EMPRESA_CODES)) {
      if (razonUpper.includes(empresa.toUpperCase())) {
        console.log(`✅ Mapeo por inclusión: "${razonSocial}" contiene "${empresa}" → ${codigo}`);
        return codigo;
      }
    }
    
    // Tercero: matching inverso (la empresa está en la razón social)
    for (const [empresa, codigo] of Object.entries(EMPRESA_CODES)) {
      if (empresa.toUpperCase().includes(razonUpper)) {
        console.log(`✅ Mapeo inverso: "${empresa}" contiene "${razonSocial}" → ${codigo}`);
        return codigo;
      }
    }
    
    // 2. FALLBACK: Generación dinámica solo si no hay mapeo fijo
    console.log(`⚠️ No se encontró mapeo fijo para: "${razonSocial}", generando dinámicamente...`);
    
    const palabras = razonSocial
      .toUpperCase()
      .replace(/[^A-ZÑ\s]/g, '') // Remover números, puntos, comas, etc.
      .split(/\s+/) // Dividir por espacios
      .filter(palabra => 
        palabra.length > 1 && // Filtrar palabras de 1 letra
        !['SA', 'SAS', 'SRL', 'LTDA', 'CIA', 'Y', 'E', 'DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS'].includes(palabra)
      );
    
    // Generar código inteligente
    let codigo = '';
    
    if (palabras.length >= 2) {
      // Tomar primeras 2 letras de las primeras 2 palabras importantes
      codigo = palabras[0].substring(0, 2) + palabras[1].substring(0, 2);
    } else if (palabras.length === 1) {
      // Una sola palabra: tomar primeras 4 letras
      codigo = palabras[0].substring(0, 4);
    } else {
      // Fallback
      codigo = 'XXXX';
    }
    
    // Asegurar que tenga exactamente 3-5 caracteres según el estándar
    if (codigo.length > 5) {
      codigo = codigo.substring(0, 5);
    } else if (codigo.length < 3) {
      codigo = codigo.padEnd(3, 'X');
    }
    
    console.log(`⚠️ Generación dinámica: "${razonSocial}" → ${codigo}`);
    return codigo;
  }

  // helper: leer el PDF como base64
  async fileToBase64(file: File): Promise<string> {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    return dataUrl.split(',')[1] || '';
  }

  async classifyWithAIV2(): Promise<void> {
    const f = this.file();
    if (!f) {
      this.error.set('Seleccioná un PDF primero');
      return;
    }

    this.isProcessing.set(true);
    this.error.set(null);
    
    // Si no estamos procesando múltiples archivos, limpiar la lista anterior
    if (!this.procesandoMultiples()) {
      this.archivosProcesados.set([]);
    }

    try {
      const b64 = await this.fileToBase64(f);

      //TODO: PROMPT USADO PARA FACTURAS

      const prompt = `Analiza esta factura PDF para el sistema InvoiceIA.

IMPORTANTE: Debes ser MUY ESPECÍFICO con el tipo exacto de factura.

EXTRAE INFORMACIÓN ESPECÍFICA PARA FORMATO: AAAA-MM-CCCC-NNNN-EEEE.pdf

DETECCIÓN DE TIPO DE FACTURA - BUSCA EXACTAMENTE:
- Si ves "FACTURA A" o "COD A" → subtipo_comprobante: "Factura A"
- Si ves "FACTURA B" o "COD B" → subtipo_comprobante: "Factura B"  
- Si ves "FACTURA C" o "COD C" → subtipo_comprobante: "Factura C"
- Si ves "FACTURA E" o "COD E" o "EXPORTACIÓN" → subtipo_comprobante: "Factura E"
- Si es FCE → subtipo_comprobante: "Factura de Crédito Electrónica MiPyMEs (FCE) A"
- Si es Nota de Crédito → subtipo_comprobante: "Nota de Crédito A/B" (según corresponda)
- Si es Nota de Débito → subtipo_comprobante: "Nota de Débito A/B" (según corresponda)

EXTRACCIÓN DE NÚMEROS - MUY IMPORTANTE:
- Busca "Comp. Nro:" o "Número:" seguido del formato "XXXX-XXXXXXXX"
- Ejemplo: "Comp. Nro: 00003-00000001"
  - puesto: "00003" (parte antes del guión)
  - numero_secuencial: "00000001" (parte después del guión)

CAMPOS REQUERIDOS:
- tipo_comprobante: (factura|informe|orden_de_pago|retenciones|desconocido)
- subtipo_comprobante: EL TIPO EXACTO con letra (ej: "Factura A", "Factura E")
- numero_comprobante: número completo del documento
- puesto: código punto de venta (ej: "00003")
- numero_secuencial: número secuencial sin punto de venta (ej: "00000001") 
- fecha_emision: formato YYYY-MM-DD
- razon_social_emisor: quien emite
- razon_social_receptor: quien recibe
- cuit_emisor: 11 dígitos
- cuit_receptor: 11 dígitos

EJEMPLO para Factura E:
{
  "tipo_comprobante": "factura",
  "subtipo_comprobante": "Factura E",
  "numero_comprobante": "00003-00000001",
  "puesto": "00003", 
  "numero_secuencial": "00000001",
  "fecha_emision": "2025-08-12",
  "razon_social_emisor": "LARROSA LAMBRECHT FRANCISCO NAHUEL",
  "razon_social_receptor": "MINDATA PROCUREMENT SERVICES S.L.",
  "cuit_emisor": "20395507304",
  "cuit_receptor": "55000004102",
  "confidence": 0.95
}`;

      const body = {
        contents: [{
          parts: [
            { inline_data: { mime_type: f.type || 'application/pdf', data: b64 } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            required: ['tipo_comprobante', 'confidence'],
            properties: {
              tipo_comprobante: {
                type: 'STRING',
                enum: ['factura']
              },
              subtipo_comprobante: { type: 'STRING' },
              numero_comprobante: { type: 'STRING' },
              puesto: { type: 'STRING' },
              numero_secuencial: { type: 'STRING' },
              fecha_emision: { type: 'STRING', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              cuit_emisor: { type: 'STRING', pattern: '^\\d{11}$' },
              cuit_receptor: { type: 'STRING', pattern: '^\\d{11}$' },
              razon_social_emisor: { type: 'STRING' },
              razon_social_receptor: { type: 'STRING' },
              empresa_codigo: { type: 'STRING' },
              monto_total: { type: 'NUMBER', minimum: 0 },
              moneda: { type: 'STRING' },
              letra: { type: 'STRING', enum: ['A', 'B', 'C', 'E', 'M'] },
              confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
              observaciones: { type: 'STRING' }
            }
          },
          maxOutputTokens: 500
        }
      };

      const resp = await fetch(`${environment.apiBase}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash-lite',
          payload: body
        }),
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(t || `HTTP ${resp.status}`);
      }

      const raw = await resp.json();
      const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const out = JSON.parse(text) as ComprobanteInfoV2;

      // Guardar los datos extraídos
      this.extractedData.set(out);

      // ✅ VALIDACIÓN AFIP - Segundo prompt
      const validacionResultado = await this.validarFacturaAFIP(out, b64);

      // Rellenar el form con la nueva estructura
      this.form.type = out.tipo_comprobante as DocType || 'desconocido';
      this.form.subtipo = out.subtipo_comprobante || '';
      this.form.ejercicio = this.selectedEjercicio();

      if (out.fecha_emision && /^\d{4}-\d{2}-\d{2}$/.test(out.fecha_emision)) {
        this.form.dateISO = out.fecha_emision;
      }

      if (out.puesto) {
        this.form.puesto = out.puesto;
      }

      if (out.numero_secuencial) {
        this.form.numeroSecuencial = out.numero_secuencial;
      }

      // Actualizar el formulario con los datos detectados para V2
      this.form.type = out.tipo_comprobante as DocType || 'desconocido';
      this.form.subtipo = out.subtipo_comprobante || '';
      this.form.dateISO = out.fecha_emision || this.todayISO();
      this.form.puesto = out.puesto || '';
      
      // ✅ Usar el mismo método de extracción que para múltiples archivos
      const numeroSecuencial = this.extractNumeroSecuencial(out);
      this.form.numeroSecuencial = numeroSecuencial;
      this.form.ejercicio = this.selectedEjercicio();

      // Mapear empresa usando razón social
      if (out.razon_social_receptor) {
        this.form.empresaCodigo = this.getEmpresaCodigo(out.razon_social_receptor);
      }

      // Generar nombre usando la misma lógica que múltiples archivos
      const tempForm = {
        type: out.tipo_comprobante as DocType || 'desconocido',
        subtipo: out.subtipo_comprobante || '',
        dateISO: out.fecha_emision || this.todayISO(),
        puesto: out.puesto || '',
        numeroSecuencial: numeroSecuencial, // Usar el valor con fallback
        empresaCodigo: out.razon_social_receptor ? this.getEmpresaCodigo(out.razon_social_receptor) : 'XXX',
        ejercicio: this.selectedEjercicio()
      };

      const finalName = this.generateFileName(tempForm);
      const fullPath = this.generateFullPath(tempForm, finalName);
      
      console.log('📁 Ruta completa V2:', fullPath);
      console.log('📄 Nombre archivo V2:', finalName);
      
      // Agregar archivo a la lista para que aparezca en la UI con validación
      this.agregarArchivoProcessado(f, finalName, fullPath, out, validacionResultado);

      // Evaluar el importe y tomar acciones
      this.evaluarImporte(out);

    } catch (e: any) {
      this.error.set(e?.message || 'No se pudo clasificar con IA V2.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  // ✅ NUEVO: Método para validar factura con AFIP usando Gemini
  private async validarFacturaAFIP(datos: ComprobanteInfoV2, pdfBase64: string): Promise<string> {
    try {
      console.log('🔍 Iniciando validación AFIP de la factura...');
      
      const promptValidacion = `Actúa como un verificador experto de facturas de AFIP (Administración Federal de Ingresos Públicos de Argentina).

DATOS EXTRAÍDOS DE LA FACTURA:
- Tipo: ${datos.tipo_comprobante}
- Subtipo: ${datos.subtipo_comprobante || 'No especificado'}
- Número: ${datos.numero_comprobante}
- Fecha: ${datos.fecha_emision}
- Emisor: ${datos.razon_social_emisor || 'No especificado'}
- CUIT Emisor: ${datos.cuit_emisor}
- Receptor: ${datos.razon_social_receptor || 'No especificado'}
- CUIT Receptor: ${datos.cuit_receptor}
- Monto: $${datos.monto_total || 'No especificado'}
- Moneda: ${datos.moneda || 'ARS'}

TAREAS DE VALIDACIÓN:

1. VALIDACIÓN DE NORMAS AFIP:
   ✓ Verificar formato de CUIT (debe ser 11 dígitos)
   ✓ Validar estructura del número de comprobante (formato XXXX-XXXXXXXX)
   ✓ Verificar tipo de factura según relación emisor/receptor
   ✓ Validar fecha de emisión (no debe ser futura ni muy antigua)
   ✓ Verificar coherencia entre letra de factura y condición fiscal
   ✓ Verificar presencia de CAE (Código de Autorización Electrónico)

2. DETECCIÓN DE SIGNOS DE MANIPULACIÓN VISUAL:
   ⚠️ Buscar inconsistencias en tipografías
   ⚠️ Detectar alineaciones anormales de texto
   ⚠️ Identificar posible superposición de textos
   ⚠️ Analizar calidad de imagen (borrosidad sospechosa)
   ⚠️ Verificar si números o montos parecen alterados digitalmente
   ⚠️ Comprobar presencia y coherencia de códigos de barras/QR

3. VALIDACIONES DE COHERENCIA:
   📊 Verificar relación entre monto en números y letras
   📊 Validar cálculos de subtotales e IVA
   📊 Comprobar que los datos del emisor estén completos
   📊 Verificar coherencia de montos con tipo de factura

RESPONDE EN ESTE FORMATO:

✅ VALIDACIONES EXITOSAS:
- (lista de validaciones que pasaron correctamente)

⚠️ ADVERTENCIAS:
- (lista de cosas que requieren atención pero no son críticas)

❌ ERRORES CRÍTICOS:
- (lista de errores que invalidan la factura)

🔍 SIGNOS DE MANIPULACIÓN DETECTADOS:
- (lista si hay signos de alteración, o "Ninguno detectado")

📊 NIVEL DE CONFIANZA: (Alto/Medio/Bajo)

💡 RECOMENDACIONES:
- (lista de acciones sugeridas)`;

      const bodyValidacion = {
        contents: [{
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
            { text: promptValidacion }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.2
        }
      };

      const respValidacion = await fetch(`${environment.apiBase}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash-lite',
          payload: bodyValidacion
        }),
      });

      if (!respValidacion.ok) {
        console.error('⚠️ Error en validación AFIP');
        return '⚠️ Error al validar la factura con AFIP';
      }

      const rawValidacion = await respValidacion.json();
      const validacionText = rawValidacion?.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo obtener resultado de validación';

      // Imprimir resultados en consola con formato
      console.log('\n' + '='.repeat(80));
      console.log('🔍 RESULTADO DE VALIDACIÓN AFIP');
      console.log('='.repeat(80));
      console.log(validacionText);
      console.log('='.repeat(80) + '\n');

      return validacionText;

    } catch (error) {
      console.error('❌ Error en validación AFIP:', error);
      return '❌ Error al procesar la validación AFIP: ' + (error as Error).message;
    }
  }

  // Método para evaluar el importe y tomar acciones
  private evaluarImporte(datos: ComprobanteInfoV2) {
    if (!datos.monto_total) {
      console.log('⚠️ No se encontró monto total en la factura');
      this.mostrarPagar.set(false);
      return;
    }

    if (datos.monto_total < 50000) {
      // Si es menor a $50000, mostrar leyenda PAGAR
      console.log('✅ PAGAR - Monto: $' + datos.monto_total.toLocaleString('es-AR'));
      this.mostrarPagar.set(true);
      return 'PAGAR';
    } else {
      // Si es mayor a $50000, enviar email
      this.enviarEmailFactura(datos);
      console.log('📧 Email enviado - Monto: $' + datos.monto_total.toLocaleString('es-AR'));
      this.mostrarPagar.set(false);
      return 'EMAIL_ENVIADO';
    }
  }

  // Método para enviar email con los datos de la factura
  private async enviarEmailFactura(datos: ComprobanteInfoV2) {
    try {
      const templateParams: EmailTemplateParams = {
        to_email: 'admin@invoiceai.com',
        from_name: 'InvoiceAI System',
        subject: `Factura para revision - ${datos.subtipo_comprobante || 'Factura'} - $${datos.monto_total?.toLocaleString('es-AR')}`,
        message: [
          'Se requiere revision de la siguiente factura:',
          '',
          `Tipo: ${datos.subtipo_comprobante}`,
          `Numero: ${datos.numero_comprobante}`,
          `Fecha: ${datos.fecha_emision}`,
          `Monto: $${datos.monto_total?.toLocaleString('es-AR')}`,
          '',
          `Emisor: ${datos.razon_social_emisor}`,
          `CUIT Emisor: ${datos.cuit_emisor}`,
          '',
          `Receptor: ${datos.razon_social_receptor}`,
          `CUIT Receptor: ${datos.cuit_receptor}`,
          '',
          'Por favor revisar y aprobar.'
        ].join('\n')
      };

      // Enviar email usando EmailJS
      await emailjs.send(
        'service_email_invoiceia', // Tu Service ID de EmailJS
        'template_6my5ups',  // Tu Template ID de EmailJS
        templateParams,
        'ktFlh61zh67x7iPrd'      // Tu Public Key de EmailJS
      );

      console.log('✅ Email enviado correctamente');
    } catch (error) {
      console.error('❌ Error al enviar email:', error);
      this.error.set('Error al enviar email: ' + (error as Error).message);
    }
  }

  private triggerDownloadV2(file: File, fileName: string) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  onEjercicioChange() {
    this.form.ejercicio = this.selectedEjercicio();
  }

  // Nuevos métodos para organización en carpetas
  private agregarArchivoProcessado(file: File, fileName: string, fullPath: string, data: ComprobanteInfoV2, validacionAFIP?: string) {
    const archivos = this.archivosProcesados();
    archivos.push({
      file,
      fileName,
      fullPath,
      data,
      ejercicio: this.selectedEjercicio(),
      validacionAFIP
    });
    this.archivosProcesados.set([...archivos]);
  }

  async descargarZipOrganizado() {
    const archivos = this.archivosProcesados();
    if (archivos.length === 0) {
      this.error.set('No hay archivos procesados para organizar');
      return;
    }

    try {
      // Importar JSZip dinámicamente
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Organizar archivos por estructura de carpetas
      for (const archivo of archivos) {
        const pathParts = archivo.fullPath.split('/').filter(p => p);
        let currentFolder = zip;
        
        // Crear estructura de carpetas
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderName = pathParts[i];
          currentFolder = currentFolder.folder(folderName) || currentFolder;
        }
        
        // Agregar archivo a la carpeta correcta
        const fileBuffer = await archivo.file.arrayBuffer();
        currentFolder.file(archivo.fileName, fileBuffer);
      }

      // Generar y descargar ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DocAI-V2-${this.selectedEjercicio()}-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Limpiar archivos procesados después de la descarga
      this.archivosProcesados.set([]);
      
    } catch (error) {
      this.error.set('Error al crear ZIP organizado: ' + (error as Error).message);
    }
  }

  limpiarArchivosProcessados() {
    this.archivosProcesados.set([]);
    this.file.set(null);
    this.extractedData.set(null);
    this.colaArchivos.set([]);
  }

  eliminarArchivoProcesado(index: number) {
    const archivos = this.archivosProcesados();
    archivos.splice(index, 1);
    this.archivosProcesados.set([...archivos]);
    
    // Si ya no quedan archivos procesados, limpiar todo
    if (archivos.length === 0) {
      this.file.set(null);
      this.extractedData.set(null);
      this.colaArchivos.set([]);
    }
  }

  descargarArchivoIndividual(index: number) {
    const archivos = this.archivosProcesados();
    if (index >= 0 && index < archivos.length) {
      const archivo = archivos[index];
      this.triggerDownloadV2(archivo.file, archivo.fileName);
    }
  }

  toggleSidebar() {
    this.utilService.toggleSidebarState();
  }

 enviarMailFactura(factura: any) {
  const templateParams = {
    invoice_number: factura.invoice_number,
    customer_name: factura.customer_name,
    amount: factura.amount,
    items: JSON.stringify(factura.items, null, 2) // convierte array a string
  };

  emailjs.send('service_email_invoiceia','template_6my5ups', templateParams, 'ktFlh61zh67x7iPrd')
    .then((response) => {
      console.log('Email enviado correctamente', response.status, response.text);
    }, (error) => {
      console.error('Error enviando email', error);
    });
}

}
