import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { MediaSession } from '@jofr/capacitor-media-session';

type Track = { id: string; name: string; url: string; blob: Blob; mime: string };
type StoredTrack = { id: string; name: string; blob: Blob; mime: string; addedAt: number };

const DB_NAME = 'winamp-offline-library';
const STORE_NAME = 'tracks';

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la biblioteca local.'));
  });
}

async function storeTrack(track: StoredTrack): Promise<void> {
  const db = await openLibrary();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(track);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar la canción.'));
    tx.onabort = () => reject(tx.error ?? new Error('Se canceló el guardado.'));
  });
  db.close();
}

async function readTracks(): Promise<StoredTrack[]> {
  const db = await openLibrary();
  const result = await new Promise<StoredTrack[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as StoredTrack[]).sort((a, b) => a.addedAt - b.addedAt));
    request.onerror = () => reject(request.error ?? new Error('No se pudo leer la biblioteca.'));
  });
  db.close();
  return result;
}

async function deleteStoredTrack(id: string): Promise<void> {
  const db = await openLibrary();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo eliminar la canción.'));
  });
  db.close();
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, IonicModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
<div class="screen">
  <main class="player">
    <header class="top">
      <div class="brand"><span class="logo">♫</span><div><strong>WINAMP</strong><small>OFFLINE PLAYER</small></div></div>
      <span class="pill"><span class="status-dot"></span> SIN ANUNCIOS</span>
    </header>
    <section class="display">
      <div class="eyebrow">REPRODUCIENDO AHORA</div>
      <div class="art"><div class="disc" [class.spinning]="playing"><div class="disc-core">♫</div></div></div>
      <h1>{{ current?.name || 'Tu música, a tu manera' }}</h1>
      <p class="sub">{{ current ? 'ARCHIVO LOCAL · OFFLINE' : 'Agrega canciones para comenzar' }}</p>
      <div class="progress"><span>{{ elapsed }}</span><input aria-label="Posición de reproducción" type="range" min="0" [max]="duration || 100" [value]="position" (input)="seek($event)"><span>{{ total }}</span></div>
      <audio #audio preload="metadata" (timeupdate)="onTime()" (loadedmetadata)="onTime()" (ended)="next()" (play)="onAudioPlay()" (pause)="onAudioPause()"></audio>
      <div class="controls">
        <button aria-label="Anterior" title="Anterior" (click)="previous()">|◀</button>
        <button class="play" aria-label="Reproducir o pausar" (click)="toggle()">{{ playing ? 'Ⅱ' : '▶' }}</button>
        <button aria-label="Siguiente" title="Siguiente" (click)="next()">▶|</button>
      </div>
      <div class="extra-controls"><button (click)="shuffle = !shuffle" [class.selected]="shuffle">⤨ Aleatorio</button><button (click)="repeat = !repeat" [class.selected]="repeat">↻ Repetir</button></div>
      <div class="visualizer" aria-hidden="true"><i *ngFor="let bar of bars" [style.height.px]="playing ? bar : 4"></i></div>
    </section>
    <section class="library">
      <div class="library-head"><div><h2>Mi biblioteca</h2><p>{{ tracks.length }} canción(es) guardadas en este dispositivo</p></div>
        <label class="add">＋ Importar<input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac" multiple (change)="addFiles($event)"></label>
      </div>
      <p class="notice" *ngIf="message" role="status">{{ message }}</p>
      <div class="empty" *ngIf="!tracks.length"><div class="empty-icon">♫</div><strong>Tu biblioteca está esperando</strong><p>Importa archivos de música. Se guardan dentro de la biblioteca de la app y estarán disponibles sin Internet, incluso después de cerrarla.</p></div>
      <div class="track-row" *ngFor="let track of tracks; let i = index" [class.active]="current?.id === track.id">
        <button class="track" (click)="playTrack(i)" [attr.aria-label]="'Reproducir ' + track.name"><span class="track-icon">♫</span><span class="track-name"><b>{{ track.name }}</b><small>GUARDADA EN ESTE DISPOSITIVO</small></span><span class="track-state">{{ current?.id === track.id && playing ? '♫' : '▶' }}</span></button>
        <button class="remove" (click)="removeTrack(i)" [attr.aria-label]="'Eliminar ' + track.name" title="Eliminar de la biblioteca">×</button>
      </div>
    </section>
    <footer>LOCAL · SIN CUENTA · SIN STREAMING · SIN PUBLICIDAD INTEGRADA</footer>
  </main>
