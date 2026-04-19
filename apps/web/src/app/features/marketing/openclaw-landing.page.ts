import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-openclaw-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './openclaw-landing.page.html',
  styleUrls: ['./openclaw-landing.page.scss'],
})
export class OpenClawLandingPage {}
