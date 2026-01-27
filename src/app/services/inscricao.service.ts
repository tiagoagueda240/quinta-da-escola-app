import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, writeBatch, getDoc } from '@angular/fire/firestore';
import { HttpClient } from '@angular/common/http';
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

  constructor() { }

  async addInscricao(inscricao: Inscricao) {
    const colRef = collection(this.firestore, this.collectionName);

    // Converte para objeto simples para evitar problemas com classes/protótipos
    const dadosParaGuardar = JSON.parse(JSON.stringify(inscricao));

    // O JSON.stringify corrompe datas, por isso repomos as datas manualmente
    dadosParaGuardar.dataCriacao = inscricao.dataCriacao;
    dadosParaGuardar.participante.dataNascimento = inscricao.participante.dataNascimento;

    const docRef = await addDoc(colRef, dadosParaGuardar);
    this.enviarEmailSeguro(inscricao);
    return docRef;
  }

  enviarEmailSeguro(dados: Inscricao) {
    const url = 'https://turnos.quintadaescola.com/send-email.php';

    const payload = {
      nome: dados.ee.nome,
      email: dados.ee.email,
      turno: dados.turnoEscolhido,
      valor: dados.valorTotal
    };

    this.http.post(url, payload).subscribe({
      next: (res) => console.log('Email enviado com sucesso!', res),
      error: (err) => console.error('Erro ao enviar email:', err)
    });
  }

  async updateBatch(updates: { id: string, data: any }[]) {
    const batch = writeBatch(this.firestore);

    updates.forEach(item => {
      const docRef = doc(this.firestore, this.collectionName, item.id);
      batch.update(docRef, item.data);
    });

    return batch.commit();
  }

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

  async getConfiguracoesTurnos(): Promise<any> {
    const docRef = doc(this.firestore, 'configuracoes', 'turnos');
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }
}