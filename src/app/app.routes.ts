import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/invoiceai',
    pathMatch: 'full'
  },
  {
    path: 'invoiceai',
    loadComponent: () => import('./pages/docai/docai-v2').then(m => m.DocAIV2)
  },
  // V1 temporalmente oculto - descomentar si es necesario
  // {
  //   path: 'oda-invoice-v1',
  //   loadComponent: () => import('./pages/docai/docai').then(m => m.DocAI)
  // },
  {
    path: '**',
    redirectTo: '/invoiceai'
  }
];
