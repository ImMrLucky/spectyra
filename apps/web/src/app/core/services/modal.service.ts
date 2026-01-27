import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ModalComponent, ModalData } from '../../components/modal.component';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  constructor(private dialog: MatDialog) {}

  confirm(data: ModalData): Observable<boolean> {
    const dialogRef = this.dialog.open(ModalComponent, {
      width: '400px',
      data,
    });
    return dialogRef.afterClosed();
  }

  showInfo(title: string, message: string): Observable<boolean> {
    return this.confirm({
      title,
      message,
      confirmText: 'OK',
      showCancel: false,
    });
  }

  showDetails(title: string, content: string): Observable<boolean> {
    return this.confirm({
      title,
      message: content,
      confirmText: 'Close',
      showCancel: false,
    });
  }
}
