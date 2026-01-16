import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HiddenMenuComponent } from './components/hidden-menu/hidden-menu';
import { AuthService } from './services/auth.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HiddenMenuComponent, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',

})
export class App {
  public authService = inject(AuthService);
  protected readonly title = signal('quinta-da-escola-app');
}
