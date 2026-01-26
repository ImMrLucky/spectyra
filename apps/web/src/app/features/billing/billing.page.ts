import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Billing</h1>
      <p class="subtitle">Manage your subscription and billing</p>
      
      <div class="placeholder">
        <p>Billing management coming in Phase 5.</p>
        <p>7-day trial and subscription gating will be available here.</p>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .subtitle {
      color: #666;
      font-size: 16px;
      margin-bottom: 30px;
    }
    .placeholder {
      background: #f5f5f5;
      border: 1px dashed #ddd;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      color: #666;
    }
  `],
})
export class BillingPage implements OnInit {
  ngOnInit() {
    // Placeholder for Phase 5
  }
}
