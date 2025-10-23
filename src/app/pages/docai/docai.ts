import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UtilService } from '../../services/util';
import { environment } from '../../../environments/environment';


type DocType = 'informe' | 'factura' | 'orden_de_pago' | 'retenciones' | 'desconocido';

interface ComprobanteInfo {
  tipo_comprobante: 'factura' | 'orden_de_pago' | 'retenciones' | 'informe' | 'desconocido';
  numero_comprobante: string;
  fecha_emision: string; // YYYY-MM-DD
  cuit_emisor: string;
  cuit_receptor: string;
  razon_social_emisor?: string;
  razon_social_receptor?: string;
  monto_total?: number;
  moneda?: string;
  punto_venta?: string;
  letra?: string; // A, B, C para facturas
  condicion_iva_emisor?: string;
  condicion_iva_receptor?: string;
  confidence: number; // 0-1
  observaciones?: string;
}

@Component({
  selector: 'app-docai',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docai.html',
  styleUrl: './docai.scss'
})
export class DocAI {
  utilService = inject(UtilService);

  file = signal<File | null>(null);
  error = signal<string | null>(null);
  isProcessing = signal<boolean>(false);
  extractedData = signal<ComprobanteInfo | null>(null);
  isDragOver = signal<boolean>(false);

  form = {
    type: 'desconocido' as DocType,
    dateISO: '',
    docNumber: '',
    cuit: ''
  };

  // Construye siempre el formato requerido
  finalName = computed(() => {
    const date = this.validISO(this.form.dateISO) ? this.form.dateISO : this.todayISO();
    const tipo = this.docTypeLabel(this.form.type);
    const nro = this.normalizeDocNumber(this.form.docNumber);
    const cuit = this.normalizeCuit(this.form.cuit);
    return `${date}_${tipo}-${nro}_CUIT-${cuit}.pdf`;
  });

  onPick(e: Event) {
    this.error.set(null);
    this.extractedData.set(null);
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    this.handleFile(f);
  }

  // Métodos para drag & drop
  onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver.set(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const f = files[0];
      this.handleFile(f);
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

  limpiar() {
    this.form = { type: 'desconocido', dateISO: '', docNumber: '', cuit: '' };
    this.extractedData.set(null);
    this.error.set(null);
  }

  // --- Helpers de formato ---
  private validISO(s?: string) { return !!(s && /^\d{4}-\d{2}-\d{2}$/.test(s)); }

  private todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private docTypeLabel(t: DocType) {
    switch (t) {
      case 'factura': return 'Factura';
      case 'orden_de_pago': return 'Orden-de-Pago';
      case 'retenciones': return 'Retenciones';
      case 'informe': return 'Informe';
      default: return 'Desconocido';
    }
  }

  private normalizeDocNumber(n?: string) {
    if (!n) return '00000000';
    const digits = (n.match(/\d+/g) || []).join('');
    if (!digits) return '00000000';
    return digits.length <= 8 ? digits.padStart(8, '0') : digits;
  }

  private normalizeCuit(c?: string) {
    const digits = (c || '').replace(/\D+/g, '');
    return digits.length === 11 ? digits : '00000000000';
  }

  private safeName(s: string) {
    return (s || 'documento.pdf')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ').trim();
  }

  private ensurePdfExt(s: string) { return s.toLowerCase().endsWith('.pdf') ? s : `${s}.pdf`; }

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

  async classifyWithAI(): Promise<void> {
    const f = this.file();
    if (!f) {
      this.error.set('Seleccioná un PDF primero');
      return;
    }

    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const b64 = await this.fileToBase64(f);

      const prompt = `Analiza este documento PDF y clasifícalo correctamente.

TIPOS DE DOCUMENTO (ordena por prioridad):

1. INFORME: Documentos que INFORMAN sobre actividades, trabajos realizados, consultorías, supervisiones, análisis, reportes técnicos, estudios.
   Busca: "informe", "informar", "detalle valorizado", "consultoría", "supervisión", "reporte", "análisis", "tareas realizadas", "actividades", "resumen de trabajos"

2. FACTURA: Documentos comerciales de VENTA con conceptos facturables, importes, IVA.
   Busca: "FACTURA", "Tipo A/B/C", "conceptos", "total a pagar", "venta"

3. ORDEN_DE_PAGO: Autorizaciones de PAGO o transferencias bancarias.
   Busca: "orden de pago", "autorización", "transferencia", "pagar a"

4. RETENCIONES: Certificados de RETENCIÓN de impuestos.
   Busca: "retención", "certificado", "constancia", "% retención"

5. DESCONOCIDO: Si no coincide claramente con los anteriores

IMPORTANTE: Un documento puede tener importes SIN ser factura. Si habla de "informar detalles" o "consultoría/supervisión" es INFORME, no factura.

Extrae TODOS los metadatos posibles: números, fechas, CUITs, razones sociales, montos, letras (A,B,C), punto de venta, condiciones de IVA.
Devuelve JSON con estructura ComprobanteInfo completa.`;

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
                enum: ['factura', 'orden_de_pago', 'retenciones', 'informe', 'desconocido'],
                description: 'PRIORIDAD: informe (reportes, consultorías, supervisiones), factura (ventas comerciales), orden_de_pago (autorizaciones de pago), retenciones (certificados impuestos)'
              },
              numero_comprobante: { type: 'STRING' },
              fecha_emision: { type: 'STRING', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              cuit_emisor: { type: 'STRING', pattern: '^\\d{11}$' },
              cuit_receptor: { type: 'STRING', pattern: '^\\d{11}$' },
              razon_social_emisor: { type: 'STRING' },
              razon_social_receptor: { type: 'STRING' },
              monto_total: { type: 'NUMBER', minimum: 0 },
              moneda: { type: 'STRING' },
              punto_venta: { type: 'STRING' },
              letra: { type: 'STRING', enum: ['A', 'B', 'C', 'E', 'M'] },
              condicion_iva_emisor: { type: 'STRING' },
              condicion_iva_receptor: { type: 'STRING' },
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
      const out = JSON.parse(text) as ComprobanteInfo;

      // Guardar los datos extraídos para mostrar el JSON
      this.extractedData.set(out);

      // Elegimos CUIT del emisor por defecto
      const chosenCUIT = (out.cuit_emisor || out.cuit_receptor || '').replace(/\D+/g, '');

      // Rellenamos tu form
      this.form.type = out.tipo_comprobante as DocType || 'desconocido';

      if (out.fecha_emision && /^\d{4}-\d{2}-\d{2}$/.test(out.fecha_emision)) {
        this.form.dateISO = out.fecha_emision;
      }

      if (out.numero_comprobante) {
        this.form.docNumber = out.numero_comprobante;
      }

      if (chosenCUIT) {
        this.form.cuit = chosenCUIT;
      }

      // --- NOMBRE FINAL + DESCARGA AUTOMÁTICA ---
      const finalName = this.buildFinalName();
      this.triggerDownload(f, finalName);

    } catch (e: any) {
      this.error.set(e?.message || 'No se pudo clasificar con IA.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  private buildFinalName(): string {
    const date = this.validISO(this.form.dateISO) ? this.form.dateISO : this.todayISO();
    const tipo = this.docTypeLabel(this.form.type);
    const nro = this.normalizeDocNumber(this.form.docNumber);
    const cuit = this.normalizeCuit(this.form.cuit);
    return `${date}_${tipo}-${nro}_CUIT-${cuit}.pdf`;
  }

  private triggerDownload(file: File, fileName: string) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.safeName(fileName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  toggleSidebar() {
    this.utilService.toggleSidebarState();
  }
}