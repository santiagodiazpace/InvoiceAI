import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocAI } from './docai';
import { DocAIV2 } from './docai-v2';

@Component({
  selector: 'app-docai-container',
  standalone: true,
  imports: [CommonModule, DocAI, DocAIV2],
  template: `
    <div class="p-4 md:p-8 min-h-screen bg-gradient-to-br from-background via-background to-background/90">
      <!-- Logo Responsivo -->
      <div class="absolute top-4 left-4 md:top-16 md:left-16">
        <h2 class="text-xl md:text-2xl font-bold text-white">ODA Invoice</h2>
      </div>
      
      <!-- Header Principal Responsivo -->
      <div class="text-center mb-6 md:mb-8 pt-16 md:pt-0">
        <h1 class="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4 gradient-text px-4">Centro de Procesamiento</h1>
        <p class="text-sm md:text-lg text-white/70 max-w-2xl mx-auto px-4">
          Procesamiento inteligente de facturas con IA
        </p>
      </div>

      <!-- Tabs Responsivos -->
      <div class="flex justify-center mb-6 md:mb-8 px-4">
        <div class="tabs-container">
          <!-- TEMPORALMENTE OCULTO V1 -->
          <!-- <button 
            (click)="activeTab = 'v1'"
            [class.active-tab]="activeTab === 'v1'"
            [class.inactive-tab]="activeTab !== 'v1'"
            class="tab-button"
          >
            <span class="hidden sm:inline">📄 ODA Invoice V1 (Clásico)</span>
            <span class="sm:hidden">📄 V1</span>
          </button> -->
          <button 
            (click)="activeTab = 'v2'"
            [class.active-tab]="activeTab === 'v2'"
            [class.inactive-tab]="activeTab !== 'v2'"
            class="tab-button"
          >
            <span class="hidden sm:inline">🚀 ODA Invoice (Principal)</span>
            <span class="sm:hidden">🚀 Principal</span>
          </button>
        </div>
      </div>

      <!-- Content -->
      @switch (activeTab) {
        @case ('v1') {
          <app-docai></app-docai>
        }
        @case ('v2') {
          <app-oda-invoice></app-oda-invoice>
        }
      }
    </div>
  `,
  styles: [`
    .bg-slate-900 {
      background: linear-gradient(135deg, #0b000c 0%, #1a0006 50%, #0b000c 100%);
    }
    
    /* Gradient text */
    .gradient-text {
      background: linear-gradient(to right, #ff1f43, #ff4757);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    /* Tabs container */
    .tabs-container {
      display: flex;
      background: rgba(11, 0, 12, 0.6);
      backdrop-filter: blur(10px);
      border-radius: 0.75rem;
      padding: 0.25rem;
      border: 1px solid rgba(255, 31, 67, 0.2);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-width: 100%;
      overflow: hidden;
    }
    
    /* Tab buttons */
    .tab-button {
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      font-weight: 500;
      transition: all 0.3s ease;
      border: 1px solid transparent;
      font-size: 0.875rem;
      white-space: nowrap;
      flex: 1;
      text-align: center;
    }
    
    @media (min-width: 640px) {
      .tab-button {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        flex: initial;
      }
    }
    
    .active-tab {
      background: linear-gradient(to right, #ff1f43, #e50914);
      color: white;
      box-shadow: 0 10px 15px -3px rgba(255, 31, 67, 0.25);
    }
    
    .inactive-tab {
      color: rgba(255, 255, 255, 0.6);
    }
    
    .inactive-tab:hover {
      color: white;
      background: rgba(255, 31, 67, 0.1);
    }
  `]
})
export class DocAIContainer {
  activeTab: 'v1' | 'v2' = 'v2';
}
