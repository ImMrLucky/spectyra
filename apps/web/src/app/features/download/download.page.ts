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
  /** Squirrel / NSIS-style installer */
  windowsInstallerUrl: string | null = null;
  /** Extract-and-run zip (no installer) */
  windowsPortableUrl: string | null = null;

  openClawMacUrl: string | null = null;
  openClawWindowsInstallerUrl: string | null = null;
  openClawWindowsPortableUrl: string | null = null;

  constructor(private meService: MeService) {}

  async ngOnInit() {
    try {
      const me = await firstValueFrom(this.meService.getMe());
      const d = me?.desktop_downloads;
      this.macUrl = d?.mac_url || null;
      this.windowsInstallerUrl = d?.windows_url || null;
      this.windowsPortableUrl = d?.windows_zip_url || null;

      const o = me?.openclaw_desktop_downloads;
      this.openClawMacUrl = o?.mac_url || null;
      this.openClawWindowsInstallerUrl = o?.windows_url || null;
      this.openClawWindowsPortableUrl = o?.windows_zip_url || null;
    } catch {
      // Static asset URLs still work without /me
    }

    const fb = environment.desktopDownloadsFallback;
    const so = environment.desktopDownloadsSameOrigin;
    const ofb = environment.openclawDesktopDownloadsFallback;
    const oso = environment.openclawDesktopDownloadsSameOrigin;
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';

    if (!this.macUrl) {
      this.macUrl =
        fb.macUrl || (so?.macPath && so.macPath.length > 0 && origin ? origin + so.macPath : null);
    }
    if (!this.windowsInstallerUrl) {
      this.windowsInstallerUrl =
        fb.windowsUrl ||
        (so?.windowsInstallerPath && so.windowsInstallerPath.length > 0 && origin
          ? origin + so.windowsInstallerPath
          : null);
    }
    if (!this.windowsPortableUrl) {
      this.windowsPortableUrl =
        fb.windowsZipUrl ||
        (so?.windowsPortablePath && so.windowsPortablePath.length > 0 && origin
          ? origin + so.windowsPortablePath
          : null);
    }

    if (!this.openClawMacUrl) {
      this.openClawMacUrl =
        ofb.macUrl ||
        (oso?.macPath && oso.macPath.length > 0 && origin ? origin + oso.macPath : null);
    }
    if (!this.openClawWindowsInstallerUrl) {
      this.openClawWindowsInstallerUrl =
        ofb.windowsUrl ||
        (oso?.windowsInstallerPath && oso.windowsInstallerPath.length > 0 && origin
          ? origin + oso.windowsInstallerPath
          : null);
    }
    if (!this.openClawWindowsPortableUrl) {
      this.openClawWindowsPortableUrl =
        ofb.windowsZipUrl ||
        (oso?.windowsPortablePath && oso.windowsPortablePath.length > 0 && origin
          ? origin + oso.windowsPortablePath
          : null);
    }

    this.loading = false;
  }

  get hasAnyDownload(): boolean {
    return !!(this.macUrl || this.windowsInstallerUrl || this.windowsPortableUrl);
  }

  get hasAnyOpenClawDownload(): boolean {
    return !!(
      this.openClawMacUrl ||
      this.openClawWindowsInstallerUrl ||
      this.openClawWindowsPortableUrl
    );
  }
}
