import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, getDocs, addDoc, doc,
  updateDoc, deleteDoc, query, orderBy, writeBatch,
  where, limit, startAt, endAt,
  collectionData,
  startAfter,
  QueryDocumentSnapshot
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Monitor } from '../models/monitor.model';

@Injectable({
  providedIn: 'root'
})
export class MonitorService {
  private firestore = inject(Firestore);
  private colName = 'monitores';

  /**
   * NIVEL 3: Obtém monitores de forma pontual (One-time fetch)
   * Permite pesquisar por nome diretamente no Firebase e limita a 50 resultados.
   */
  async getMonitoresOtimizados(termoPesquisa: string = '', limite: number = 50): Promise<Monitor[]> {
    const colRef = collection(this.firestore, this.colName);
    let q;

    if (termoPesquisa) {
      // Truque do Firestore para "começa com": usa o range Unicode \uf8ff
      q = query(
        colRef,
        orderBy('nome'),
        startAt(termoPesquisa),
        endAt(termoPesquisa + '\uf8ff'),
        limit(limite)
      );
    } else {
      q = query(colRef, orderBy('nome'), limit(limite));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Monitor));
  }

  /**
   * Gravação em Batch: Envia todas as alterações do Excel de uma só vez.
   * Evita picos de escrita e notificações desnecessárias.
   */
  async saveBulkMonitores(lista: Monitor[]) {
    const batch = writeBatch(this.firestore);
    const colRef = collection(this.firestore, this.colName);

    lista.forEach(m => {
      if (m.id) {
        const docRef = doc(this.firestore, this.colName, m.id);
        const { id, ...dados } = m;
        batch.update(docRef, dados);
      } else {
        const newDocRef = doc(colRef);
        batch.set(newDocRef, m);
      }
    });

    return await batch.commit();
  }

  addMonitor(monitor: Monitor) {
    const colRef = collection(this.firestore, this.colName);
    return addDoc(colRef, monitor);
  }

  updateMonitor(id: string, data: Partial<Monitor>) {
    const docRef = doc(this.firestore, this.colName, id);
    return updateDoc(docRef, data);
  }

  deleteMonitor(id: string) {
    const docRef = doc(this.firestore, this.colName, id);
    return deleteDoc(docRef);
  }

  getMonitores(): Observable<Monitor[]> {
    const colRef = collection(this.firestore, this.colName);
    const q = query(colRef, orderBy('nome'));
    return collectionData(q, { idField: 'id' }) as Observable<Monitor[]>;
  }

  async getMonitoresPaginados(termo: string = '', limite: number = 10, proximoDe?: QueryDocumentSnapshot<any>) {
    const colRef = collection(this.firestore, this.colName);
    let q;

    // Criamos a base da query
    const constraints: any[] = [orderBy('nome'), limit(limite)];

    if (termo) {
      constraints.push(startAt(termo), endAt(termo + '\uf8ff'));
    }

    // Se quisermos a "próxima página", começamos depois do último documento da anterior
    if (proximoDe) {
      constraints.push(startAfter(proximoDe));
    }

    q = query(colRef, ...constraints);
    const snapshot = await getDocs(q);

    return {
      dados: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Monitor)),
      ultimoDoc: snapshot.docs[snapshot.docs.length - 1] // Guardamos a âncora
    };
  }
}