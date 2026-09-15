import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VERSION, VERSION_NOTA } from './version';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly version = VERSION;

  constructor() {
    console.log(`%cRaceDinos — v${VERSION}`, 'font-weight: bold; color: #FFD23F;');
    console.log(VERSION_NOTA);
  }
}
