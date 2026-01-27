import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ModalData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="modal-content">
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <div mat-dialog-content>
        <p>{{ data.message }}</p>
        <ng-content></ng-content>
      </div>
      <div mat-dialog-actions>
        <button 
          *ngIf="data.showCancel !== false" 
          mat-button 
          (click)="onCancel()"
          class="btn-secondary">
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button 
          mat-button 
          (click)="onConfirm()"
          [mat-dialog-close]="true"
          class="btn-primary">
          {{ data.confirmText || 'OK' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .modal-content {
      padding: 0;
    }
    h2[mat-dialog-title] {
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 600;
    }
    div[mat-dialog-content] {
      margin: 0 0 24px 0;
      min-width: 300px;
    }
    div[mat-dialog-actions] {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin: 0;
      padding: 0;
    }
    .btn-primary {
      background-color: #007bff;
      color: white;
    }
    .btn-secondary {
      background-color: #6c757d;
      color: white;
    }
  `]
})
export class ModalComponent {
  @Input() data!: ModalData;

  constructor(public dialogRef: MatDialogRef<ModalComponent>) {}

  onConfirm() {
    this.dialogRef.close(true);
  }

  onCancel() {
    this.dialogRef.close(false);
  }
}
