import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Projects</h1>
      <p class="subtitle">Organize your AI Gateway usage by project</p>
      
      <div class="placeholder">
        <p>Project management coming soon.</p>
        <p>Organize your integrations and track savings by project.</p>
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
export class ProjectsPage implements OnInit {
  ngOnInit() {
    // Placeholder for future implementation
  }
}
