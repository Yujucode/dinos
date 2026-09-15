import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SesionService } from '../../services/sesion';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  usuario = signal('');
  contrasena = signal('');
  error = signal('');

  constructor(
    private readonly sesion: SesionService,
    private readonly router: Router
  ) {}

  onIngresar(): void {
    const usuario = this.usuario().trim();
    const contrasena = this.contrasena();

    if (!usuario || !contrasena) {
      this.error.set('Ingresa usuario y contraseña');
      return;
    }

    // TODO: cuando exista el backend, aquí se llama al endpoint
    // /auth/login (ASP.NET Core Web API) con { usuario, contrasena },
    // se guarda el JWT recibido, y recién ahí se inicia sesión.
    this.error.set('');
    this.sesion.iniciarSesion(usuario);
    this.router.navigateByUrl('/juego');
  }
}
