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
  validando = signal(false);

  constructor(
    private readonly sesion: SesionService,
    private readonly router: Router
  ) {
    if (this.sesion.suspendido()) {
      this.error.set('Tu acceso fue suspendido — inténtalo de nuevo más tarde.');
      this.sesion.suspendido.set(false);
    }
  }

  async onIngresar(): Promise<void> {
    if (this.validando()) return;

    const usuario = this.usuario().trim();
    const contrasena = this.contrasena();

    if (!usuario || !contrasena) {
      this.error.set('Ingresa usuario y contraseña');
      return;
    }

    this.error.set('');
    this.validando.set(true);

    try {
      const respuesta = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, contrasena }),
      });
      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        this.error.set(datos.error || 'Usuario o contraseña incorrectos');
        return;
      }

      this.sesion.iniciarSesion(usuario);
      this.router.navigateByUrl('/juego');
    } catch {
      this.error.set('No se pudo verificar el acceso — revisa tu conexión e intenta de nuevo');
    } finally {
      this.validando.set(false);
    }
  }
}
