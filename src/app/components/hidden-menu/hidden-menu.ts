import { Component, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-hidden-menu',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './hidden-menu.html',
  styleUrl: './hidden-menu.scss'
})
export class HiddenMenuComponent {
  isOpen = false;
  
  private router = inject(Router);
  private authService = inject(AuthService);
  private eRef = inject(ElementRef);

  toggleMenu() {
    this.isOpen = !this.isOpen;
  }

  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  async logout() {
    this.isOpen = false;
      await this.authService.logout();
  }

  navegar(rota: string) {
    this.isOpen = false;
    this.router.navigate([rota]);
  }
}