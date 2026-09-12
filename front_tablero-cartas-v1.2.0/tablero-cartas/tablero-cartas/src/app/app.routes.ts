import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Tablero } from './components/tablero/tablero';
import { authGuard, soloInvitadosGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [soloInvitadosGuard] },
  { path: 'juego', component: Tablero, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'juego' },
  { path: '**', redirectTo: '' },
];
