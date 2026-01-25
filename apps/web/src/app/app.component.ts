import { Component } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule],
  template: `
    <div class="app-container">
      <header class="app-header">
        <h1>Spectyra</h1>
        <nav>
          <a routerLink="/scenarios">Scenarios</a>
          <a routerLink="/savings">Savings</a>
          <a routerLink="/runs">Runs History</a>
          <a routerLink="/settings">Settings</a>
        </nav>
      </header>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .app-header {
      background: #007bff;
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .app-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .app-header nav {
      display: flex;
      gap: 20px;
    }
    .app-header nav a {
      color: white;
      text-decoration: none;
      font-weight: 500;
    }
    .app-header nav a:hover {
      text-decoration: underline;
    }
    .app-main {
      flex: 1;
      padding: 20px;
    }
  `],
})
export class AppComponent {
}
