import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

declare function gtag(...args: any[]): void;

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './cookie-banner.html',
  styleUrls: ['./cookie-banner.scss'],
})
export class CookieBannerComponent implements OnInit {
  visible = false;
  showDetails = false;

  private readonly CONSENT_KEY = 'cookie_consent';

  ngOnInit(): void {
    const saved = localStorage.getItem(this.CONSENT_KEY);
    if (!saved) {
      // this.visible = true; // TODO: reativar banner de cookies
      this.updateGtag('denied');
    } else {
      const choice = JSON.parse(saved);
      this.updateGtag(choice.analytics ? 'granted' : 'denied');
    }
  }

  acceptAll(): void {
    this.saveConsent(true);
    this.updateGtag('granted');
    this.visible = false;
  }

  rejectOptional(): void {
    this.saveConsent(false);
    this.updateGtag('denied');
    this.visible = false;
  }

  private saveConsent(analytics: boolean): void {
    localStorage.setItem(
      this.CONSENT_KEY,
      JSON.stringify({ analytics, timestamp: new Date().toISOString() }),
    );
  }

  private updateGtag(analyticsState: 'granted' | 'denied'): void {
    if (typeof gtag !== 'undefined') {
      gtag('consent', 'update', {
        analytics_storage: analyticsState,
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    }
  }
}
