import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  constructor(
    private router: Router,
    private supabase: SupabaseService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Redirect authenticated users to Overview
    combineLatest([
      this.supabase.getSession(),
      this.authService.authState
    ]).pipe(
      map(([session, authState]) => {
        const isAuthenticated = !!session || !!authState.apiKey;
        if (isAuthenticated) {
          this.router.navigate(['/overview']);
        }
      })
    ).subscribe();
  }
}
