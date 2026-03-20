
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
    // Local paths (preferred)
    const localSounds = {
      shuffle: '/sounds/shuffle.mp3',
      deal: '/sounds/deal.mp3',
      bet: '/sounds/bet.mp3',
      flip: '/sounds/flip.mp3',
      click: '/sounds/click.mp3',
      fold: '/sounds/fold.mp3',
      win: '/sounds/win.mp3',
      lose: '/sounds/lose.mp3',
    };

    // Fallback public URLs (if local files are missing)
    const fallbackSounds = {
      shuffle: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
      deal: 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3',
      bet: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
      flip: 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3',
      click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      fold: 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3',
      win: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
      lose: 'https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3',
    };

    for (const [key, path] of Object.entries(localSounds)) {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = path;
      audio.preload = 'auto';
      
      audio.onerror = () => {
        // If local fails, try fallback
        const fallbackUrl = (fallbackSounds as any)[key];
        console.warn(`Local sound ${key} not found at ${path}. Using fallback: ${fallbackUrl}`);
        audio.src = fallbackUrl;
        audio.load();
      };
      
      this.sounds[key] = audio;
    }

    const localMusic = '/sounds/casino_music.mp3';
    const fallbackMusic = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    
    this.music = new Audio();
    this.music.crossOrigin = "anonymous";
    this.music.src = localMusic;
    
    this.music.onerror = () => {
      console.warn(`Local background music not found at ${localMusic}. Using fallback: ${fallbackMusic}`);
      if (this.music) {
        this.music.src = fallbackMusic;
        this.music.load();
        // If already initialized, try playing the fallback
        if (this.initialized && this.isMusicEnabled && !this.isMuted) {
          this.playMusic();
        }
      }
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
