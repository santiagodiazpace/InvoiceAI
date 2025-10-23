import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import AOS from 'aos';
import { SplashService } from './services/splash-service.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected title = 'ODA Invoice';
  protected isDarkMode = false;
  
  // Inyectar el splash service para que se inicialice
  private splashService = inject(SplashService);

  ngOnInit() {
    this.configDarkMode();
    this.updateDarkModeClass();
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: false, // solo se anima una vez
    });
  }


  configDarkMode() {
    // Detecta si el sistema está en modo oscuro
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Si el usuario ya eligió un modo antes, respetalo
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    } else {
      this.isDarkMode = prefersDark;
    }
  }

  updateDarkModeClass(): void {
    const html = document.documentElement;
    if (this.isDarkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }
}
