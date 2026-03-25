import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MeService } from '../../core/services/me.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './download.page.html',
  styleUrls: ['./download.page.scss'],
})
export class DownloadPage implements OnInit {
  loading = true;
  error: string | null = null;
  macUrl: string | null = null;
  windowsUrl: string | null = null;

  constructor(private meService: MeService) {}

  async ngOnInit() {
    try {
      const me = await firstValueFrom(this.meService.getMe());
      const d = me?.desktop_downloads;
      const fb = environment.desktopDownloadsFallback;
      this.macUrl = d?.mac_url || fb.macUrl || null;
      this.windowsUrl = d?.windows_url || fb.windowsUrl || null;
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Could not load download links.';
    } finally {
      this.loading = false;
    }
  }

  get hasAnyDownload(): boolean {
    return !!(this.macUrl || this.windowsUrl);
  }
}
