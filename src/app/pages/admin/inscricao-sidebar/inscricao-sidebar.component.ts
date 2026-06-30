import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Inscricao } from '../../../models/inscricao.model';

@Component({
  selector: 'app-inscricao-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    DatePipe,
  ],
  templateUrl: './inscricao-sidebar.component.html',
  styleUrls: ['./inscricao-sidebar.component.scss'],
})
export class InscricaoSidebarComponent {
  @Input() inscricao: Inscricao | null = null;
  @Input() isOpen = false;
  @Input() isEditing = false;
  @Input() isCreating = false;
  @Input() filtroLocal: 'quinta' | 'costaCaparica' | 'quiaios' = 'quinta';
  @Input() listaTurnos: string[] = [];
  @Input() opcoesTransporte: ReadonlyArray<{ label: string }> = [];

  @Output() fechado = new EventEmitter<void>();
  @Output() ativarEdicao = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();
  @Output() togglePagamento = new EventEmitter<Inscricao>();
  @Output() apagar = new EventEmitter<string>();
  @Output() reenviarEmail = new EventEmitter<Inscricao>();
  @Output() abrirWhatsApp = new EventEmitter<string>();
}
