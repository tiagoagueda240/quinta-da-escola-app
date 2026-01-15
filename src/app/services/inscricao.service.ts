import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } from '@angular/fire/firestore';
import { HttpClient } from '@angular/common/http'; // Importar HTTP
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Inscricao } from '../models/inscricao.model';

@Injectable({
  providedIn: 'root'
})
export class InscricaoService {
  private firestore: Firestore = inject(Firestore);
  private http: HttpClient = inject(HttpClient);
  private collectionName = 'inscricoes';

  constructor() {}

  // --- 1. ADICIONAR COM EMAIL ---
  async addInscricao(inscricao: Inscricao) {
    // 1. Grava na Base de Dados (Firebase)
    const colRef = collection(this.firestore, this.collectionName);
    const docRef = await addDoc(colRef, inscricao);
    
    // 2. Dispara o Email Seguro (PHP + Brevo)
    this.enviarEmailSeguro(inscricao);
    
    return docRef;
  }

  // --- 2. FUNÇÃO DE ENVIO ---
  enviarEmailSeguro(dados: Inscricao) {
    // ATENÇÃO: Substitui pelo link REAL do teu site onde puseste o PHP
    // Exemplo: 'https://aminhacolonia.pt/api/send-email.php'
    const url = 'https://turnos.quintadaescola.com/send-email.php'; 

    const payload = {
      nome: dados.ee.nome,
      email: dados.ee.email,
      turno: dados.turnoEscolhido,
      valor: dados.valorTotal
    };

    // Envia o pedido para o teu PHP
    this.http.post(url, payload).subscribe({
      next: (res) => console.log('Email enviado com sucesso via PHP!', res),
      error: (err) => console.error('Erro ao enviar email:', err)
    });
  }

  // --- OUTROS MÉTODOS (Get, Update, Delete) ---
  getInscricoes(): Observable<Inscricao[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, orderBy('dataCriacao', 'desc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((dados: any[]) => {
        return dados.map(item => {
          if (item.participante?.dataNascimento instanceof Timestamp) {
            item.participante.dataNascimento = item.participante.dataNascimento.toDate();
          }
          if (item.dataCriacao instanceof Timestamp) {
            item.dataCriacao = item.dataCriacao.toDate();
          }
          return item as Inscricao;
        });
      })
    ) as Observable<Inscricao[]>;
  }

  updateInscricao(id: string, dados: Partial<Inscricao>) {
    const docRef = doc(this.firestore, this.collectionName, id);
    return updateDoc(docRef, dados);
  }

  deleteInscricao(id: string) {
    const docRef = doc(this.firestore, this.collectionName, id);
    return deleteDoc(docRef);
  }
}