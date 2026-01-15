import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getAnalytics, provideAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes), provideFirebaseApp(() => initializeApp({ apiKey: "AIzaSyCIUFxsvGOKLfXIfmlZKLb0BLeH_XNd7qU",
  authDomain: "app-turnos-qe.firebaseapp.com",
  projectId: "app-turnos-qe",
  storageBucket: "app-turnos-qe.firebasestorage.app",
  messagingSenderId: "905317667399",
  appId: "1:905317667399:web:c5f90006d1e969c08d5762",
  measurementId: "G-QBTHE2CERS" })), provideAuth(() => getAuth()), provideAnalytics(() => getAnalytics()), ScreenTrackingService, UserTrackingService, provideFirestore(() => getFirestore())
  ]
};
