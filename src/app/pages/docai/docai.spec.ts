import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DocAI } from './docai';
import { UtilService } from '../../services/util';

describe('DocAI', () => {
  let component: DocAI;
  let fixture: ComponentFixture<DocAI>;
  let mockUtilService: jasmine.SpyObj<UtilService>;

  beforeEach(async () => {
    // Crear mocks de servicios
    mockUtilService = jasmine.createSpyObj('UtilService', ['toggleSidebarState'], {
      deviceTypeComputed: signal('desktop'),
      toggleSidebar: signal(false)
    });

    await TestBed.configureTestingModule({
      imports: [DocAI],
      providers: [
        { provide: UtilService, useValue: mockUtilService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocAI);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      expect(component.file()).toBeNull();
      expect(component.error()).toBeNull();
      expect(component.isProcessing()).toBeFalse();
      expect(component.extractedData()).toBeNull();
      expect(component.isDragOver()).toBeFalse();
      expect(component.form.type).toBe('desconocido');
      expect(component.form.dateISO).toBe('');
      expect(component.form.docNumber).toBe('');
      expect(component.form.cuit).toBe('');
    });

    it('should compute final name with default values', () => {
      const today = new Date();
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const expectedName = `${expectedDate}_Desconocido-00000000_CUIT-00000000000.pdf`;
      expect(component.finalName()).toBe(expectedName);
    });
  });

  describe('File Handling', () => {
    it('should handle valid PDF file selection', () => {
      const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      const mockEvent = { target: { files: [mockFile] } } as any;

      component.onPick(mockEvent);

      expect(component.file()).toBe(mockFile);
      expect(component.error()).toBeNull();
      expect(component.extractedData()).toBeNull();
    });

    it('should reject non-PDF files', () => {
      const mockFile = new File([''], 'test.txt', { type: 'text/plain' });
      const mockEvent = { target: { files: [mockFile] } } as any;

      component.onPick(mockEvent);

      expect(component.file()).toBeNull();
      expect(component.error()).toBe('El archivo debe ser PDF.');
    });

    it('should handle empty file selection', () => {
      const mockEvent = { target: { files: [] } } as any;

      component.onPick(mockEvent);

      expect(component.file()).toBeNull();
    });
  });

  describe('Drag and Drop', () => {
    let mockEvent: jasmine.SpyObj<DragEvent>;

    beforeEach(() => {
      mockEvent = jasmine.createSpyObj('DragEvent', ['preventDefault', 'stopPropagation']);
    });

    it('should handle drag over', () => {
      component.onDragOver(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(component.isDragOver()).toBeTrue();
    });

    it('should handle drag leave', () => {
      component.isDragOver.set(true);
      
      component.onDragLeave(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(component.isDragOver()).toBeFalse();
    });

    it('should handle drop with valid PDF', () => {
      const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      const mockDataTransfer = {
        files: [mockFile]
      };
      Object.defineProperty(mockEvent, 'dataTransfer', {
        value: mockDataTransfer,
        writable: false
      });
      component.isDragOver.set(true);

      component.onDrop(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(component.isDragOver()).toBeFalse();
      expect(component.file()).toBe(mockFile);
    });

    it('should handle drop with invalid file', () => {
      const mockFile = new File([''], 'test.txt', { type: 'text/plain' });
      const mockDataTransfer = {
        files: [mockFile]
      };
      Object.defineProperty(mockEvent, 'dataTransfer', {
        value: mockDataTransfer,
        writable: false
      });

      component.onDrop(mockEvent);

      expect(component.isDragOver()).toBeFalse();
      expect(component.error()).toBe('El archivo debe ser PDF.');
    });

    it('should handle drop with no files', () => {
      const mockDataTransfer = {
        files: []
      };
      Object.defineProperty(mockEvent, 'dataTransfer', {
        value: mockDataTransfer,
        writable: false
      });

      component.onDrop(mockEvent);

      expect(component.isDragOver()).toBeFalse();
      expect(component.file()).toBeNull();
    });
  });

  describe('Helper Methods', () => {
    it('should validate ISO date format', () => {
      expect((component as any).validISO('2023-12-25')).toBeTrue();
      expect((component as any).validISO('2023-1-1')).toBeFalse();
      expect((component as any).validISO('invalid')).toBeFalse();
      expect((component as any).validISO('')).toBeFalse();
      expect((component as any).validISO(undefined)).toBeFalse();
    });

    it('should generate today\'s ISO date', () => {
      const today = new Date();
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect((component as any).todayISO()).toBe(expectedDate);
    });

    it('should normalize document numbers', () => {
      expect((component as any).normalizeDocNumber('12345')).toBe('00012345');
      expect((component as any).normalizeDocNumber('A-123-B-456')).toBe('00123456');
      expect((component as any).normalizeDocNumber('123456789012')).toBe('123456789012');
      expect((component as any).normalizeDocNumber('')).toBe('00000000');
      expect((component as any).normalizeDocNumber(undefined)).toBe('00000000');
    });

    it('should normalize CUIT', () => {
      expect((component as any).normalizeCuit('20-12345678-9')).toBe('20123456789');
      expect((component as any).normalizeCuit('20123456789')).toBe('20123456789');
      expect((component as any).normalizeCuit('123')).toBe('00000000000');
      expect((component as any).normalizeCuit('')).toBe('00000000000');
      expect((component as any).normalizeCuit(undefined)).toBe('00000000000');
    });

    it('should get document type labels', () => {
      expect((component as any).docTypeLabel('factura')).toBe('Factura');
      expect((component as any).docTypeLabel('orden_de_pago')).toBe('Orden-de-Pago');
      expect((component as any).docTypeLabel('retenciones')).toBe('Retenciones');
      expect((component as any).docTypeLabel('informe')).toBe('Informe');
      expect((component as any).docTypeLabel('desconocido')).toBe('Desconocido');
    });

    it('should sanitize file names', () => {
      expect((component as any).safeName('File with émociónes.pdf')).toBe('File with emociones.pdf');
      expect((component as any).safeName('file/with\\bad:chars')).toBe('file-with-bad-chars');
      expect((component as any).safeName('  multiple   spaces  ')).toBe('multiple spaces');
    });

    it('should ensure PDF extension', () => {
      expect((component as any).ensurePdfExt('document')).toBe('document.pdf');
      expect((component as any).ensurePdfExt('document.pdf')).toBe('document.pdf');
      expect((component as any).ensurePdfExt('document.PDF')).toBe('document.PDF');
    });
  });

  describe('Form Management', () => {
    it('should update final name when form changes', () => {
      component.form.type = 'factura';
      component.form.dateISO = '2023-12-25';
      component.form.docNumber = '123';
      component.form.cuit = '20123456789';

      expect(component.finalName()).toBe('2023-12-25_Factura-00000123_CUIT-20123456789.pdf');
    });

    it('should clear form and data', () => {
      // Configurar estado inicial
      component.form.type = 'factura';
      component.form.dateISO = '2023-12-25';
      component.form.docNumber = '123';
      component.form.cuit = '20123456789';
      component.extractedData.set({ tipo_comprobante: 'factura', confidence: 0.9 } as any);
      component.error.set('Some error');

      component.limpiar();

      expect(component.form.type).toBe('desconocido');
      expect(component.form.dateISO).toBe('');
      expect(component.form.docNumber).toBe('');
      expect(component.form.cuit).toBe('');
      expect(component.extractedData()).toBeNull();
      expect(component.error()).toBeNull();
    });
  });

  describe('File to Base64 Conversion', () => {
    it('should convert file to base64', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      // Mock FileReader
      const mockFileReader = {
        readAsDataURL: jasmine.createSpy('readAsDataURL').and.callFake(function(this: any, file: File) {
          setTimeout(() => {
            this.result = 'data:application/pdf;base64,dGVzdCBjb250ZW50';
            this.onload();
          }, 0);
        }),
        result: null,
        onload: null,
        onerror: null
      };

      spyOn(window, 'FileReader').and.returnValue(mockFileReader as any);

      const result = await component.fileToBase64(mockFile);

      expect(result).toBe('dGVzdCBjb250ZW50');
      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('AI Classification', () => {
    beforeEach(() => {
      // Mock global fetch
      spyOn(window, 'fetch').and.returnValue(Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  tipo_comprobante: 'factura',
                  numero_comprobante: '001-123',
                  fecha_emision: '2023-12-25',
                  cuit_emisor: '20123456789',
                  confidence: 0.95
                })
              }]
            }
          }]
        })
      } as any));

      // Mock fileToBase64
      spyOn(component, 'fileToBase64').and.returnValue(Promise.resolve('base64data'));

      // Mock download functionality
      spyOn(document, 'createElement').and.returnValue({
        click: jasmine.createSpy('click'),
        remove: jasmine.createSpy('remove')
      } as any);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
      spyOn(URL, 'revokeObjectURL');
      spyOn(document.body, 'appendChild');
    });

    it('should classify PDF with AI successfully', async () => {
      const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      component.file.set(mockFile);

      await component.classifyWithAI();

      expect(component.isProcessing()).toBeFalse();
      expect(component.error()).toBeNull();
      expect(component.extractedData()).toEqual(jasmine.objectContaining({
        tipo_comprobante: 'factura',
        numero_comprobante: '001-123',
        fecha_emision: '2023-12-25',
        cuit_emisor: '20123456789',
        confidence: 0.95
      }));
      expect(component.form.type).toBe('factura');
      expect(component.form.dateISO).toBe('2023-12-25');
      expect(component.form.docNumber).toBe('001-123');
      expect(component.form.cuit).toBe('20123456789');
    });

    it('should handle missing file', async () => {
      component.file.set(null);

      await component.classifyWithAI();

      expect(component.error()).toBe('Seleccioná un PDF primero');
      expect(component.isProcessing()).toBeFalse();
    });

    it('should handle API errors', async () => {
      const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      component.file.set(mockFile);

      (window.fetch as jasmine.Spy).and.returnValue(Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error')
      } as any));

      await component.classifyWithAI();

      expect(component.error()).toBe('Server Error');
      expect(component.isProcessing()).toBeFalse();
    });
  });

  describe('Sidebar Integration', () => {
    it('should toggle sidebar', () => {
      component.toggleSidebar();
      expect(mockUtilService.toggleSidebarState).toHaveBeenCalled();
    });
  });

  describe('Component Integration', () => {
    it('should have proper service dependencies', () => {
      expect(component.utilService).toBe(mockUtilService);
    });

    it('should maintain reactive state', () => {
      // Test that signals are properly reactive
      expect(component.file()).toBeNull();
      
      const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      component.file.set(mockFile);
      
      expect(component.file()).toBe(mockFile);
    });
  });
});
