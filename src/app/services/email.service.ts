import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private readonly SERVICE_ID = 'service_xxxxxxxxx'; // Tu Service ID de EmailJS
  private readonly TEMPLATE_ID = 'template_xxxxxxx'; // Tu Template ID de EmailJS
  private readonly PUBLIC_KEY = 'XXXXXXXXXXXXX';     // Tu Public Key de EmailJS

  constructor() {
    emailjs.init(this.PUBLIC_KEY);
  }

  async enviarEmail(asunto: string, cuerpo: string, destinatario: string): Promise<void> {
    try {
      const templateParams = {
        to_email: destinatario,
        subject: asunto,
        message: cuerpo
      };

      await emailjs.send(
        this.SERVICE_ID,
        this.TEMPLATE_ID,
        templateParams
      );
      
      console.log('✅ Email enviado correctamente');
    } catch (error) {
      console.error('❌ Error al enviar email:', error);
      throw error;
    }
  }
}