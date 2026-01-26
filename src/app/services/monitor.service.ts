import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Monitor } from '../models/monitor.model';

@Injectable({
  providedIn: 'root'
})
export class MonitorService {
  private firestore = inject(Firestore);
  private colName = 'monitores';

  getMonitores(): Observable<Monitor[]> {
    const colRef = collection(this.firestore, this.colName);
    const q = query(colRef, orderBy('nome'));
    return collectionData(q, { idField: 'id' }) as Observable<Monitor[]>;
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
}