import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, inject } from '@angular/core';
import {  Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class SplashService {


  constructor(@Inject(DOCUMENT) private _document: any) {
    this.appInitializer();
  }

  /**
 * Show the splash screen
 */
  show(): void {
    let element = this._document.body.getElementsByClassName('splashScreen')[0];
    element.classList.add('splashShow');
    element.classList.remove('splashHide');
    document.body.classList.add('no-scrollbar');
  }

  /**
   * Hide the splash screen
   */
  hide(): void {
    let element = this._document.body.getElementsByClassName('splashScreen')[0];
    element.classList.add('splashHide');
    element.classList.remove('splashShow');
    document.body.classList.remove('no-scrollbar');
  }

  /**
   * Sirve para mostrar el Splash Screen
   */
  appInitializer() {
    this.show();
    
    // Timeout principal de 1.5 segundos
    const mainTimeout = setTimeout(() => {
      this.hide();
      clearTimeout(fallbackTimeout); // Cancelar fallback si ya se ejecutó
    }, 1500);
    
    // Fallback de 4 segundos por si no desaparece
    const fallbackTimeout = setTimeout(() => {
      console.log('🚨 Splash fallback ejecutado - forzando cierre');
      this.hide();
      clearTimeout(mainTimeout); // Cancelar principal si ya se ejecutó
    }, 4000);
  }
}
