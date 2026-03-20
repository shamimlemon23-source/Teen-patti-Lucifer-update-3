
class SoundService {
  private sounds: Record<string, HTMLAudioElement> = {};
  private music: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private isMusicEnabled: boolean = true;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadSounds();
    }
  }

  private loadSounds() {
    const soundFiles = {
      shuffle: '/sounds/shuffle.mp3',
      deal: '/sounds/deal.mp3',
      bet: '/sounds/bet.mp3',
      flip: '/sounds/flip.mp3',
      click: '/sounds/click.mp3',
      fold: '/sounds/fold.mp3',
      win: '/sounds/win.mp3',
      lose: '/sounds/lose.mp3',
    };

    for (const [key, path] of Object.entries(soundFiles)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.onerror = (e) => {
        console.error(`Failed to load sound: ${key} at path: ${path}. Please ensure the file exists in public/sounds/ and the name matches exactly (case-sensitive).`);
      };
      this.sounds[key] = audio;
    }

    this.music = new Audio('/sounds/casino_music.mp3');
    this.music.onerror = (e) => {
      console.error(`Failed to load background music at path: /sounds/casino_music.mp3. Please ensure the file exists in public/sounds/ and the name matches exactly (case-sensitive).`);
    };
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = 0.4;
  }

  public init() {
    if (this.initialized) return;
    // Mobile browsers require a user interaction to play audio
    // We can "unlock" them by playing a silent sound or just starting music on first click
    this.initialized = true;
    if (this.isMusicEnabled && !this.isMuted) {
      this.playMusic();
    }
  }

  public play(soundName: string) {
    if (this.isMuted) return;
    const sound = this.sounds[soundName];
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(e => console.warn(`Error playing sound ${soundName}:`, e));
    }
  }

  public playMusic() {
    if (!this.music || !this.isMusicEnabled || this.isMuted) return;
    this.music.play().catch(e => console.warn("Error playing music:", e));
  }

  public stopMusic() {
    if (this.music) {
      this.music.pause();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopMusic();
    } else if (this.isMusicEnabled) {
      this.playMusic();
    }
    return this.isMuted;
  }

  public toggleMusic() {
    this.isMusicEnabled = !this.isMusicEnabled;
    if (this.isMusicEnabled && !this.isMuted) {
      this.playMusic();
    } else {
      this.stopMusic();
    }
    return this.isMusicEnabled;
  }

  public getSettings() {
    return {
      isMuted: this.isMuted,
      isMusicEnabled: this.isMusicEnabled
    };
  }
}

export const soundService = new SoundService();
