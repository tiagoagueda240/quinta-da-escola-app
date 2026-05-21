import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CookieBannerComponent } from './components/cookie-banner/cookie-banner';
import { HiddenMenuComponent } from './components/hidden-menu/hidden-menu';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HiddenMenuComponent, AsyncPipe, CookieBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  public authService = inject(AuthService);
  protected readonly title = signal('quinta-da-escola-app');
}
