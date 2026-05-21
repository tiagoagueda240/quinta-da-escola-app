import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-politica-privacidade',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './politica-privacidade.html',
  styleUrls: ['./politica-privacidade.scss'],
})
export class PoliticaPrivacidadeComponent {}