</div>`
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('audio', { static: true }) audioRef!: ElementRef<HTMLAudioElement>;
  tracks: Track[] = [];
  index = -1;
  playing = false;
  position = 0;
  duration = 0;
  elapsed = '0:00';
  total = '0:00';
  shuffle = false;
  repeat = false;
  message = '';
  private mediaHandlersReady = false;
  bars = [9, 20, 14, 30, 17, 25, 11, 34, 21, 13, 29, 18, 37, 16, 24, 10, 31, 19, 27, 12, 35, 17, 23, 8];

  get current(): Track | null { return this.index >= 0 ? this.tracks[this.index] ?? null : null; }

  async ngAfterViewInit(): Promise<void> {
    await this.restoreLibrary();
    this.configureMediaSession();
  }

  ngOnDestroy(): void {
    for (const track of this.tracks) URL.revokeObjectURL(track.url);
  }

  private async restoreLibrary(): Promise<void> {
    try {
      const saved = await readTracks();
      this.tracks = saved.map(item => ({ id: item.id, name: item.name, blob: item.blob, mime: item.mime, url: URL.createObjectURL(item.blob) }));
      if (this.tracks.length) this.message = 'Biblioteca restaurada. Tus canciones están disponibles sin conexión.';
    } catch {
      this.message = 'No se pudo leer el almacenamiento local. Prueba cerrar y abrir la aplicación.';
    }
  }

  async addFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    let added = 0;
    for (const file of files) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name)) continue;
      const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const name = file.name.replace(/\.[^.]+$/, '');
      try {
        await storeTrack({ id, name, blob: file, mime: file.type || 'audio/mpeg', addedAt: Date.now() + added });
        this.tracks.push({ id, name, blob: file, mime: file.type || 'audio/mpeg', url: URL.createObjectURL(file) });
        added++;
      } catch {
        this.message = 'No se pudo guardar el archivo. Puede faltar espacio disponible en el dispositivo.';
      }
    }
    if (added) {
      this.message = `${added} canción(es) guardadas para escuchar sin Internet.`;
      if (this.index < 0) await this.playTrack(0);
    } else if (!this.message) {
      this.message = 'No se importaron canciones. Elige archivos de audio compatibles.';
    }
    input.value = '';
  }

  async removeTrack(i: number): Promise<void> {
    const removed = this.tracks[i];
    if (!removed) return;
    const wasCurrent = this.index === i;
    if (wasCurrent) this.audioRef.nativeElement.pause();
    try {
      await deleteStoredTrack(removed.id);
      URL.revokeObjectURL(removed.url);
      this.tracks.splice(i, 1);
      if (!this.tracks.length) {
        this.index = -1;
        this.audioRef.nativeElement.removeAttribute('src');
        this.audioRef.nativeElement.load();
        this.playing = false;
      } else if (wasCurrent) {
        this.index = Math.min(i, this.tracks.length - 1);
        await this.playTrack(this.index);
      } else if (i < this.index) {
        this.index--;
      }
      this.message = 'Canción eliminada de la biblioteca de la app.';
    } catch {
      this.message = 'No se pudo eliminar la canción del almacenamiento.';
    }
  }

  async playTrack(i: number): Promise<void> {
    if (i < 0 || i >= this.tracks.length) return;
    this.index = i;
    const audio = this.audioRef.nativeElement;
    audio.src = this.tracks[i].url;
    audio.load();
    try {
      await audio.play();
      this.playing = true;
      await this.updateMediaMetadata();
      await this.updateMediaPlaybackState('playing');
    } catch {
      this.playing = false;
      this.message = 'No se pudo reproducir este archivo. Prueba con un MP3 o M4A compatible.';
    }
  }

  async toggle(): Promise<void> {
    const audio = this.audioRef.nativeElement;
    if (!this.current) {
      if (this.tracks.length) await this.playTrack(0);
      return;
    }
    if (audio.paused) {
      try { await audio.play(); this.playing = true; }
      catch { this.message = 'No se pudo iniciar la reproducción.'; }
    } else {
      audio.pause();
      this.playing = false;
    }
  }

  async next(): Promise<void> {
    if (!this.tracks.length) return;
    if (this.repeat && this.index >= 0) { this.audioRef.nativeElement.currentTime = 0; await this.audioRef.nativeElement.play(); return; }
    const nextIndex = this.shuffle && this.tracks.length > 1
      ? this.randomIndex()
      : (this.index + 1) % this.tracks.length;
    await this.playTrack(nextIndex);
  }

  async previous(): Promise<void> {
    if (!this.tracks.length) return;
    const audio = this.audioRef.nativeElement;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    await this.playTrack((this.index - 1 + this.tracks.length) % this.tracks.length);
  }

  private randomIndex(): number {
    let value = Math.floor(Math.random() * this.tracks.length);
    if (value === this.index) value = (value + 1) % this.tracks.length;
    return value;
  }

  onTime(): void {
    const audio = this.audioRef.nativeElement;
    this.position = audio.currentTime || 0;
    this.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    this.elapsed = this.time(this.position);
    this.total = this.time(this.duration);
    if (this.duration > 0) {
      void MediaSession.setPositionState({ position: this.position, duration: this.duration, playbackRate: audio.playbackRate }).catch(() => undefined);
    }
  }

  seek(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.audioRef.nativeElement.currentTime = value;
    this.position = value;
  }

  onAudioPlay(): void {
    this.playing = true;
    void this.updateMediaPlaybackState('playing');
  }

  onAudioPause(): void {
    this.playing = false;
    void this.updateMediaPlaybackState('paused');
  }

  private async configureMediaSession(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.mediaHandlersReady) return;
    try {
      await MediaSession.setActionHandler({ action: 'play' }, () => { void this.toggle(); });
      await MediaSession.setActionHandler({ action: 'pause' }, () => { this.audioRef.nativeElement.pause(); });
      await MediaSession.setActionHandler({ action: 'previoustrack' }, () => { void this.previous(); });
      await MediaSession.setActionHandler({ action: 'nexttrack' }, () => { void this.next(); });
      await MediaSession.setActionHandler({ action: 'seekto' }, details => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          this.audioRef.nativeElement.currentTime = details.seekTime;
        }
      });
      await MediaSession.setActionHandler({ action: 'stop' }, () => { this.audioRef.nativeElement.pause(); });
      this.mediaHandlersReady = true;
    } catch (err) {
      console.warn('MediaSession no disponible nativamente:', err);
    }
  }

  private async updateMediaMetadata(): Promise<void> {
    if (!this.current || !Capacitor.isNativePlatform()) return;
    try {
      await MediaSession.setMetadata({ 
        title: this.current.name, 
        artist: 'Biblioteca local', 
        album: 'Winamp Offline', 
        artwork: [] 
      });
    } catch (err) {
      console.warn('Error al actualizar metadatos:', err);
    }
  }

  private async updateMediaPlaybackState(playbackState: 'playing' | 'paused' | 'none'): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try { 
      await MediaSession.setPlaybackState({ playbackState }); 
    } catch (err) {
      console.warn('Error al actualizar estado de reproducción:', err);
    }
  }

  time(n: number): string {
    if (!Number.isFinite(n)) return '0:00';
    return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  }
}